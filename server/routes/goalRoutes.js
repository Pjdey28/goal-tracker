const express = require("express");
const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");
const router = express.Router();
const XLSX = require("xlsx");
const quarterMiddleware = require("../middleware/quarterMiddleware");
const auditLogger = require("../utils/auditLogger");
const requireRole = require("../middleware/roleMiddleware");

router.post("/create", authMiddleware, async (req, res) => {
  try {
    const {
      employee_id,
      title,
      description,
      thrust_area,
      uom_type,
      target_value,
      weightage,
    } = req.body;
    const existingGoals = await pool.query(
      "SELECT * FROM goals WHERE employee_id=$1",
      [employee_id]
    );
    if (existingGoals.rows.length >= 8) {
      return res.status(400).json({
        message: "Maximum 8 goals allowed",
      });
    }
    const numericWeightage = Number(weightage);
    if (Number.isNaN(numericWeightage)) {
      return res.status(400).json({
        message: "Invalid weightage",
      });
    }
    if (numericWeightage < 10) {
      return res.status(400).json({
        message: "Minimum weightage is 10%",
      });
    }
    let totalWeightage = numericWeightage;
    existingGoals.rows.forEach((goal) => {
      totalWeightage += Number(goal.weightage) || 0;
    });

    // include any shared goals already assigned to this employee
    const sharedAssignments = await pool.query(
      "SELECT * FROM shared_goal_assignments WHERE employee_id=$1",
      [employee_id]
    );

    sharedAssignments.rows.forEach((sga) => {
      totalWeightage += Number(sga.weightage) || 0;
    });

    if (totalWeightage > 100) {
      return res.status(400).json({
        message: "Total weightage cannot exceed 100%",
      });
    }

    const lockedGoals = existingGoals.rows.find(
        (goal) => goal.locked === true
        );

        if (lockedGoals) {
        return res.status(400).json({
            message: "Goals are locked by manager",
        });
        }
    const newGoal = await pool.query(
      `INSERT INTO goals
      (employee_id, title, description, thrust_area, uom_type, target_value, weightage)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *`,
      [
        employee_id,
        title,
        description,
        thrust_area,
        uom_type,
          target_value,
          numericWeightage,
      ]
    );
    await auditLogger({
      goal_id: newGoal.rows[0].id,
      changed_by: req.user.email,
      action: "Goal Created",
      field_changed: "create",
      old_value: "",
      new_value: JSON.stringify({
        weightage: numericWeightage,
        target_value,
      }),
    });

    res.json(newGoal.rows[0]);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });

  }

});

router.get("/manager", authMiddleware, requireRole("manager"), async (req, res) => {

  try {

    const { status } = req.query;
    const normalized =
      status === "Pending"
        ? "Pending Approval"
        : status === "Rejected"
        ? "Returned"
        : status;

    const params = [];
    let sql = "SELECT * FROM goals";

    if (normalized && normalized !== "All") {
      params.push(normalized);
      sql += " WHERE status=$1";
    }

    sql += " ORDER BY id DESC";

    const goals = await pool.query(sql, params);

    res.json(goals.rows);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });

  }

});

router.get("/manager/team-overview", authMiddleware, requireRole("manager"), async (req, res) => {

  try {

    const summary = await pool.query(
      `
      SELECT
        u.id AS employee_id,
        u.email,
        COALESCE(COUNT(g.id), 0)::int AS total_goals,
        COALESCE(SUM(CASE WHEN g.progress_status='Completed' THEN 1 ELSE 0 END), 0)::int AS completed_goals,
        ROUND(COALESCE(AVG(g.progress_score), 0)::numeric, 0)::int AS avg_progress_score
      FROM users u
      LEFT JOIN goals g ON g.employee_id = u.id
      WHERE u.role='employee'
      GROUP BY u.id, u.email
      ORDER BY u.email ASC
      `
    );

    const upcoming = await pool.query(
      `
      SELECT
        g.employee_id,
        g.id,
        g.title,
        g.deadline,
        g.status
      FROM goals g
      WHERE g.deadline IS NOT NULL
      ORDER BY g.deadline ASC
      `
    );

    const byEmployee = new Map();
    upcoming.rows.forEach((row) => {
      const list = byEmployee.get(row.employee_id) || [];
      if (list.length < 3) {
        list.push(row);
      }
      byEmployee.set(row.employee_id, list);
    });

    const payload = summary.rows.map((row) => ({
      ...row,
      upcoming_deadlines: byEmployee.get(row.employee_id) || [],
    }));

    res.json(payload);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });

  }

});

