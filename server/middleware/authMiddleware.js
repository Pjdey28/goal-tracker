const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {

  try {

    // Allow cron jobs to authenticate via CRON_SECRET header or query param
    const cronSecret = process.env.CRON_SECRET;
    const headerSecret = req.headers['x-cron-secret'];
    const querySecret = req.query.cron_secret;
    if (cronSecret && (headerSecret === cronSecret || querySecret === cronSecret)) {
      req.user = { id: null, role: 'admin', cron: true };
      return next();
    }

    let token = req.header("Authorization");

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // allow 'Bearer <token>' or raw token
    if (token.startsWith("Bearer ")) {
      token = token.slice(7);
    }

    const verified = jwt.verify(
      token,
      process.env.JWT_SECRET || "secretkey"
    );

    req.user = verified;

    next();

  } catch (error) {

    res.status(401).json({
      message: "Invalid token",
    });

  }

};

module.exports = authMiddleware;