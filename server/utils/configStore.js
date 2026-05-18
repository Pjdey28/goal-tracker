const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, '..', 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'notifications.json');

function ensure() {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_FILE)) fs.writeFileSync(CONFIG_FILE, JSON.stringify({}), 'utf8');
}

function readConfig() {
  ensure();
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    return {};
  }
}

function writeConfig(obj) {
  ensure();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(obj, null, 2), 'utf8');
}

module.exports = { readConfig, writeConfig, CONFIG_FILE };
