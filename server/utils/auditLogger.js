const pool = require("../db");

const auditLogger = async ({
  goal_id,
  changed_by,
  action,
  field_changed,
  old_value,
  new_value,
}) => {

  try {

    await pool.query(
      `
      INSERT INTO audit_logs
      (
        goal_id,
        action,
        changed_by,
        field_changed,
        old_value,
        new_value
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      `,
      [
        goal_id,
        action,
        changed_by,
        field_changed,
        old_value,
        new_value,
      ]
    );

  } catch (error) {

    console.log(error);

  }

};

module.exports = auditLogger;