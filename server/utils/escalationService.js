const pool = require('../db');
const { sendEmail } = require('./notifications');

const DEFAULT_RULES = [
  {
    condition_key: 'employee_goal_submission',
    title: 'Employee goal submission overdue',
    description: 'Employee has not submitted goals within the active cycle window.',
    enabled: false,
    threshold_days: 3,
    manager_days: 5,
    hr_days: 7,
  },
  {
    condition_key: 'manager_goal_approval',
    title: 'Manager approval overdue',
    description: 'Submitted goals have not been approved within the configured threshold.',
    enabled: false,
    threshold_days: 2,
    manager_days: 4,
    hr_days: 6,
  },
  {
    condition_key: 'quarterly_checkin_missing',
    title: 'Quarterly check-in missing',
    description: 'Quarterly check-in has not been completed during the active cycle.',
    enabled: false,
    threshold_days: 7,
    manager_days: 14,
    hr_days: 21,
  },
];

let schedulerStarted = false;
let sweepInProgress = false;

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function daysBetween(startDate, endDate = new Date()) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
}

function parseRuleDays(rule) {
  return [
    { stage: 'employee', label: 'Employee reminder', days: Number(rule.threshold_days) || 0 },
    { stage: 'manager', label: 'Manager escalation', days: Number(rule.manager_days) || 0 },
    { stage: 'hr', label: 'Skip-level / HR escalation', days: Number(rule.hr_days) || 0 },
  ]
    .filter((entry) => entry.days > 0)
    .sort((a, b) => a.days - b.days);
}

async function ensureEscalationSchema() {
  await pool.query(`
    ALTER TABLE goals
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ
  `);

  await pool.query(`
    ALTER TABLE checkins
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS escalation_rules (
      id SERIAL PRIMARY KEY,
      condition_key TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      threshold_days INTEGER NOT NULL DEFAULT 3,
      manager_days INTEGER NOT NULL DEFAULT 5,
      hr_days INTEGER NOT NULL DEFAULT 7,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS escalation_logs (
      id SERIAL PRIMARY KEY,
      rule_key TEXT NOT NULL,
      rule_title TEXT NOT NULL,
      stage TEXT NOT NULL,
      stage_days INTEGER NOT NULL DEFAULT 0,
      employee_id INTEGER,
      employee_email TEXT,
      manager_id INTEGER,
      manager_email TEXT,
      goal_id INTEGER,
      cycle_id INTEGER,
      recipient_email TEXT,
      status TEXT NOT NULL DEFAULT 'sent',
      message TEXT,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS escalation_logs_dedupe_idx
    ON escalation_logs (rule_key, stage, COALESCE(employee_id, 0), COALESCE(goal_id, 0), COALESCE(cycle_id, 0))
  `);

  for (const rule of DEFAULT_RULES) {
    await pool.query(
      `
      INSERT INTO escalation_rules (condition_key, title, description, enabled, threshold_days, manager_days, hr_days)
      SELECT $1, $2, $3, $4, $5, $6, $7
      WHERE NOT EXISTS (
        SELECT 1 FROM escalation_rules WHERE condition_key=$1
      )
      `,
      [
        rule.condition_key,
        rule.title,
        rule.description,
        rule.enabled,
        rule.threshold_days,
        rule.manager_days,
        rule.hr_days,
      ]
    );
  }
}

async function loadRules() {
  await ensureEscalationSchema();
  const result = await pool.query('SELECT * FROM escalation_rules ORDER BY id ASC');
  return result.rows;
}

async function saveRule(id, patch) {
  await ensureEscalationSchema();
  const current = await pool.query('SELECT * FROM escalation_rules WHERE id=$1', [id]);
  if (!current.rows.length) {
    throw new Error('Rule not found');
  }

  const rule = current.rows[0];
  const updated = {
    title: patch.title ?? rule.title,
    description: patch.description ?? rule.description,
    enabled: patch.enabled ?? rule.enabled,
    threshold_days: Number.isFinite(Number(patch.threshold_days)) ? Number(patch.threshold_days) : rule.threshold_days,
    manager_days: Number.isFinite(Number(patch.manager_days)) ? Number(patch.manager_days) : rule.manager_days,
    hr_days: Number.isFinite(Number(patch.hr_days)) ? Number(patch.hr_days) : rule.hr_days,
  };

  const result = await pool.query(
    `
    UPDATE escalation_rules
    SET title=$2,
        description=$3,
        enabled=$4,
        threshold_days=$5,
        manager_days=$6,
        hr_days=$7,
        updated_at=NOW()
    WHERE id=$1
    RETURNING *
    `,
    [id, updated.title, updated.description, updated.enabled, updated.threshold_days, updated.manager_days, updated.hr_days]
  );

  return result.rows[0];
}

