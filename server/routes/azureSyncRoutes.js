const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');
const { runFullSync } = require('../utils/azureFullSync');

const router = express.Router();

router.post('/azure/sync', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const stats = await runFullSync();
    res.json({ message: 'Azure sync completed', stats });
  } catch (err) {
    console.error('Azure full sync error', err);
    const azureMessage = err?.response?.data?.error?.message;
    const azureCode = err?.response?.data?.error?.code;
    res.status(500).json({
      message: azureMessage || err.message || 'Sync failed',
      code: azureCode || 'SyncFailed',
    });
  }
});

module.exports = router;
