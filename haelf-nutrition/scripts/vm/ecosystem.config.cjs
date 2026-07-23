const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');

function loadEnv(file) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

module.exports = {
  apps: [
    {
      name: 'haelf-expo-tunnel',
      cwd: root,
      script: 'npm',
      args: 'run start:tunnel',
      env: {
        ...loadEnv('.env'),
        ...loadEnv('.env.vm'),
        CI: '1',
      },
      max_restarts: 20,
      restart_delay: 8000,
      exp_backoff_restart_delay: 2000,
    },
  ],
};