async function loadLogs(limit = 200) {
  await ensureEscalationSchema();
  const result = await pool.query(
    `
    SELECT
      el.*,
      u.email AS employee_email_lookup,
      m.email AS manager_email_lookup
    FROM escalation_logs el
    LEFT JOIN users u ON u.id = el.employee_id
    LEFT JOIN users m ON m.id = el.manager_id
    ORDER BY el.triggered_at DESC
    LIMIT $1
    `,
    [limit]
  );
  return result.rows;
}

async function resolveLog(id) {
  await ensureEscalationSchema();
  const result = await pool.query(
    `
    UPDATE escalation_logs
    SET status='resolved', resolved_at=NOW()
    WHERE id=$1
    RETURNING *
    `,
    [id]
  );
  return result.rows[0];
}

async function loadActiveCycle() {
  const result = await pool.query(
    `
    SELECT *
    FROM cycle_config
    WHERE NOW() BETWEEN start_date AND end_date
    ORDER BY start_date DESC
    LIMIT 1
    `
  );

  return result.rows[0] || null;
}

async function loadHrRecipients() {
  const admins = await pool.query(`SELECT email FROM users WHERE role='admin' ORDER BY email ASC`);
  const envRecipients = parseCsv(process.env.ESCALATION_HR_EMAILS);
  return Array.from(new Set([...admins.rows.map((row) => row.email).filter(Boolean), ...envRecipients]));
}

async function notificationAlreadySent({ ruleKey, stage, employeeId, goalId, cycleId }) {
  const result = await pool.query(
    `
    SELECT id
    FROM escalation_logs
    WHERE rule_key=$1
      AND stage=$2
      AND COALESCE(employee_id, 0)=COALESCE($3, 0)
      AND COALESCE(goal_id, 0)=COALESCE($4, 0)
      AND COALESCE(cycle_id, 0)=COALESCE($5, 0)
    LIMIT 1
    `,
    [ruleKey, stage, employeeId || null, goalId || null, cycleId || null]
  );

  return result.rows.length > 0;
}

async function writeEscalationLog(entry) {
  await pool.query(
    `
    INSERT INTO escalation_logs (
      rule_key,
      rule_title,
      stage,
      stage_days,
      employee_id,
      employee_email,
      manager_id,
      manager_email,
      goal_id,
      cycle_id,
      recipient_email,
      status,
      message,
      payload
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    `,
    [
      entry.ruleKey,
      entry.ruleTitle,
      entry.stage,
      entry.stageDays,
      entry.employeeId || null,
      entry.employeeEmail || null,
      entry.managerId || null,
      entry.managerEmail || null,
      entry.goalId || null,
      entry.cycleId || null,
      entry.recipientEmail || null,
      entry.status || 'sent',
      entry.message || null,
      JSON.stringify(entry.payload || {}),
    ]
  );
}

async function sendEscalationNotifications({
  rule,
  stage,
  stageDays,
  employee,
  goal,
  cycle,
  recipientEmails,
  subject,
  message,
}) {
  const recipients = Array.from(new Set((recipientEmails || []).filter(Boolean)));

  if (recipients.length === 0) {
    return { sentTo: [] };
  }

  const deepLink = `${process.env.CLIENT_URL || 'http://localhost:5177'}/admin/escalations`;
  for (const recipientEmail of recipients) {
    await sendEmail({
      to: recipientEmail,
      subject,
      text: `${message}\nOpen escalation dashboard: ${deepLink}`,
      html: `<p>${message}</p><p><a href="${deepLink}">Open escalation dashboard</a></p>`,
    });
  }

  // Teams support removed; only email notifications are sent.

  await writeEscalationLog({
    ruleKey: rule.condition_key,
    ruleTitle: rule.title,
    stage,
    stageDays,
    employeeId: employee?.id,
    employeeEmail: employee?.email,
    managerId: employee?.manager_id,
    managerEmail: employee?.manager_email,
    goalId: goal?.id,
    cycleId: cycle?.id,
    recipientEmail: recipients.join(', '),
    status: 'sent',
    message,
    payload: {
      recipients,
      subject,
      stage,
      rule: rule.condition_key,
      goalId: goal?.id || null,
      cycleId: cycle?.id || null,
    },
  });

  return { sentTo: recipients };
}

