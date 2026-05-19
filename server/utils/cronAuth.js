function cronAuth(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return next();

  const header = req.headers['x-cron-secret'];
  const query = req.query.cron_secret;
  if (header === secret || query === secret) return next();

  return res.status(403).json({ message: 'Forbidden' });
}

module.exports = cronAuth;
