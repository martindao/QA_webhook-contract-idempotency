// webhook-consumer/src/webhook-handler.js
// HTTP server that receives and processes webhooks

const http = require('http');
const { verifySignature } = require('../../mock-provider/src/signature-signer');
const { validateContract } = require('./contract-validator');
const { isProcessed, markProcessed, getStore } = require('./idempotency-store');
const { handleEvent } = require('./ordering-handler');
const { addToQueue } = require('./replay-queue');
const { saveContractResults, getContractResults } = require('../../runtime/store');

const PORT = 3002;
const SECRET = process.env.WEBHOOK_SECRET || 'webhook-demo-secret-2026';

/**
 * Set cache-busting headers on response
 */
function setCacheHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Content-Type', 'application/json');
}

/**
 * Handle POST /webhook/receive
 */
function handleWebhookReceive(req, res) {
  let body = '';
  
  req.on('data', chunk => {
    body += chunk;
  });
  
  req.on('end', () => {
    try {
      const payload = JSON.parse(body);
      const headers = req.headers;
      
      // Step 1: Validate HMAC signature
      const signature = headers['x-webhook-signature'];
      const payloadString = JSON.stringify(payload);
      const signatureValid = verifySignature(payloadString, signature, SECRET);
      
      if (!signatureValid) {
        // Invalid signature - queue for replay
        addToQueue(payload);
        saveValidationResult(payload, false, [{ field: 'signature', error: 'Signature verification failed' }]);
        
        setCacheHeaders(res);
        res.writeHead(200);
        res.end(JSON.stringify({
          received: true,
          event_id: payload.id || 'unknown',
          processed: false,
          duplicate: false,
          validation_errors: [{ field: 'signature', error: 'Signature verification failed' }]
        }));
        return;
      }
      
      // Step 2: Validate payload contract
      const contractResult = validateContract(payload, headers, SECRET);
      
      if (!contractResult.valid) {
        // Invalid contract - queue for replay
        addToQueue(payload);
        saveValidationResult(payload, false, contractResult.errors);
        
        setCacheHeaders(res);
        res.writeHead(200);
        res.end(JSON.stringify({
          received: true,
          event_id: payload.id || 'unknown',
          processed: false,
          duplicate: false,
          validation_errors: contractResult.errors
        }));
        return;
      }
      
      // Step 3: Check idempotency
      if (isProcessed(payload.id)) {
        // Duplicate event - mark as received but don't process
        const store = getStore();
        const existingEvent = store.processed_events.find(e => e.event_id === payload.id);
        
        markProcessed(payload.id, payload); // Increment receive_count
        
        setCacheHeaders(res);
        res.writeHead(200);
        res.end(JSON.stringify({
          received: true,
          event_id: payload.id,
          processed: false,
          duplicate: true,
          first_processed_at: existingEvent ? existingEvent.first_processed_at : null
        }));
        return;
      }
      
      // Step 4: Handle ordering
      const orderResult = handleEvent(payload);
      
      if (orderResult.held.length > 0) {
        // Event held for later processing
        markProcessed(payload.id, payload);
        saveValidationResult(payload, true, []);
        
        setCacheHeaders(res);
        res.writeHead(200);
        res.end(JSON.stringify({
          received: true,
          event_id: payload.id,
          processed: false,
          held: true
        }));
        return;
      }
      
      // Step 5: Mark as processed
      markProcessed(payload.id, payload);
      
      // Step 6: Save validation results
      saveValidationResult(payload, true, []);
      
      // Step 7: Return success
      setCacheHeaders(res);
      res.writeHead(200);
      res.end(JSON.stringify({
        received: true,
        event_id: payload.id,
        processed: true,
        duplicate: false
      }));
      
    } catch (err) {
      setCacheHeaders(res);
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
}

/**
 * Save validation result to contract-results.json
 */
function saveValidationResult(payload, valid, errors) {
  const results = getContractResults();
  
  results.total_webhooks++;
  results.validated_at = new Date().toISOString();
  
  const result = {
    event_id: payload.id,
    valid: valid,
    timestamp: new Date().toISOString(),
    errors: errors
  };
  
  results.results.push(result);
  
  if (valid) {
    results.summary.valid++;
  } else {
    results.summary.invalid++;
    
    // Track violation breakdown
    for (const err of errors) {
      if (err.field === 'signature') {
        results.violation_breakdown.signature_mismatch++;
      } else if (err.field === 'type') {
        results.violation_breakdown.invalid_type++;
      } else {
        results.violation_breakdown.missing_field++;
      }
    }
  }
  
  // Calculate pass rate
  results.summary.pass_rate = results.total_webhooks > 0
    ? results.summary.valid / results.total_webhooks
    : 0;
  
  saveContractResults(results);
}

/**
 * Handle GET /health
 */
function handleHealth(req, res) {
  setCacheHeaders(res);
  res.writeHead(200);
  res.end(JSON.stringify({ status: 'operational' }));
}

/**
 * Main HTTP server
 */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  if (url.pathname === '/health' && req.method === 'GET') {
    handleHealth(req, res);
    return;
  }
  
  if (url.pathname === '/webhook/receive' && req.method === 'POST') {
    handleWebhookReceive(req, res);
    return;
  }
  
  // 404 for unknown routes
  setCacheHeaders(res);
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Webhook consumer listening on port ${PORT}`);
});

module.exports = { server, handleWebhookReceive, handleHealth };
