/**
 * Mock Webhook Provider Server
 * HTTP server for generating and sending webhooks with failure simulation
 */

const http = require('http');
const { generateEvent, generateEvents } = require('./event-generator');
const { 
  sendWebhook, 
  simulateDroppedDelivery,
  simulateDelayedDelivery,
  simulateDuplicateDelivery,
  simulateOutOfOrderDelivery 
} = require('./delivery-simulator');

const PORT = 3001;

// Store for simulation state
const simulationState = {
  dropped: false,
  delay: null,
  duplicate: null,
  outOfOrder: false
};

/**
 * Parses JSON body from request
 * @param {http.IncomingMessage} req - HTTP request
 * @returns {Promise<object>} Parsed JSON body
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Handles health check endpoint
 */
function handleHealth(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'operational' }));
}

/**
 * Handles webhook sending endpoint
 */
async function handleSendWebhook(req, res) {
  try {
    const body = await parseBody(req);
    const event = body.event || generateEvent(body);
    
    const options = {
      simulateDrop: simulationState.dropped,
      simulateDelay: simulationState.delay,
      simulateOutOfOrder: simulationState.outOfOrder
    };
    
    const result = await sendWebhook(event, options);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: result.success,
      eventId: event.id,
      result
    }));
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

/**
 * Handles dropped simulation endpoint
 */
async function handleSimulateDropped(req, res) {
  try {
    const body = await parseBody(req);
    const event = body.event || generateEvent();
    
    const result = await simulateDroppedDelivery(event);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      simulated: 'dropped',
      eventId: event.id,
      result
    }));
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

/**
 * Handles delayed simulation endpoint
 */
async function handleSimulateDelayed(req, res) {
  try {
    const body = await parseBody(req);
    const delayMs = body.delayMs || body.delay || 5000;
    const event = body.event || generateEvent();
    
    const result = await simulateDelayedDelivery(event, delayMs);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      simulated: 'delayed',
      delayMs,
      eventId: event.id,
      result
    }));
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

/**
 * Handles duplicate simulation endpoint
 */
async function handleSimulateDuplicate(req, res) {
  try {
    const body = await parseBody(req);
    const count = body.count || 3;
    const event = body.event || generateEvent();
    
    const results = await simulateDuplicateDelivery(event, count);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      simulated: 'duplicate',
      count,
      eventId: event.id,
      results
    }));
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

/**
 * Handles out-of-order simulation endpoint
 */
async function handleSimulateOutOfOrder(req, res) {
  try {
    const body = await parseBody(req);
    const events = body.events || generateEvents(3);
    
    const results = await simulateOutOfOrderDelivery(events);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      simulated: 'out-of-order',
      eventCount: events.length,
      results
    }));
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

/**
 * Main request handler
 */
const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;
  
  // Route handling
  if (pathname === '/health' && method === 'GET') {
    handleHealth(req, res);
  } else if (pathname === '/send-webhook' && method === 'POST') {
    await handleSendWebhook(req, res);
  } else if (pathname === '/simulate/dropped' && method === 'POST') {
    await handleSimulateDropped(req, res);
  } else if (pathname === '/simulate/delayed' && method === 'POST') {
    await handleSimulateDelayed(req, res);
  } else if (pathname === '/simulate/duplicate' && method === 'POST') {
    await handleSimulateDuplicate(req, res);
  } else if (pathname === '/simulate/out-of-order' && method === 'POST') {
    await handleSimulateOutOfOrder(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`Mock webhook provider listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Send webhook: POST http://localhost:${PORT}/send-webhook`);
  console.log(`Simulate dropped: POST http://localhost:${PORT}/simulate/dropped`);
  console.log(`Simulate delayed: POST http://localhost:${PORT}/simulate/delayed`);
  console.log(`Simulate duplicate: POST http://localhost:${PORT}/simulate/duplicate`);
  console.log(`Simulate out-of-order: POST http://localhost:${PORT}/simulate/out-of-order`);
});

module.exports = server;
