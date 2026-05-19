const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');
const cronAuth = require('../utils/cronAuth');
const router = express.Router();
const {
  qoqTrend,
  distribution,
  heatmapByManager,
  managerEffectiveness,
} = require('../utils/analyticsService');

const { ensureAnalyticsMaterializedViews } = require('../utils/analyticsService');

router.get('/analytics/qoq', authMiddleware, requireRole(['admin','manager']), async (req, res) => {
  try {
    const { level, id, limit } = req.query;
    const data = await qoqTrend({ level: level || 'org', id: id ? Number(id) : null, limit: Number(limit) || 12 });
    res.json(data);
  } catch (err) {
    console.error('qoq failed', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.get('/analytics/distribution', authMiddleware, requireRole(['admin','manager']), async (req, res) => {
  try {
    const { by } = req.query;
    const data = await distribution({ by });
    res.json(data);
  } catch (err) {
    console.error('distribution failed', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.get('/analytics/heatmap/managers', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const data = await heatmapByManager();
    res.json(data);
  } catch (err) {
    console.error('heatmap failed', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.get('/analytics/managers', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const data = await managerEffectiveness({ limit });
    res.json(data);
  } catch (err) {
    console.error('managers failed', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.post('/analytics/refresh', cronAuth, authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    await ensureAnalyticsMaterializedViews();
    res.json({ message: 'Materialized views ensured/created' });
  } catch (err) {
    console.error('refresh failed', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Drill-down: list goals for manager in a cycle
router.get('/analytics/manager/:managerId/cycle/:cycleId/goals', authMiddleware, requireRole(['admin','manager']), async (req, res) => {
  try {
    const managerId = Number(req.params.managerId);
    const cycleId = Number(req.params.cycleId);
    const sql = `
      SELECT g.*
      FROM goals g
      JOIN users emp ON emp.id = g.employee_id
      WHERE emp.manager_id = $1
        AND g.created_at BETWEEN (SELECT start_date FROM cycle_config WHERE id=$2) AND (SELECT end_date FROM cycle_config WHERE id=$2)
      ORDER BY g.id DESC
    `;
    const result = await pool.query(sql, [managerId, cycleId]);
    res.json(result.rows);
  } catch (err) {
    console.error('drilldown failed', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Goal detail
router.get('/analytics/goal/:goalId', authMiddleware, requireRole(['admin','manager']), async (req, res) => {
  try {
    const sql = `SELECT g.*, u.email as employee_email FROM goals g LEFT JOIN users u ON u.id = g.employee_id WHERE g.id=$1`;
    const r = await pool.query(sql, [req.params.goalId]);
    res.json(r.rows[0] || null);
  } catch (err) {
    console.error('goal detail failed', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Export CSV for manager+cycle
router.get('/analytics/export/manager/:managerId/cycle/:cycleId', authMiddleware, requireRole(['admin','manager']), async (req, res) => {
  try {
    const managerId = Number(req.params.managerId);
    const cycleId = Number(req.params.cycleId);
    const sql = `
      SELECT g.id, g.title, g.employee_id, u.email as employee_email, g.status, g.progress_status, g.progress_score, g.created_at, g.submitted_at, g.deadline
      FROM goals g
      JOIN users u ON u.id = g.employee_id
      WHERE u.manager_id = $1
        AND g.created_at BETWEEN (SELECT start_date FROM cycle_config WHERE id=$2) AND (SELECT end_date FROM cycle_config WHERE id=$2)
      ORDER BY u.email, g.id DESC
    `;
    const result = await pool.query(sql, [managerId, cycleId]);
    const rows = result.rows;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=manager_${managerId}_cycle_${cycleId}_goals.csv`);
    const header = 'id,title,employee_id,employee_email,status,progress_status,progress_score,created_at,submitted_at,deadline\n';
    const lines = rows.map(r => {
      const esc = (v)=>String(v===null||v===undefined?'':v).replace(/"/g,'""');
      return `"${esc(r.id)}","${esc(r.title)}","${esc(r.employee_id)}","${esc(r.employee_email)}","${esc(r.status)}","${esc(r.progress_status)}","${esc(r.progress_score)}","${esc(r.created_at)}","${esc(r.submitted_at)}","${esc(r.deadline)}"`;
    });
    res.send(header + lines.join('\n'));
  } catch (err) {
    console.error('export failed', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
