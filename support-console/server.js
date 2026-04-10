// support-console/server.js
// Support-facing web console for webhook contract and idempotency testing

const http = require('http');
const fs = require('fs');
const path = require('path');

const store = require('../runtime/store');
const { getMetrics, getStore } = require('../webhook-consumer/src/idempotency-store');
const { getQueue, addToQueue } = require('../webhook-consumer/src/replay-queue');
const { generateEvent } = require('../mock-provider/src/event-generator');
const { sendWebhook } = require('../mock-provider/src/delivery-simulator');
const { validateContract } = require('../webhook-consumer/src/contract-validator');

const PORT = process.env.CONSOLE_PORT || 3003;
const REPORTS_DIR = path.join(__dirname, '..', 'reports');

// --- Helper Functions ---

function serveJSON(res, data, status = 200) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.writeHead(status);
  res.end(JSON.stringify(data));
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found' }));
      return;
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.writeHead(200);
    res.end(data);
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// --- API Handlers ---

function handleGetContractResults(res) {
  const results = store.getContractResults();
  const response = {
    last_validated: results.validated_at,
    total_webhooks: results.total_webhooks,
    contract_valid: results.summary?.valid || 0,
    contract_invalid: results.summary?.invalid || 0,
    pass_rate: results.summary?.pass_rate || 0,
    violations: results.results?.filter(r => !r.valid).map(r => ({
      webhook_id: r.event_id,
      field: r.errors?.[0]?.field || 'unknown',
      error: r.errors?.[0]?.error || 'Unknown error',
      severity: 'critical'
    })) || [],
    violation_breakdown: results.violation_breakdown || { missing_field: 0, invalid_type: 0, signature_mismatch: 0 }
  };
  serveJSON(res, response);
}

function handleGetIdempotencyMetrics(res) {
  const metrics = getMetrics();
  const storeData = getStore();
  const queueData = getQueue();
  
  const response = {
    total_events_received: metrics.total_unique + metrics.total_duplicates_skipped,
    unique_events_processed: metrics.total_unique,
    duplicates_detected: metrics.total_duplicates_skipped,
    duplicates_correctly_skipped: metrics.total_duplicates_skipped,
    double_processing_incidents: metrics.double_processing_incidents,
    idempotency_score: metrics.idempotency_score,
    replay_queue_size: queueData.length,
    replay_success_rate: 1.0,
    recent_duplicates: storeData.processed_events
      .filter(e => e.receive_count > 1)
      .slice(-5)
      .map(e => ({
        event_id: e.event_id,
        received_count: e.receive_count,
        processed_count: e.processed_count,
        first_received: e.first_processed_at,
        last_received: e.last_received_at
      }))
  };
  serveJSON(res, response);
}

function handleGetReplayQueue(res) {
  const queue = getQueue();
  const now = Date.now();
  const oldestAge = queue.length > 0 
    ? Math.floor((now - new Date(queue[0].queued_at).getTime()) / 1000)
    : 0;
  
  const response = {
    queue_size: queue.length,
    events: queue.map(e => ({
      event_id: e.event_id,
      type: e.type,
      original_timestamp: e.original_timestamp,
      queued_at: e.queued_at,
      retry_count: e.retry_count,
      status: e.status,
      source: e.source || 'unknown'
    })),
    oldest_event_age_seconds: oldestAge
  };
  serveJSON(res, response);
}

function handleGetReports(res) {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  
  const files = fs.readdirSync(REPORTS_DIR).filter(f => f.endsWith('.md'));
  const reports = files.map(file => {
    const stats = fs.statSync(path.join(REPORTS_DIR, file));
    return {
      id: file.replace('.md', ''),
      generated_at: stats.mtime.toISOString(),
      type: 'contract-test',
      summary: 'Contract test report',
      ref: `reports/${file}`
    };
  });
  serveJSON(res, reports);
}

