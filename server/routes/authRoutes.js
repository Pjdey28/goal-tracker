const express = require("express");
const pool = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();

router.post("/login", async (req, res) => {

  try {

    const { email, password } = req.body;

    const user = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(400).json({
        message: "User not found",
      });
    }

    const validPassword = await bcrypt.compare(
      password,
      user.rows[0].password
    );

    if (!validPassword) {
      return res.status(400).json({
        message: "Invalid password",
      });
    }

        const userRow = user.rows[0];

        const token = jwt.sign(
          {
            id: userRow.id,
            role: userRow.role,
            email: userRow.email,
          },
          process.env.JWT_SECRET || "secretkey",
          { expiresIn: "8h" }
        );

        res.json({
          token,
          user: {
            id: userRow.id,
            role: userRow.role,
            email: userRow.email,
          },
        });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Server error",
    });

  }

});

module.exports = router;