router.get("/employee/:employeeId", authMiddleware, async (req, res) => {

  try {

    const goals = await pool.query(
      "SELECT * FROM goals WHERE employee_id=$1",
      [req.params.employeeId]
    );

    res.json(goals.rows);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });

  }

});
router.put(
  "/submit/:employeeId",
  authMiddleware,
  async (req, res) => {

    try {

      const employeeId = req.params.employeeId;

      const personal = await pool.query(
        "SELECT weightage FROM goals WHERE employee_id=$1",
        [employeeId]
      );

      const shared = await pool.query(
        "SELECT weightage FROM shared_goal_assignments WHERE employee_id=$1",
        [employeeId]
      );

      let total = 0;
      personal.rows.forEach((g) => {
        total += Number(g.weightage) || 0;
      });
      shared.rows.forEach((s) => {
        total += Number(s.weightage) || 0;
      });

      if (Math.round(total) !== 100) {
        return res.status(400).json({
          message: "Total weightage must equal 100% before submission",
        });
      }

      await pool.query(
        `
        UPDATE goals
        SET status='Pending Approval'
        WHERE employee_id=$1
        `,
        [employeeId]
      );

      await auditLogger({
        goal_id: null,
        changed_by: req.user.email,
        action: "Goals Submitted",
        field_changed: "status",
        old_value: "",
        new_value: "Pending Approval",
      });

      res.json({ message: "Goals Submitted" });

    } catch (error) {

      console.log(error);

      res.status(500).json({
        message: "Server Error",
      });

    }

  }
);
router.get("/manager/pending", authMiddleware, requireRole("manager"), async (req, res) => {

  try {

    const goals = await pool.query(
      `
      SELECT * FROM goals
      WHERE status='Pending Approval'
      ORDER BY id DESC
      `
    );

    res.json(goals.rows);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });

  }

});
router.put("/approve/:goalId", authMiddleware, requireRole("manager"), async (req, res) => {

  try {

    const oldGoal = await pool.query(
      `
      SELECT * FROM goals
      WHERE id=$1
      `,
      [req.params.goalId]
    );

    await pool.query(
      `
      UPDATE goals
      SET
      status='Approved',
      locked=true
      WHERE id=$1
      `,
      [req.params.goalId]
    );

    await auditLogger({
        goal_id: req.params.goalId,
        changed_by: req.user.email,
        action: "Goal Approved",
        field_changed: "status",
        old_value: oldGoal.rows[0].status,
        new_value: "Approved",
    });

    res.json({
      message: "Goal Approved",
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });

  }

});
router.put("/reject/:goalId", authMiddleware, requireRole("manager"), async (req, res) => {

  try {
    await pool.query(
      `
      UPDATE goals
      SET status='Returned'
      WHERE id=$1
      `,
      [req.params.goalId]
    );

    res.json({
      message: "Goal Returned",
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });

  }

});
router.put("/achievement/:goalId", authMiddleware, async (req, res) => {

  try {

    // reuse the canonical check-in flow: create a checkin record and update the goal snapshot
    const { achievement_value, progress_status, completion_date } = req.body;

    const goalResult = await pool.query(
      `SELECT * FROM goals WHERE id=$1`,
      [req.params.goalId]
    );

    if (goalResult.rows.length === 0) {
      return res.status(404).json({ message: "Goal not found" });
    }

    const goal = goalResult.rows[0];

    let progress_score = 0;

    if (goal.uom_type === "MIN") {
      progress_score = (Number(achievement_value) / Number(goal.target_value)) * 100;
    } else if (goal.uom_type === "MAX") {
      progress_score = (Number(goal.target_value) / Number(achievement_value)) * 100;
    } else if (goal.uom_type === "ZERO") {
      progress_score = Number(achievement_value) === 0 ? 100 : 0;
    } else if (goal.uom_type === "TIMELINE") {
      if (completion_date && goal.deadline) {
        const completed = new Date(completion_date);
        const deadline = new Date(goal.deadline);
        progress_score = completed <= deadline ? 100 : 50;
      }
    }

    progress_score = Math.round(progress_score);

    await pool.query(
      `INSERT INTO checkins (goal_id, shared_assignment_id, employee_id, quarter, achievement_value, progress_status, completion_date) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [req.params.goalId, null, goal.employee_id, req.currentCycle?.cycle_name || null, achievement_value, progress_status, completion_date]
    );

    await pool.query(
      `UPDATE goals SET achievement_value=$1, progress_status=$2, progress_score=$3 WHERE id=$4`,
      [achievement_value, progress_status, progress_score, req.params.goalId]
    );

    await auditLogger({
      goal_id: req.params.goalId,
      changed_by: req.user.email,
      action: "Achievement Updated",
      field_changed: "achievement_value",
      old_value: goal.achievement_value || "",
      new_value: achievement_value,
    });

    res.json({ message: "Achievement Updated" });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });

  }

});
router.put("/unlock/:goalId", authMiddleware, requireRole("admin"), async (req, res) => {

  try {

    const oldGoal = await pool.query(
      `
      SELECT * FROM goals
      WHERE id=$1
      `,
      [req.params.goalId]
    );

    await pool.query(
      `
      UPDATE goals
      SET
      locked=false,
      status='Returned'
      WHERE id=$1
      `,
      [req.params.goalId]
    );

    await auditLogger({
        goal_id: req.params.goalId,
        changed_by: req.user.email,
        action: "Goal Unlocked",
        field_changed: "status",
        old_value: oldGoal.rows[0].status,
        new_value: "Returned",
    });

    res.json({
      message: "Goal Unlocked",
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });

  }

});
router.get("/audit/logs", authMiddleware, async (req, res) => {

  try {

    const logs = await pool.query(
      `
      SELECT
        id,
        goal_id,
        action,
        changed_by,
        field_changed,
        old_value,
        new_value,
        changed_at
        FROM audit_logs
      ORDER BY changed_at DESC
      `
    );

    res.json(logs.rows);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });

  }

});
router.get("/export/excel", authMiddleware, requireRole("admin"), async (req, res) => {

  try {

    // Goals sheet (basic goal info)
    const goals = await pool.query(`
      SELECT
        id,
        title,
        thrust_area,
        uom_type,
        target_value,
        achievement_value,
        progress_status,
        progress_score,
        weightage,
        status,
        employee_id
      FROM goals
    `);

    // Checkins sheet (historical check-ins, includes shared assignment linkage)
    const checkins = await pool.query(`
      SELECT
        c.id,
        c.goal_id,
        c.shared_assignment_id,
        COALESCE(c.employee_id, g.employee_id, sga.employee_id) AS employee_id,
        c.quarter,
        c.achievement_value,
        c.progress_status,
        c.completion_date
      FROM checkins c
      LEFT JOIN goals g ON g.id = c.goal_id
      LEFT JOIN shared_goal_assignments sga ON sga.id = c.shared_assignment_id
      ORDER BY c.id DESC
    `);

    // Shared assignments sheet (so analysts can see planned vs assigned weights)
    const sharedAssignments = await pool.query(`
      SELECT
        sga.id,
        sga.shared_goal_id,
        sga.employee_id,
        sga.weightage,
        sg.title AS shared_title
      FROM shared_goal_assignments sga
      LEFT JOIN shared_goals sg ON sg.id = sga.shared_goal_id
      ORDER BY sga.id DESC
    `);

    const workbook = XLSX.utils.book_new();

    const goalsSheet = XLSX.utils.json_to_sheet(goals.rows);
    const checkinsSheet = XLSX.utils.json_to_sheet(checkins.rows);
    const sharedSheet = XLSX.utils.json_to_sheet(sharedAssignments.rows);

    XLSX.utils.book_append_sheet(workbook, goalsSheet, "Goals");
    XLSX.utils.book_append_sheet(workbook, checkinsSheet, "Checkins");
    XLSX.utils.book_append_sheet(workbook, sharedSheet, "SharedAssignments");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=goals_export.xlsx");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.send(buffer);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });

  }

});
router.post("/shared/create", authMiddleware, requireRole(["admin","manager"]), async (req, res) => {

  try {

    const {
      title,
      description,
      thrust_area,
      uom_type,
      target_value,
    } = req.body;

    const sharedGoal = await pool.query(
      `
      INSERT INTO shared_goals
      (
        title,
        description,
        thrust_area,
        uom_type,
        target_value
      )
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `,
      [
        title,
        description,
        thrust_area,
        uom_type,
        target_value,
      ]
    );

    res.json(sharedGoal.rows[0]);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });

  }

});
router.get("/employees", authMiddleware, requireRole(["admin", "manager"]), async (req, res) => {

  try {

    const employees = await pool.query(
      `
      SELECT id, email
      FROM users
      WHERE role='employee'
      ORDER BY email ASC
      `
    );

    res.json(employees.rows);

  } catch (error) {

    console.log(error);

    res.status(500).json({ message: "Server Error" });

  }

});

router.get("/shared/catalog", authMiddleware, requireRole(["admin", "manager"]), async (req, res) => {

  try {

    const sharedGoals = await pool.query(
      `
      SELECT id, title, description, thrust_area, uom_type, target_value
      FROM shared_goals
      ORDER BY id DESC
      `
    );

    res.json(sharedGoals.rows);

  } catch (error) {

    console.log(error);

    res.status(500).json({ message: "Server Error" });

  }

});

router.post("/shared/assign", authMiddleware, requireRole(["admin", "manager"]), async (req, res) => {

  try {

    const {
      shared_goal_id,
      employee_id,
      weightage,
    } = req.body;

    const numericWeightage = Number(weightage);

    if (Number.isNaN(numericWeightage)) {
      return res.status(400).json({ message: "Invalid weightage" });
    }

    // calculate current total for employee (goals + shared assignments)
    const existingGoals = await pool.query(
      "SELECT * FROM goals WHERE employee_id=$1",
      [employee_id]
    );

    const existingShared = await pool.query(
      "SELECT * FROM shared_goal_assignments WHERE employee_id=$1",
      [employee_id]
    );

    let total = 0;
    existingGoals.rows.forEach((g) => {
      total += Number(g.weightage) || 0;
    });
    existingShared.rows.forEach((s) => {
      total += Number(s.weightage) || 0;
    });

    if (total + numericWeightage > 100) {
      return res.status(400).json({ message: "Total weightage cannot exceed 100%" });
    }

    const assignment = await pool.query(
      `
      INSERT INTO shared_goal_assignments
      (
        shared_goal_id,
        employee_id,
        weightage
      )
      VALUES ($1,$2,$3)
      RETURNING *
      `,
      [
        shared_goal_id,
        employee_id,
        numericWeightage,
      ]
    );

    await auditLogger({
      goal_id: null,
      changed_by: req.user.email,
      action: "Shared Goal Assigned",
      field_changed: "weightage",
      old_value: "",
      new_value: numericWeightage,
    });

    res.json(assignment.rows[0]);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });

  }

});

router.put("/shared/assign/:assignmentId", authMiddleware, async (req, res) => {

  try {

    const { weightage, progress_status, achievement_value } = req.body;
    const hasWeightage = weightage !== undefined;
    const hasAchievement = achievement_value !== undefined;
    const hasStatus = progress_status !== undefined;

    const numericWeightage = hasWeightage ? Number(weightage) : null;
    const numericAchievement = hasAchievement ? Number(achievement_value) : null;

    if (hasWeightage && Number.isNaN(numericWeightage)) {
      return res.status(400).json({ message: "Invalid weightage" });
    }

    if (hasAchievement && Number.isNaN(numericAchievement)) {
      return res.status(400).json({ message: "Invalid achievement value" });
    }

    const currentAssignment = await pool.query(
      `
      SELECT * FROM shared_goal_assignments
      WHERE id=$1
      `,
      [req.params.assignmentId]
    );

    if (currentAssignment.rows.length === 0) {
      return res.status(404).json({ message: "Shared assignment not found" });
    }

    if (req.user.role === "employee" && currentAssignment.rows[0].employee_id !== req.user.id) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const employeeId = currentAssignment.rows[0].employee_id;

    const sharedGoal = await pool.query(
      `
      SELECT sg.*
      FROM shared_goal_assignments sga
      JOIN shared_goals sg ON sg.id = sga.shared_goal_id
      WHERE sga.id=$1
      `,
      [req.params.assignmentId]
    );

    const sharedGoalRow = sharedGoal.rows[0];

    if (hasWeightage) {
      const personalGoals = await pool.query(
        "SELECT weightage FROM goals WHERE employee_id=$1",
        [employeeId]
      );

      const otherShared = await pool.query(
        "SELECT weightage FROM shared_goal_assignments WHERE employee_id=$1 AND id<>$2",
        [employeeId, req.params.assignmentId]
      );

      let total = 0;
      personalGoals.rows.forEach((goal) => {
        total += Number(goal.weightage) || 0;
      });
      otherShared.rows.forEach((assignment) => {
        total += Number(assignment.weightage) || 0;
      });

      if (total + numericWeightage > 100) {
        return res.status(400).json({ message: "Total weightage cannot exceed 100%" });
      }
    }

    let progressScore = 0;

    if (hasAchievement || hasStatus) {
      const effectiveAchievement = hasAchievement ? numericAchievement : Number(currentAssignment.rows[0].achievement_value);
      if (!Number.isNaN(effectiveAchievement)) {
        if (sharedGoalRow.uom_type === "MIN" && sharedGoalRow.target_value) {
          progressScore = (effectiveAchievement / Number(sharedGoalRow.target_value)) * 100;
        } else if (sharedGoalRow.uom_type === "MAX" && effectiveAchievement) {
          progressScore = (Number(sharedGoalRow.target_value) / effectiveAchievement) * 100;
        } else if (sharedGoalRow.uom_type === "ZERO") {
          progressScore = effectiveAchievement === 0 ? 100 : 0;
        }
      }

      progressScore = Math.round(progressScore);
    }

    const updated = await pool.query(
      `
      UPDATE shared_goal_assignments
      SET
        weightage=COALESCE($1, weightage),
        progress_status=COALESCE($2, progress_status),
        achievement_value=COALESCE($3, achievement_value)
      WHERE id=$4
      RETURNING *
      `,
      [
        hasWeightage ? numericWeightage : null,
        hasStatus ? progress_status : null,
        hasAchievement ? achievement_value : null,
        req.params.assignmentId,
      ]
    );

    await auditLogger({
      goal_id: null,
      changed_by: req.user.email,
      action: "Shared Goal Updated",
      field_changed: hasAchievement
        ? "achievement_value"
        : hasStatus
        ? "progress_status"
        : "weightage",
      old_value: JSON.stringify({
        weightage: currentAssignment.rows[0].weightage,
        progress_status: currentAssignment.rows[0].progress_status,
        achievement_value: currentAssignment.rows[0].achievement_value,
      }),
      new_value: JSON.stringify({
        weightage: hasWeightage ? numericWeightage : currentAssignment.rows[0].weightage,
        progress_status: hasStatus ? progress_status : currentAssignment.rows[0].progress_status,
        achievement_value: hasAchievement ? achievement_value : currentAssignment.rows[0].achievement_value,
      }),
    });

    res.json(updated.rows[0]);

  } catch (error) {

    console.log(error);

    res.status(500).json({ message: "Server Error" });

  }

});

// Propagate a shared-goal check-in to all assignees (owner action)
router.post(
  "/shared/checkin/:sharedGoalId",
  authMiddleware,
  quarterMiddleware,
  async (req, res) => {
    try {
      const { achievement_value, progress_status, completion_date } = req.body;

      const sharedRes = await pool.query(
        `SELECT * FROM shared_goals WHERE id=$1`,
        [req.params.sharedGoalId]
      );

      if (sharedRes.rows.length === 0) {
        return res.status(404).json({ message: "Shared goal not found" });
      }

      const sharedGoal = sharedRes.rows[0];

      const assignments = await pool.query(
        `SELECT * FROM shared_goal_assignments WHERE shared_goal_id=$1`,
        [req.params.sharedGoalId]
      );

      const results = [];

      for (const a of assignments.rows) {
        // skip if an assignment checkin already exists for this quarter (preserve assignee data)
        const existing = await pool.query(
          `SELECT id FROM checkins WHERE shared_assignment_id=$1 AND quarter=$2 LIMIT 1`,
          [a.id, req.currentCycle?.cycle_name || null]
        );

        if (existing.rows.length > 0) {
          results.push({ assignment_id: a.id, employee_id: a.employee_id, skipped: true });
          continue;
        }

        // compute progress score using shared goal UOM
        let progress_score = 0;

        if (sharedGoal.uom_type === "MIN") {
          progress_score = (Number(achievement_value) / Number(sharedGoal.target_value)) * 100;
        } else if (sharedGoal.uom_type === "MAX") {
          progress_score = (Number(sharedGoal.target_value) / Number(achievement_value)) * 100;
        } else if (sharedGoal.uom_type === "ZERO") {
          progress_score = Number(achievement_value) === 0 ? 100 : 0;
        } else if (sharedGoal.uom_type === "TIMELINE") {
          if (completion_date && sharedGoal.deadline) {
            const completed = new Date(completion_date);
            const deadline = new Date(sharedGoal.deadline);
            progress_score = completed <= deadline ? 100 : 50;
          }
        }

        progress_score = Math.round(progress_score);

        // update assignment record
        await pool.query(
          `UPDATE shared_goal_assignments SET achievement_value=$1, progress_status=$2 WHERE id=$3`,
          [achievement_value, progress_status, a.id]
        );

        // insert checkin row linked to the shared assignment
        await pool.query(
          `INSERT INTO checkins (goal_id, shared_assignment_id, employee_id, quarter, achievement_value, progress_status, completion_date) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [null, a.id, a.employee_id, req.currentCycle?.cycle_name || null, achievement_value, progress_status, completion_date]
        );

        await auditLogger({
          goal_id: null,
          changed_by: req.user.email,
          action: "Shared Checkin Propagated",
          field_changed: "propagate",
          old_value: "",
          new_value: JSON.stringify({ assignment_id: a.id, achievement_value }),
        });

        results.push({ assignment_id: a.id, employee_id: a.employee_id, skipped: false });
      }

      res.json({ message: "Propagated to assignees", count: results.length });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Server Error" });
    }
  }
);
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const {
      employee_id,
      title,
      description,
      thrust_area,
      uom_type,
      target_value,
      weightage,
    } = req.body;
    const existingGoals = await pool.query(
      "SELECT * FROM goals WHERE employee_id=$1",
      [employee_id]
    );
    if (existingGoals.rows.length >= 8) {
      return res.status(400).json({
        message: "Maximum 8 goals allowed",
      });
    }
    const numericWeightage = Number(weightage);
    if (Number.isNaN(numericWeightage)) {
      return res.status(400).json({
        message: "Invalid weightage",
      });
    }
    if (numericWeightage < 10) {
      return res.status(400).json({
        message: "Minimum weightage is 10%",
      });
    }
    let totalWeightage = numericWeightage;
    existingGoals.rows.forEach((goal) => {
      totalWeightage += Number(goal.weightage) || 0;
    });

    // include any shared goals already assigned to this employee
    const sharedAssignments = await pool.query(
      "SELECT * FROM shared_goal_assignments WHERE employee_id=$1",
      [employee_id]
    );

    sharedAssignments.rows.forEach((sga) => {
      totalWeightage += Number(sga.weightage) || 0;
    });

    if (totalWeightage > 100) {
      return res.status(400).json({
        message: "Total weightage cannot exceed 100%",
      });
    }

    const lockedGoals = existingGoals.rows.find((goal) => goal.locked === true);

    if (lockedGoals) {
      return res.status(400).json({
        message: "Goals are locked by manager",
      });
    }
    const newGoal = await pool.query(
      `INSERT INTO goals
      (employee_id, title, description, thrust_area, uom_type, target_value, weightage)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *`,
      [employee_id, title, description, thrust_area, uom_type, target_value, numericWeightage]
    );
    await auditLogger({
      goal_id: newGoal.rows[0].id,
      changed_by: req.user.email,
      action: "Goal Created",
      field_changed: "create",
      old_value: "",
      new_value: JSON.stringify({ weightage: numericWeightage, target_value }),
    });

    res.json(newGoal.rows[0]);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
});

