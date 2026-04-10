/**
 * Event Generator Module
 * Generates realistic webhook events for testing
 */

const EVENT_TYPES = ['payment.succeeded', 'payment.failed', 'order.created', 'order.shipped'];

/**
 * Generates a unique event ID
 * @returns {string} Event ID in format evt_<timestamp>_<random>
 */
function generateEventId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `evt_${timestamp}_${random}`;
}

/**
 * Generates realistic data payload based on event type
 * @param {string} type - Event type
 * @returns {object} Data payload
 */
function generateDataForType(type) {
  if (type.startsWith('payment')) {
    return {
      payment_id: `pay_${Date.now()}`,
      amount: Math.floor(Math.random() * 10000) + 100,
      currency: 'USD',
      order_id: `order_${Date.now()}`
    };
  }
  
  if (type.startsWith('order')) {
    return {
      order_id: `order_${Date.now()}`,
      items: [
        {
          sku: 'item_001',
          quantity: Math.floor(Math.random() * 5) + 1,
          price: Math.floor(Math.random() * 5000) + 100
        }
      ],
      total_amount: Math.floor(Math.random() * 10000) + 500
    };
  }
  
  return {};
}

/**
 * Generates a webhook event
 * @param {object} overrides - Optional overrides for event properties
 * @returns {object} Event object with id, type, timestamp, data
 */
function generateEvent(overrides = {}) {
  const id = overrides.id || generateEventId();
  const type = overrides.type || EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
  
  return {
    id,
    type,
    timestamp: new Date().toISOString(),
    data: generateDataForType(type),
    ...overrides
  };
}

/**
 * Generates multiple events
 * @param {number} count - Number of events to generate
 * @param {object} options - Generation options
 * @returns {array} Array of event objects
 */
function generateEvents(count, options = {}) {
  const events = [];
  for (let i = 0; i < count; i++) {
    events.push(generateEvent(options));
  }
  return events;
}

module.exports = {
  EVENT_TYPES,
  generateEvent,
  generateEvents,
  generateEventId,
  generateDataForType
};
