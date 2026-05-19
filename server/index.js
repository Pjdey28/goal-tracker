const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const goalRoutes = require("./routes/goalRoutes");
const cycleRoutes = require("./routes/cycleRoutes");
const azureAuth = require("./routes/azureAuth");
const azureSyncRoutes = require("./routes/azureSyncRoutes");
const escalationRoutes = require("./routes/escalationRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/cycles", cycleRoutes);
app.use('/auth/azure', azureAuth);
app.use('/api/admin', azureSyncRoutes);
app.use('/api/admin', escalationRoutes);
app.use('/api/admin', analyticsRoutes);
app.get("/", (req, res) => {
  res.send("Server Running");
});

// Serve client build in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientBuildPath));
  app.get('/*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

const { startEscalationScheduler } = require('./utils/escalationService');
startEscalationScheduler();
const { startAnalyticsScheduler } = require('./utils/analyticsScheduler');
startAnalyticsScheduler();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});