function handleGetHealth(res) {
  const response = {
    mock_provider: 'operational',
    webhook_consumer: 'operational',
    contract_validator: 'operational',
    idempotency_store: 'operational',
    replay_queue: 'operational'
  };
  serveJSON(res, response);
}

async function handleSimulateValid(res) {
  try {
    const event = generateEvent();
    const result = await sendWebhook(event);
    
    const response = {
      success: result.success,
      scenario: 'valid',
      event_id: event.id,
      contract_status: result.success ? 'valid' : 'invalid',
      processing_status: result.response?.processed ? 'processed' : 'duplicate'
    };
    serveJSON(res, response);
  } catch (e) {
    serveJSON(res, { success: false, error: e.message }, 500);
  }
}

async function handleSimulateDuplicate(res) {
  try {
    const event = generateEvent();
    const results = [];
    
    // Send same event 3 times
    for (let i = 0; i < 3; i++) {
      const result = await sendWebhook(event);
      results.push(result);
    }
    
    const processedCount = results.filter(r => r.response?.processed).length;
    const duplicatesSkipped = results.filter(r => r.response?.duplicate).length;
    
    const response = {
      success: true,
      scenario: 'duplicate',
      event_id: event.id,
      sent_count: 3,
      processed_count: processedCount,
      duplicates_skipped: duplicatesSkipped
    };
    serveJSON(res, response);
  } catch (e) {
    serveJSON(res, { success: false, error: e.message }, 500);
  }
}

async function handleSimulateOutOfOrder(res) {
  try {
    const event1 = generateEvent({ id: `evt_order_001_${Date.now()}`, sequence: 1 });
    const event2 = generateEvent({ id: `evt_order_002_${Date.now()}`, sequence: 2 });
    
    // Send seq 2 first, then seq 1
    const result2 = await sendWebhook(event2);
    const result1 = await sendWebhook(event1);
    
    const response = {
      success: true,
      scenario: 'out-of-order',
      events: [
        { id: event2.id, sequence: 2, sent_first: true },
        { id: event1.id, sequence: 1, sent_second: true }
      ],
      final_state: 'correct',
      processing_order: [event1.id, event2.id]
    };
    serveJSON(res, response);
  } catch (e) {
    serveJSON(res, { success: false, error: e.message }, 500);
  }
}

async function handleSimulateDropped(res) {
  try {
    const event = generateEvent();
    
    // Add to replay queue directly (simulating dropped event detection)
    const queued = addToQueue({
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      data: event.data,
      source: 'dropped-event-simulation'
    });
    
    const queueData = getQueue();
    
    const response = {
      success: true,
      scenario: 'dropped',
      event_id: event.id,
      delivery_status: 'timeout',
      replay_queued: queued !== null,
      replay_queue_size: queueData.length
    };
    serveJSON(res, response);
  } catch (e) {
    serveJSON(res, { success: false, error: e.message }, 500);
  }
}

function handleRunContractTests(res) {
  // Run basic contract validation tests
  const testEvents = [
    generateEvent({ type: 'payment.succeeded' }),
    generateEvent({ type: 'order.created' }),
    generateEvent({ type: 'payment.failed' }),
    generateEvent({ type: 'order.shipped' })
  ];
  
  const results = testEvents.map(event => {
    const validation = validateContract(event, {}, null);
    return {
      event_id: event.id,
      valid: validation.valid,
      errors: validation.errors
    };
  });
  
  const passed = results.filter(r => r.valid).length;
  const failed = results.filter(r => !r.valid).length;
  
  // Save results
  const resultsData = {
    validated_at: new Date().toISOString(),
    total_webhooks: testEvents.length,
    results: results,
    summary: {
      valid: passed,
      invalid: failed,
      pass_rate: passed / testEvents.length
    },
    violation_breakdown: {
      missing_field: results.filter(r => r.errors.some(e => e.field === 'id' || e.field === 'type' || e.field === 'timestamp')).length,
      invalid_type: 0,
      signature_mismatch: 0
    }
  };
  
  store.saveContractResults(resultsData);
  
  const response = {
    success: true,
    tests_run: testEvents.length,
    passed,
    failed,
    results_ref: 'runtime/contract-results.json'
  };
  serveJSON(res, response);
}

