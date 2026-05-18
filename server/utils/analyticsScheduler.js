const { ensureAnalyticsMaterializedViews } = require('./analyticsService');

let started = false;

function msUntilNext(hour = Number(process.env.ANALYTICS_REFRESH_HOUR || 2)) {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(hour, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

function startAnalyticsScheduler() {
  if (started) return;
  started = true;

  const scheduleOnce = async () => {
    try {
      console.log('Analytics scheduler: running materialized view refresh');
      await ensureAnalyticsMaterializedViews();
      console.log('Analytics scheduler: refresh complete');
    } catch (err) {
      console.error('Analytics scheduler: refresh failed', err?.message || err);
    } finally {
      // schedule next run at same hour next day
      setTimeout(scheduleOnce, 24 * 60 * 60 * 1000);
    }
  };

  // initial delay until configured hour
  const delay = msUntilNext();
  console.log(`Analytics scheduler: first run in ${Math.round(delay / 1000 / 60)} minutes`);
  setTimeout(scheduleOnce, delay);
}

module.exports = { startAnalyticsScheduler };
