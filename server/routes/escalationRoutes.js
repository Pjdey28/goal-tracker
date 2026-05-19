const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');
const {
  ensureEscalationSchema,
  loadRules,
  saveRule,
  loadLogs,
  resolveLog,
  runEscalationSweep,
} = require('../utils/escalationService');

const router = express.Router();
const cronAuth = require('../utils/cronAuth');

router.get('/escalations/rules', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const rules = await loadRules();
    res.json(rules);
  } catch (err) {
    console.error('load escalation rules failed', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.put('/escalations/rules/:id', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const updated = await saveRule(req.params.id, req.body || {});
    res.json(updated);
  } catch (err) {
    console.error('save escalation rule failed', err);
    res.status(500).json({ message: err.message || 'Server Error' });
  }
});

router.get('/escalations/logs', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 200;
    const logs = await loadLogs(limit);
    res.json(logs);
  } catch (err) {
    console.error('load escalation logs failed', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.post('/escalations/run', cronAuth, authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const result = await runEscalationSweep();
    res.json(result);
  } catch (err) {
    console.error('manual escalation sweep failed', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.patch('/escalations/logs/:id/resolve', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const resolved = await resolveLog(req.params.id);
    res.json(resolved);
  } catch (err) {
    console.error('resolve escalation log failed', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.post('/escalations/bootstrap', cronAuth, async (req, res) => {
  try {
    await ensureEscalationSchema();
    res.json({ message: 'Escalation schema ready' });
  } catch (err) {
    console.error('bootstrap escalation failed', err);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;