async function sweepEmployeeSubmissionRule(rule, cycle) {
  const stages = parseRuleDays(rule);
  if (!stages.length) return [];

  const cycleAge = daysBetween(cycle.start_date);
  const employees = await pool.query(
    `
    SELECT
      u.id,
      u.email,
      u.manager_id,
      mgr.email AS manager_email
    FROM users u
    LEFT JOIN users mgr ON mgr.id = u.manager_id
    WHERE u.role='employee'
      AND NOT EXISTS (
        SELECT 1
        FROM goals g
        WHERE g.employee_id = u.id
          AND g.submitted_at IS NOT NULL
          AND g.submitted_at BETWEEN $1 AND $2
      )
    ORDER BY u.email ASC
    `,
    [cycle.start_date, cycle.end_date]
  );

  const hrRecipients = await loadHrRecipients();
  const results = [];

  for (const stage of stages) {
    if (cycleAge < stage.days) continue;

    for (const employee of employees.rows) {
      const alreadySent = await notificationAlreadySent({
        ruleKey: rule.condition_key,
        stage: stage.stage,
        employeeId: employee.id,
        cycleId: cycle.id,
      });
      if (alreadySent) continue;

      const recipientEmails =
        stage.stage === 'employee'
          ? [employee.email]
          : stage.stage === 'manager'
          ? [employee.manager_email]
          : [...hrRecipients, employee.manager_email];

      const subject = `[Escalation] ${rule.title}`;
      const message =
        stage.stage === 'employee'
          ? `Employee goal submission is overdue for ${employee.email} in cycle ${cycle.cycle_name}.`
          : stage.stage === 'manager'
          ? `Manager escalation: ${employee.email} has not submitted goals in cycle ${cycle.cycle_name}.`
          : `HR escalation: ${employee.email} still has no goal submission in cycle ${cycle.cycle_name}.`;

      const recipientList = recipientEmails.filter(Boolean);
      if (!recipientList.length) continue;

      await sendEscalationNotifications({
        rule,
        stage: stage.stage,
        stageDays: stage.days,
        employee,
        cycle,
        recipientEmails: recipientList,
        subject,
        message,
      });
      results.push({ rule: rule.condition_key, stage: stage.stage, employeeId: employee.id });
    }
  }

  return results;
}

async function sweepManagerApprovalRule(rule) {
  const stages = parseRuleDays(rule);
  if (!stages.length) return [];

  const goals = await pool.query(
    `
    SELECT
      g.id,
      g.title,
      g.submitted_at,
      g.employee_id,
      emp.email AS employee_email,
      emp.manager_id,
      mgr.email AS manager_email,
      skip.email AS skip_email
    FROM goals g
    LEFT JOIN users emp ON emp.id = g.employee_id
    LEFT JOIN users mgr ON mgr.id = emp.manager_id
    LEFT JOIN users skip ON skip.id = mgr.manager_id
    WHERE g.status='Pending Approval'
      AND g.submitted_at IS NOT NULL
    ORDER BY g.submitted_at ASC
    `
  );

  const hrRecipients = await loadHrRecipients();
  const results = [];

  for (const goal of goals.rows) {
    const age = daysBetween(goal.submitted_at);
    for (const stage of stages) {
      if (age < stage.days) continue;

      const alreadySent = await notificationAlreadySent({
        ruleKey: rule.condition_key,
        stage: stage.stage,
        employeeId: goal.employee_id,
        goalId: goal.id,
      });
      if (alreadySent) continue;

      const recipientEmails =
        stage.stage === 'employee'
          ? [goal.employee_email]
          : stage.stage === 'manager'
          ? [goal.manager_email]
          : [goal.skip_email, ...hrRecipients];

      const subject = `[Escalation] ${rule.title}`;
      const message =
        stage.stage === 'employee'
          ? `Goal '${goal.title}' is still pending approval for ${goal.employee_email}.`
          : stage.stage === 'manager'
          ? `Manager escalation: goal '${goal.title}' is still pending approval.`
          : `HR escalation: goal '${goal.title}' remains pending approval.`;

      const recipientList = recipientEmails.filter(Boolean);
      if (!recipientList.length) continue;

      await sendEscalationNotifications({
        rule,
        stage: stage.stage,
        stageDays: stage.days,
        employee: {
          id: goal.employee_id,
          email: goal.employee_email,
          manager_id: goal.manager_id,
          manager_email: goal.manager_email,
        },
        goal,
        recipientEmails: recipientList,
        subject,
        message,
      });
      results.push({ rule: rule.condition_key, stage: stage.stage, goalId: goal.id });
    }
  }

  return results;
}