router.get("/shared/:employeeId", authMiddleware, async (req, res) => {
  try {

    const goals = await pool.query(
      `
      SELECT
      sga.id,
      sg.title,
      sg.description,
      sg.thrust_area,
      sg.uom_type,
      sg.target_value,
      sga.weightage,
      sga.progress_status,
      sga.achievement_value,
      UPPER(TRIM(COALESCE(sg.uom_type, ''))) AS normalized_uom,
      NULLIF(TRIM(COALESCE(sg.target_value::text, '')), '') AS normalized_target,
      NULLIF(TRIM(COALESCE(sga.achievement_value, '')), '') AS normalized_achievement,
      CASE
        WHEN UPPER(TRIM(COALESCE(sg.uom_type, ''))) = 'MIN' AND NULLIF(TRIM(COALESCE(sg.target_value::text, '')), '') ~ '^[0-9]+(\.[0-9]+)?$' AND NULLIF(TRIM(COALESCE(sga.achievement_value, '')), '') ~ '^[0-9]+(\.[0-9]+)?$' AND NULLIF(TRIM(COALESCE(sg.target_value::text, '')), '')::numeric <> 0 THEN
          ROUND((NULLIF(TRIM(COALESCE(sga.achievement_value, '')), '')::numeric / NULLIF(TRIM(COALESCE(sg.target_value::text, '')), '')::numeric) * 100)
        WHEN UPPER(TRIM(COALESCE(sg.uom_type, ''))) = 'MAX' AND NULLIF(TRIM(COALESCE(sg.target_value::text, '')), '') ~ '^[0-9]+(\.[0-9]+)?$' AND NULLIF(TRIM(COALESCE(sga.achievement_value, '')), '') ~ '^[0-9]+(\.[0-9]+)?$' AND NULLIF(TRIM(COALESCE(sga.achievement_value, '')), '')::numeric <> 0 THEN
          ROUND((NULLIF(TRIM(COALESCE(sg.target_value::text, '')), '')::numeric / NULLIF(TRIM(COALESCE(sga.achievement_value, '')), '')::numeric) * 100)
        WHEN UPPER(TRIM(COALESCE(sg.uom_type, ''))) = 'ZERO' AND NULLIF(TRIM(COALESCE(sga.achievement_value, '')), '') ~ '^[0-9]+(\.[0-9]+)?$' THEN
          CASE WHEN NULLIF(TRIM(COALESCE(sga.achievement_value, '')), '')::numeric = 0 THEN 100 ELSE 0 END
        WHEN UPPER(TRIM(COALESCE(sg.uom_type, ''))) = 'TIMELINE' THEN
          CASE WHEN sga.progress_status = 'Completed' THEN 100 ELSE 50 END
        WHEN NULLIF(TRIM(COALESCE(sga.achievement_value, '')), '') ~ '^[0-9]+(\.[0-9]+)?$' THEN
          ROUND(NULLIF(TRIM(COALESCE(sga.achievement_value, '')), '')::numeric)
        ELSE 0
      END::int AS progress_score,
      true AS assigned
      FROM shared_goal_assignments sga
      JOIN shared_goals sg
      ON sga.shared_goal_id = sg.id
      WHERE sga.employee_id=$1
      `,
      [req.params.employeeId]
    );

    res.json(goals.rows);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });

  }

});
router.post(
  "/checkin/:goalId",
  authMiddleware,
  quarterMiddleware,
  async (req, res) => {

    try {

      const {
        achievement_value,
        progress_status,
        completion_date,
      } = req.body;

      const goalResult = await pool.query(
        `
        SELECT * FROM goals
        WHERE id=$1
        `,
        [req.params.goalId]
      );

      const goal = goalResult.rows[0];

      let progress_score = 0;

      if (
        goal.uom_type === "MIN"
      ) {

        progress_score =
          (
            Number(achievement_value) /
            Number(goal.target_value)
          ) * 100;

      }

      else if (
        goal.uom_type === "MAX"
      ) {

        progress_score =
          (
            Number(goal.target_value) /
            Number(achievement_value)
          ) * 100;

      }

      else if (
        goal.uom_type === "ZERO"
      ) {

        progress_score =
          Number(achievement_value) === 0
            ? 100
            : 0;

      }

      else if (
        goal.uom_type === "TIMELINE"
      ) {

        if (
          completion_date &&
          goal.deadline
        ) {

          const completed =
            new Date(completion_date);

          const deadline =
            new Date(goal.deadline);

          progress_score =
            completed <= deadline
              ? 100
              : 50;

        }

      }

      progress_score =
        Math.round(progress_score);

      await pool.query(
        `
        INSERT INTO checkins
        (
          goal_id,
          shared_assignment_id,
          employee_id,
          quarter,
          achievement_value,
          progress_status,
          completion_date
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        `,
        [
          req.params.goalId,
          null,
          goal.employee_id,
          req.currentCycle.cycle_name,
          achievement_value,
          progress_status,
          completion_date,
        ]
      );
      const oldGoalData =
        await pool.query(
            `
            SELECT * FROM goals
            WHERE id=$1
            `,
            [req.params.goalId]
        );

      await pool.query(
        `
        UPDATE goals
        SET
        achievement_value=$1,
        progress_status=$2,
        progress_score=$3
        WHERE id=$4
        `,
        [
          achievement_value,
          progress_status,
          progress_score,
          req.params.goalId,
        ]
      );
      await auditLogger({
        goal_id: req.params.goalId,
        changed_by: req.user.email,
        action: "Quarterly Update",
        field_changed: "achievement_value",
        old_value:
            oldGoalData.rows[0]
            .achievement_value || "",
        new_value:
            achievement_value,
        });
      res.json({
        message:
          "Quarterly check-in submitted",
      });

    } catch (error) {

      console.log(error);

      res.status(500).json({
        message: "Server Error",
      });

    }

  }
);
router.put(
  "/manager/comment/:checkinId",
  authMiddleware,
  requireRole("manager"),
  async (req, res) => {

    try {

      const { manager_comment } = req.body;

      await pool.query(
        `
        UPDATE checkins
        SET manager_comment=$1
        WHERE id=$2
        `,
        [
          manager_comment,
          req.params.checkinId,
        ]
      );

      res.json({
        message:
          "Comment Added",
      });

    } catch (error) {

      console.log(error);

      res.status(500).json({
        message: "Server Error",
      });

    }

  }
);
router.get(
  "/manager/checkins",
  authMiddleware,
  requireRole("manager"),
  async (req, res) => {

    try {

      const result = await pool.query(
        `
        SELECT id, goal_id, shared_assignment_id, quarter, achievement_value, progress_status, manager_comment, title, target_value, submitted_at
        FROM (
          SELECT c.id, c.goal_id, NULL::int AS shared_assignment_id, c.quarter, c.achievement_value, c.progress_status, c.manager_comment, g.title, g.target_value, c.submitted_at
          FROM checkins c
          JOIN goals g ON c.goal_id = g.id
          WHERE c.goal_id IS NOT NULL
          UNION ALL
          SELECT c.id, sga.shared_goal_id AS goal_id, c.shared_assignment_id, c.quarter, c.achievement_value, c.progress_status, c.manager_comment, sg.title, sg.target_value, c.submitted_at
          FROM checkins c
          JOIN shared_goal_assignments sga ON c.shared_assignment_id = sga.id
          JOIN shared_goals sg ON sga.shared_goal_id = sg.id
          WHERE c.shared_assignment_id IS NOT NULL
        ) AS combined
        ORDER BY submitted_at DESC
        `
      );

      res.json(result.rows);

    } catch (error) {

      console.log(error);

      res.status(500).json({
        message: "Server Error",
      });

    }

  }
);
router.get(
  "/completion/dashboard",
  authMiddleware,
  async (req, res) => {

    try {

      const result = await pool.query(
        `
        SELECT
        employee_id,
        COUNT(*) AS total_goals,

        COUNT(
          CASE
          WHEN progress_status='Completed'
          THEN 1
          END
        ) AS completed_goals

        FROM goals
        GROUP BY employee_id
        `
      );

      const dashboard =
        result.rows.map((row) => {

          const completion_rate =
            (
              Number(
                row.completed_goals
              ) /
              Number(
                row.total_goals
              )
            ) * 100;

          return {
            ...row,
            completion_rate:
              Math.round(
                completion_rate
              ),
          };

        });

      res.json(dashboard);

    } catch (error) {

      console.log(error);

      res.status(500).json({
        message: "Server Error",
      });

    }

  }
);
router.put(
  "/manager/update/:goalId",
  authMiddleware,
  async (req, res) => {

    try {

      const { target_value, weightage, deadline } = req.body;

      if (deadline !== undefined) {
        const parsed = new Date(deadline);
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({ message: "Invalid deadline (expected YYYY-MM-DD)" });
        }
      }

      const oldGoal = await pool.query(`SELECT * FROM goals WHERE id=$1`, [
        req.params.goalId,
      ]);

      if (oldGoal.rows.length === 0) {
        return res.status(404).json({ message: "Goal not found" });
      }

      const employeeId = oldGoal.rows[0].employee_id;

      let newWeight = oldGoal.rows[0].weightage;

      if (weightage !== undefined) {
        const numericWeightage = Number(weightage);

        if (Number.isNaN(numericWeightage)) {
          return res.status(400).json({ message: "Invalid weightage" });
        }

        // sum other goals and shared assignments
        const otherGoals = await pool.query(
          "SELECT weightage FROM goals WHERE employee_id=$1 AND id<>$2",
          [employeeId, req.params.goalId]
        );

        const existingShared = await pool.query(
          "SELECT weightage FROM shared_goal_assignments WHERE employee_id=$1",
          [employeeId]
        );

        let total = 0;
        otherGoals.rows.forEach((g) => {
          total += Number(g.weightage) || 0;
        });
        existingShared.rows.forEach((s) => {
          total += Number(s.weightage) || 0;
        });

        const projectedTotal = total + numericWeightage;

        if (projectedTotal !== 100) {
          return res.status(400).json({
            message: `Total weightage must equal 100% after update. Current total would be ${projectedTotal}%`,
          });
        }

        newWeight = numericWeightage;
      }

      const newTarget = target_value !== undefined ? target_value : oldGoal.rows[0].target_value;
      const newDeadline = deadline !== undefined ? deadline : oldGoal.rows[0].deadline;

      await pool.query(
        `UPDATE goals SET target_value=$1, weightage=$2, deadline=$3 WHERE id=$4`,
        [newTarget, newWeight, newDeadline, req.params.goalId]
      );

      if (newTarget !== oldGoal.rows[0].target_value) {
        await auditLogger({
          goal_id: req.params.goalId,
          changed_by: req.user.email,
          action: "Manager Updated Goal",
          field_changed: "target_value",
          old_value: oldGoal.rows[0].target_value,
          new_value: newTarget,
        });
      }

      if (newWeight !== oldGoal.rows[0].weightage) {
        await auditLogger({
          goal_id: req.params.goalId,
          changed_by: req.user.email,
          action: "Manager Updated Goal",
          field_changed: "weightage",
          old_value: oldGoal.rows[0].weightage,
          new_value: newWeight,
        });
      }

      if (newDeadline !== oldGoal.rows[0].deadline) {
        await auditLogger({
          goal_id: req.params.goalId,
          changed_by: req.user.email,
          action: "Manager Updated Goal",
          field_changed: "deadline",
          old_value: oldGoal.rows[0].deadline || "",
          new_value: newDeadline,
        });
      }

      res.json({ message: "Goal Updated" });

    } catch (error) {

      console.log(error);

      res.status(500).json({
        message: "Server Error",
      });

    }

  }
);
module.exports = router;