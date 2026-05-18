const pool = require("../db");

const quarterMiddleware = async (
  req,
  res,
  next
) => {

  try {

    const today = new Date();

    const result = await pool.query(
      `
      SELECT * FROM cycle_config
      WHERE
      is_active=true
      AND $1 BETWEEN start_date AND end_date
      `,
      [today]
    );

    if (result.rows.length === 0) {

      return res.status(400).json({
        message:
          "Quarter check-in window closed",
      });

    }

    req.currentCycle = result.rows[0];

    next();

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });

  }

};

module.exports = quarterMiddleware;