async function sweepCheckinRule(rule, cycle) {
  const stages = parseRuleDays(rule);
  if (!stages.length) return [];

  const cycleAge = daysBetween(cycle.start_date);
  const employees = await pool.query(
    `
    SELECT
      u.id,
      u.email,
      u.manager_id,
      mgr.email AS manager_email
    FROM users u
    LEFT JOIN users mgr ON mgr.id = u.manager_id
    WHERE u.role='employee'
      AND NOT EXISTS (
        SELECT 1
        FROM checkins c
        WHERE c.employee_id = u.id
          AND c.created_at BETWEEN $1 AND $2
      )
    ORDER BY u.email ASC
    `,
    [cycle.start_date, cycle.end_date]
  );

  const hrRecipients = await loadHrRecipients();
  const results = [];

  for (const stage of stages) {
    if (cycleAge < stage.days) continue;

    for (const employee of employees.rows) {
      const alreadySent = await notificationAlreadySent({
        ruleKey: rule.condition_key,
        stage: stage.stage,
        employeeId: employee.id,
        cycleId: cycle.id,
      });
      if (alreadySent) continue;

      const recipientEmails =
        stage.stage === 'employee'
          ? [employee.email]
          : stage.stage === 'manager'
          ? [employee.manager_email]
          : [...hrRecipients, employee.manager_email];

      const subject = `[Escalation] ${rule.title}`;
      const message =
        stage.stage === 'employee'
          ? `Quarterly check-in is overdue for ${employee.email} in cycle ${cycle.cycle_name}.`
          : stage.stage === 'manager'
          ? `Manager escalation: quarterly check-in is still overdue for ${employee.email}.`
          : `HR escalation: quarterly check-in remains overdue for ${employee.email}.`;

      const recipientList = recipientEmails.filter(Boolean);
      if (!recipientList.length) continue;

      await sendEscalationNotifications({
        rule,
        stage: stage.stage,
        stageDays: stage.days,
        employee,
        cycle,
        recipientEmails: recipientList,
        subject,
        message,
      });
      results.push({ rule: rule.condition_key, stage: stage.stage, employeeId: employee.id });
    }
  }

  return results;
}

async function runEscalationSweep() {
  if (sweepInProgress) {
    return { skipped: true, reason: 'Sweep already running' };
  }

  sweepInProgress = true;
  try {
    await ensureEscalationSchema();
    const rules = await loadRules();
    const cycle = await loadActiveCycle();
    const results = [];

    for (const rule of rules.filter((entry) => entry.enabled)) {
      if (rule.condition_key === 'employee_goal_submission') {
        if (cycle) results.push(...(await sweepEmployeeSubmissionRule(rule, cycle)));
      } else if (rule.condition_key === 'manager_goal_approval') {
        results.push(...(await sweepManagerApprovalRule(rule)));
      } else if (rule.condition_key === 'quarterly_checkin_missing') {
        if (cycle) results.push(...(await sweepCheckinRule(rule, cycle)));
      }
    }

    return { skipped: false, cycle: cycle?.cycle_name || null, results };
  } finally {
    sweepInProgress = false;
  }
}

function startEscalationScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const intervalMinutes = Number(process.env.ESCALATION_SWEEP_MINUTES) || 60;
  const intervalMs = Math.max(5, intervalMinutes) * 60 * 1000;

  setTimeout(() => {
    runEscalationSweep().catch((err) => {
      console.error('Initial escalation sweep failed', err?.response?.data || err?.message || err);
    });
  }, 15000);

  setInterval(() => {
    runEscalationSweep().catch((err) => {
      console.error('Scheduled escalation sweep failed', err?.response?.data || err?.message || err);
    });
  }, intervalMs);
}

module.exports = {
  ensureEscalationSchema,
  loadRules,
  saveRule,
  loadLogs,
  resolveLog,
  runEscalationSweep,
  startEscalationScheduler,
};