const express = require("express");
const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const router = express.Router();

// List cycles
router.get("/", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, cycle_name, start_date, end_date FROM cycle_config ORDER BY start_date DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Create cycle
router.post("/", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { cycle_name, start_date, end_date } = req.body;
    const created = await pool.query(
      `INSERT INTO cycle_config (cycle_name, start_date, end_date) VALUES ($1,$2,$3) RETURNING *`,
      [cycle_name, start_date, end_date]
    );
    res.json(created.rows[0]);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Update cycle
router.put("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    const { cycle_name, start_date, end_date } = req.body;
    const updated = await pool.query(
      `UPDATE cycle_config SET cycle_name=$1, start_date=$2, end_date=$3 WHERE id=$4 RETURNING *`,
      [cycle_name, start_date, end_date, req.params.id]
    );
    res.json(updated.rows[0]);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Delete cycle
router.delete("/:id", authMiddleware, requireRole("admin"), async (req, res) => {
  try {
    await pool.query(`DELETE FROM cycle_config WHERE id=$1`, [req.params.id]);
    res.json({ message: "Cycle deleted" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Get active cycle
router.get("/active", authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const r = await pool.query(
      `SELECT * FROM cycle_config WHERE $1 BETWEEN start_date AND end_date LIMIT 1`,
      [now]
    );
    res.json(r.rows[0] || null);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
