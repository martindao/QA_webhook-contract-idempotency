// webhook-consumer/src/webhook-handler.js
// HTTP server that receives and processes webhooks

const http = require('http');
const { validateContract, createContractResult } = require('./contract-validator');
const { isProcessed, markProcessed, getStore } = require('./idempotency-store');
const { handleEvent } = require('./ordering-handler');
const { addToQueue } = require('./replay-queue');
const { addContractResult, getContractResults } = require('../../runtime/store');

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

      // Step 1: Validate payload contract (includes signature validation)
      const contractResult = validateContract(payload, headers, SECRET);

      if (!contractResult.valid) {
        // Invalid contract - queue for replay
        addToQueue(payload);
        saveValidationResult(payload, contractResult);

        setCacheHeaders(res);
        res.writeHead(200);
        res.end(JSON.stringify({
          received: true,
          event_id: payload.id || 'unknown',
          processed: false,
          duplicate: false,
          contract_valid: false,
          validation_details: contractResult.validation_details,
          validation_errors: contractResult.errors
        }));
        return;
      }

      // Step 2: Check idempotency
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
          contract_valid: true,
          validation_details: contractResult.validation_details,
          first_processed_at: existingEvent ? existingEvent.first_processed_at : null
        }));
        return;
      }

      // Step 3: Handle ordering
      const orderResult = handleEvent(payload);

      if (orderResult.held.length > 0) {
        // Event held for later processing
        markProcessed(payload.id, payload);
        saveValidationResult(payload, contractResult);

        setCacheHeaders(res);
        res.writeHead(200);
        res.end(JSON.stringify({
          received: true,
          event_id: payload.id,
          processed: false,
          held: true,
          contract_valid: true,
          validation_details: contractResult.validation_details
        }));
        return;
      }

      // Step 4: Mark as processed
      markProcessed(payload.id, payload);

      // Step 5: Save validation results
      saveValidationResult(payload, contractResult);

      // Step 6: Return success
      setCacheHeaders(res);
      res.writeHead(200);
      res.end(JSON.stringify({
        received: true,
        event_id: payload.id,
        processed: true,
        duplicate: false,
        contract_valid: true,
        validation_details: contractResult.validation_details
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
 * Now includes full validation_details per ARTIFACT_SCHEMA.md
 */
function saveValidationResult(payload, validationResult) {
  // Create result object matching ARTIFACT_SCHEMA.md
  const result = createContractResult(payload, validationResult);
  
  // Use the store helper to add and save
  addContractResult(result);
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