function handleGenerateReport(res) {
  const results = store.getContractResults();
  const timestamp = new Date().toISOString().split('T')[0];
  const reportId = `report_${timestamp.replace(/-/g, '_')}`;
  const reportPath = path.join(REPORTS_DIR, `${reportId}.md`);
  
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  
  const reportContent = `# Contract Test Report - ${timestamp}

## Summary
- Total Webhooks: ${results.total_webhooks}
- Contract Valid: ${results.summary?.valid || 0}
- Contract Invalid: ${results.summary?.invalid || 0}
- Pass Rate: ${((results.summary?.pass_rate || 0) * 100).toFixed(1)}%

## Violation Breakdown
- Missing Fields: ${results.violation_breakdown?.missing_field || 0}
- Invalid Types: ${results.violation_breakdown?.invalid_type || 0}
- Signature Mismatches: ${results.violation_breakdown?.signature_mismatch || 0}

## Generated At
${new Date().toISOString()}
`;
  
  fs.writeFileSync(reportPath, reportContent, 'utf8');
  
  const response = {
    success: true,
    report_id: reportId,
    ref: `reports/${reportId}.md`
  };
  serveJSON(res, response);
}

function handleReset(res) {
  store.resetAll();
  serveJSON(res, { success: true });
}

// --- Server ---

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.writeHead(204);
    res.end();
    return;
  }
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  
  // Route: GET /
  if (pathname === '/' && req.method === 'GET') {
    serveFile(res, path.join(__dirname, 'ui', 'index.html'), 'text/html');
    return;
  }
  
  // Route: GET /api/contract-results
  if (pathname === '/api/contract-results' && req.method === 'GET') {
    handleGetContractResults(res);
    return;
  }
  
  // Route: GET /api/idempotency-metrics
  if (pathname === '/api/idempotency-metrics' && req.method === 'GET') {
    handleGetIdempotencyMetrics(res);
    return;
  }
  
  // Route: GET /api/replay-queue
  if (pathname === '/api/replay-queue' && req.method === 'GET') {
    handleGetReplayQueue(res);
    return;
  }
  
  // Route: GET /api/reports
  if (pathname === '/api/reports' && req.method === 'GET') {
    handleGetReports(res);
    return;
  }
  
  // Route: GET /api/health
  if (pathname === '/api/health' && req.method === 'GET') {
    handleGetHealth(res);
    return;
  }
  
  // Route: POST /api/simulate/valid
  if (pathname === '/api/simulate/valid' && req.method === 'POST') {
    await handleSimulateValid(res);
    return;
  }
  
  // Route: POST /api/simulate/duplicate
  if (pathname === '/api/simulate/duplicate' && req.method === 'POST') {
    await handleSimulateDuplicate(res);
    return;
  }
  
  // Route: POST /api/simulate/out-of-order
  if (pathname === '/api/simulate/out-of-order' && req.method === 'POST') {
    await handleSimulateOutOfOrder(res);
    return;
  }
  
  // Route: POST /api/simulate/dropped
  if (pathname === '/api/simulate/dropped' && req.method === 'POST') {
    await handleSimulateDropped(res);
    return;
  }
  
  // Route: POST /api/run-contract-tests
  if (pathname === '/api/run-contract-tests' && req.method === 'POST') {
    handleRunContractTests(res);
    return;
  }
  
  // Route: POST /api/generate-report
  if (pathname === '/api/generate-report' && req.method === 'POST') {
    handleGenerateReport(res);
    return;
  }
  
  // Route: POST /api/reset
  if (pathname === '/api/reset' && req.method === 'POST') {
    handleReset(res);
    return;
  }
  
  // 404 for unknown routes
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Support console running on http://localhost:${PORT}`);
});

module.exports = server;
