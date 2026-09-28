const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

function startServer(env = {}, port = 3999) {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, '..', 'server.js');
    const child = spawn(process.execPath, [serverPath], {
      env: { ...process.env, ...env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    child.stdout.on('data', (d) => {
      output += d.toString();
      if (output.includes('listening on')) {
        resolve({ child, output });
      }
    });

    child.stderr.on('data', (d) => {
      output += d.toString();
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0 && !output.includes('listening on')) {
        reject(new Error(`Server exited with code ${code}: ${output}`));
      }
    });
  });
}

test('Development mode: /health returns nodeEnv=development and /tests returns 200', async () => {
  const port = 3456;
  const { child } = await startServer({ NODE_ENV: 'development' }, port);

  try {
    // Health check
    const healthRes = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(healthRes.status, 200);
    const healthData = await healthRes.json();
    assert.equal(healthData.status, 'ok');
    assert.equal(healthData.nodeEnv, 'development');
    assert.equal(healthData.isProduction, false);
    assert.ok(typeof healthData.uptime === 'number');

    // Tests endpoint check
    const testsRes = await fetch(`http://127.0.0.1:${port}/tests`);
    assert.equal(testsRes.status, 200);
    const testsText = await testsRes.text();
    assert.ok(testsText.includes('Test Suite'));
  } finally {
    child.kill();
  }
});

test('Production mode: /health returns nodeEnv=production and /tests returns 404', async () => {
  const port = 3457;
  const { child } = await startServer({ NODE_ENV: 'production' }, port);

  try {
    // Health check
    const healthRes = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(healthRes.status, 200);
    const healthData = await healthRes.json();
    assert.equal(healthData.status, 'ok');
    assert.equal(healthData.nodeEnv, 'production');
    assert.equal(healthData.isProduction, true);

    // Tests endpoint must be 404 in production
    const testsRes = await fetch(`http://127.0.0.1:${port}/tests`);
    assert.equal(testsRes.status, 404);
  } finally {
    child.kill();
  }
});
