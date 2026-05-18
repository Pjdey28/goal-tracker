const pool = require('../db');

async function ensureAnalyticsMaterializedViews() {
  // QoQ materialized view
  await pool.query(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS mat_qoq_goals AS
    SELECT
      c.id AS cycle_id,
      c.cycle_name,
      COUNT(g.id)::int AS total_goals,
      SUM(CASE WHEN g.progress_status='Completed' THEN 1 ELSE 0 END)::int AS completed_goals,
      ROUND(COALESCE(AVG(g.progress_score),0)::numeric,2) AS avg_score,
      c.start_date
    FROM cycle_config c
    LEFT JOIN goals g ON g.created_at BETWEEN c.start_date AND c.end_date
    GROUP BY c.id, c.cycle_name, c.start_date
    ORDER BY c.start_date DESC
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS mat_qoq_goals_start_idx ON mat_qoq_goals (start_date)`);

  // Manager heatmap materialized view
  await pool.query(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS mat_manager_heatmap AS
    SELECT
      mgr.id AS manager_id,
      mgr.email AS manager_email,
      c.id AS cycle_id,
      c.cycle_name,
      COUNT(g.id)::int AS total_goals,
      SUM(CASE WHEN g.progress_status='Completed' THEN 1 ELSE 0 END)::int AS completed_goals,
      CASE WHEN COUNT(g.id)=0 THEN 0 ELSE ROUND(100.0 * SUM(CASE WHEN g.progress_status='Completed' THEN 1 ELSE 0 END) / COUNT(g.id),2) END AS pct_completed
    FROM users mgr
    JOIN users emp ON emp.manager_id = mgr.id
    CROSS JOIN cycle_config c
    LEFT JOIN goals g ON g.employee_id = emp.id AND g.created_at BETWEEN c.start_date AND c.end_date
    WHERE mgr.role='manager'
    GROUP BY mgr.id, mgr.email, c.id, c.cycle_name
    ORDER BY mgr.email, c.start_date
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS mat_manager_heatmap_mgr_idx ON mat_manager_heatmap (manager_id)`);

  // Recommended indexes on base tables
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_goals_created_at ON goals (created_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_goals_progress_status ON goals (progress_status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_checkins_employee_created_at ON checkins (employee_id, created_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users (manager_id)`);
}

async function qoqTrend({ level = 'org', id = null, limit = 12 } = {}) {
  // returns per-cycle aggregates: cycle_name, total_goals, completed_goals, avg_score
  // Prefer materialized view if present
  try {
    const check = await pool.query("SELECT to_regclass('public.mat_qoq_goals') AS v");
    if (check.rows[0].v) {
      if (level === 'manager' && id) {
        const sql = `SELECT cycle_name, total_goals, completed_goals, avg_score FROM mat_qoq_goals mq JOIN (SELECT DISTINCT c.id FROM cycle_config c ORDER BY c.start_date DESC LIMIT $2) sub ON mq.cycle_id = sub.id WHERE mq.cycle_id IS NOT NULL AND mq.cycle_id = mq.cycle_id LIMIT $2`;
        // fallback to original per-manager query if mat view lacks manager breakdown
      }
      const sql = `SELECT cycle_name, total_goals, completed_goals, avg_score FROM mat_qoq_goals ORDER BY start_date DESC LIMIT $1`;
      const res = await pool.query(sql, [limit]);
      return res.rows.reverse();
    }
  } catch (err) {
    // ignore and fallback to runtime query
  }
  if (level === 'manager' && id) {
    const sql = `
      SELECT
        c.cycle_name,
        COUNT(g.id)::int AS total_goals,
        SUM(CASE WHEN g.progress_status='Completed' THEN 1 ELSE 0 END)::int AS completed_goals,
        ROUND(COALESCE(AVG(g.progress_score),0)::numeric,2) AS avg_score
      FROM cycle_config c
      LEFT JOIN goals g ON g.created_at BETWEEN c.start_date AND c.end_date
      LEFT JOIN users emp ON emp.id = g.employee_id
      WHERE emp.manager_id = $1
      GROUP BY c.cycle_name, c.start_date
      ORDER BY c.start_date DESC
      LIMIT $2
    `;
    const res = await pool.query(sql, [id, limit]);
    return res.rows.reverse();
  }

  // org-level
  const sql = `
    SELECT
      c.cycle_name,
      COUNT(g.id)::int AS total_goals,
      SUM(CASE WHEN g.progress_status='Completed' THEN 1 ELSE 0 END)::int AS completed_goals,
      ROUND(COALESCE(AVG(g.progress_score),0)::numeric,2) AS avg_score
    FROM cycle_config c
    LEFT JOIN goals g ON g.created_at BETWEEN c.start_date AND c.end_date
    GROUP BY c.cycle_name, c.start_date
    ORDER BY c.start_date DESC
    LIMIT $1
  `;
  const res = await pool.query(sql, [limit]);
  return res.rows.reverse();
}

async function distribution({ by = 'thrust_area' } = {}) {
  const allowed = ['thrust_area', 'uom_type', 'status'];
  if (!allowed.includes(by)) by = 'thrust_area';

  const sql = `
    SELECT
      ${by} AS key,
      COUNT(*)::int AS count,
      ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct
    FROM goals
    GROUP BY ${by}
    ORDER BY count DESC
    LIMIT 100
  `;
  const res = await pool.query(sql);
  return res.rows;
}

async function heatmapByManager() {
  const sql = `
    SELECT
      mgr.id AS manager_id,
      mgr.email AS manager_email,
      c.cycle_name,
      COUNT(g.id)::int AS total_goals,
      SUM(CASE WHEN g.progress_status='Completed' THEN 1 ELSE 0 END)::int AS completed_goals,
      ROUND(COALESCE(100.0 * SUM(CASE WHEN g.progress_status='Completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(g.id),0),0)::numeric,2) AS pct_completed
    FROM users mgr
    JOIN users emp ON emp.manager_id = mgr.id
    CROSS JOIN cycle_config c
    LEFT JOIN goals g ON g.employee_id = emp.id AND g.created_at BETWEEN c.start_date AND c.end_date
    WHERE mgr.role = 'manager'
    GROUP BY mgr.id, mgr.email, c.cycle_name, c.start_date
    ORDER BY mgr.email, c.start_date
  `;
  const res = await pool.query(sql);
  return res.rows;
}

async function managerEffectiveness({ limit = 50 } = {}) {
  // For each manager: number of direct reports, check-in completion rate (reports with >=1 checkin this cycle), avg approval lag
  const sql = `
    SELECT
      m.id AS manager_id,
      m.email AS manager_email,
      COUNT(DISTINCT emp.id)::int AS direct_reports,
      ROUND(COALESCE(AVG(ci.checkin_rate)::numeric,0),2) AS avg_checkin_rate,
      ROUND(COALESCE(AVG(al.approval_days)::numeric,0),2) AS avg_approval_days
    FROM users m
    LEFT JOIN users emp ON emp.manager_id = m.id
    LEFT JOIN (
      SELECT employee_id, COUNT(*)::int AS checkins_count, 1.0 AS checkin_rate
      FROM checkins
      GROUP BY employee_id
    ) ci ON ci.employee_id = emp.id
    LEFT JOIN (
      SELECT g.employee_id, g.id AS goal_id, EXTRACT(EPOCH FROM (al.changed_at - g.submitted_at))/(60*60*24) AS approval_days
      FROM goals g
      JOIN audit_logs al ON al.goal_id = g.id AND al.action='Goal Approved'
      WHERE g.submitted_at IS NOT NULL
    ) al ON al.employee_id = emp.id
    WHERE m.role = 'manager'
    GROUP BY m.id, m.email
    ORDER BY direct_reports DESC
    LIMIT $1
  `;

  const res = await pool.query(sql, [limit]);
  return res.rows;
}

module.exports = {
  qoqTrend,
  distribution,
  heatmapByManager,
  managerEffectiveness,
  ensureAnalyticsMaterializedViews,
};
