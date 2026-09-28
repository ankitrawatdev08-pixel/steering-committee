/**
 * Verification script for Acceptance Criteria:
 * 1. Start server normally (development) -> GET /health -> confirm nodeEnv: 'development' -> GET /tests -> confirm 200.
 * 2. Stop server. Start with NODE_ENV=production -> GET /health -> confirm nodeEnv: 'production' -> GET /tests -> confirm 404.
 */

const { spawn } = require('child_process');
const path = require('path');

function runTestServer(env, port, callback) {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, '..', 'server.js');
    console.log(`[${new Date().toISOString()}] Launching server with NODE_ENV="${env.NODE_ENV || ''}" on port ${port}...`);
    
    const proc = spawn(process.execPath, [serverPath], {
      env: { ...process.env, ...env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let started = false;

    proc.stdout.on('data', (d) => {
      const msg = d.toString().trim();
      console.log(`[SERVER STDOUT] ${msg}`);
      if (!started && msg.includes('listening on')) {
        started = true;
        // Give it a tiny moment to ensure socket listener is ready
        setTimeout(async () => {
          try {
            await callback(`http://127.0.0.1:${port}`);
            proc.kill();
            resolve();
          } catch (err) {
            proc.kill();
            reject(err);
          }
        }, 100);
      }
    });

    proc.stderr.on('data', (d) => {
      console.error(`[SERVER STDERR] ${d.toString().trim()}`);
    });

    proc.on('error', reject);
    proc.on('exit', (code, signal) => {
      console.log(`[${new Date().toISOString()}] Server on port ${port} exited (code: ${code}, signal: ${signal}).`);
    });
  });
}

async function main() {
  console.log('================================================================');
  console.log('MANDATORY VERIFICATION: NODE_ENV Gating & Endpoint Verification');
  console.log('================================================================\n');

  // STEP 1: DEVELOPMENT MODE
  console.log('>>> TEST CASE 1: Development Mode (Default / NODE_ENV not set)');
  await runTestServer({}, 3000, async (baseUrl) => {
    console.log(`\n--- Fetching GET ${baseUrl}/health ---`);
    const healthRes = await fetch(`${baseUrl}/health`);
    console.log(`HTTP Status: ${healthRes.status} ${healthRes.statusText}`);
    console.log(`Content-Type: ${healthRes.headers.get('content-type')}`);
    const healthBody = await healthRes.json();
    console.log('Response Body:', JSON.stringify(healthBody, null, 2));

    if (healthRes.status !== 200) throw new Error(`Expected 200 for /health, got ${healthRes.status}`);
    if (healthBody.nodeEnv !== 'development') throw new Error(`Expected nodeEnv='development', got ${healthBody.nodeEnv}`);
    if (healthBody.isProduction !== false) throw new Error(`Expected isProduction=false, got ${healthBody.isProduction}`);
    console.log('✔ GET /health confirmed (200 OK, nodeEnv: "development", isProduction: false)');

    console.log(`\n--- Fetching GET ${baseUrl}/tests ---`);
    const testsRes = await fetch(`${baseUrl}/tests`);
    console.log(`HTTP Status: ${testsRes.status} ${testsRes.statusText}`);
    console.log(`Content-Type: ${testsRes.headers.get('content-type')}`);
    const testsBody = await testsRes.text();
    console.log('Response Snippet (first 150 chars):', testsBody.slice(0, 150));

    if (testsRes.status !== 200) throw new Error(`Expected 200 for /tests in dev, got ${testsRes.status}`);
    console.log('✔ GET /tests confirmed (200 OK)');
  });

  console.log('\n----------------------------------------------------------------\n');

  // STEP 2: PRODUCTION MODE
  console.log('>>> TEST CASE 2: Production Mode (NODE_ENV=production)');
  await runTestServer({ NODE_ENV: 'production' }, 3001, async (baseUrl) => {
    console.log(`\n--- Fetching GET ${baseUrl}/health ---`);
    const healthRes = await fetch(`${baseUrl}/health`);
    console.log(`HTTP Status: ${healthRes.status} ${healthRes.statusText}`);
    console.log(`Content-Type: ${healthRes.headers.get('content-type')}`);
    const healthBody = await healthRes.json();
    console.log('Response Body:', JSON.stringify(healthBody, null, 2));

    if (healthRes.status !== 200) throw new Error(`Expected 200 for /health, got ${healthRes.status}`);
    if (healthBody.nodeEnv !== 'production') throw new Error(`Expected nodeEnv='production', got ${healthBody.nodeEnv}`);
    if (healthBody.isProduction !== true) throw new Error(`Expected isProduction=true, got ${healthBody.isProduction}`);
    console.log('✔ GET /health confirmed (200 OK, nodeEnv: "production", isProduction: true)');

    console.log(`\n--- Fetching GET ${baseUrl}/tests ---`);
    const testsRes = await fetch(`${baseUrl}/tests`);
    console.log(`HTTP Status: ${testsRes.status} ${testsRes.statusText}`);
    const testsBody = await testsRes.text();
    console.log('Response Body:', testsBody.slice(0, 150));

    if (testsRes.status !== 404) throw new Error(`Expected 404 for /tests in production, got ${testsRes.status}`);
    console.log('✔ GET /tests confirmed gated (404 Not Found in production)');
  });

  console.log('\n================================================================');
  console.log('ALL ENDPOINT ACCEPTANCE CRITERIA VERIFIED WITH 0 FAILURES');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
