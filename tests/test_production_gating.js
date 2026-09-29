const http = require('http');
const { spawn } = require('child_process');
const assert = require('assert');

// Spin up the server with NODE_ENV=production
const serverProcess = spawn('node', ['server.js'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: '3005' }
});

setTimeout(() => {
  // Check /health
  http.get('http://127.0.0.1:3005/health', (res) => {
    assert.strictEqual(res.statusCode, 200, '/health should return 200');
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const parsed = JSON.parse(data);
      assert.strictEqual(parsed.isProduction, true, 'isProduction should be true');
      
      // Check /tests (should be 404 in production)
      http.get('http://127.0.0.1:3005/tests', (res2) => {
        assert.strictEqual(res2.statusCode, 404, '/tests should return 404 in production');
        
        console.log('✔ ASSERTION PASSED: Production gating verified (Health isProduction=true, /tests returns 404).');
        serverProcess.kill('SIGTERM');
        process.exit(0);
      });
    });
  });
}, 1000); // Wait 1s for server to start
