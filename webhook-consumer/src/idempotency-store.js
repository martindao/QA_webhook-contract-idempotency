// webhook-consumer/src/idempotency-store.js
// Idempotency store for tracking processed event IDs with metadata

const crypto = require('crypto');
const { getIdempotencyStore, saveIdempotencyStore } = require('../../runtime/store');

/**
 * Check if an event has already been processed
 * @param {string} eventId - The event ID to check
 * @returns {boolean} - True if event was already processed
 */
function isProcessed(eventId) {
  const store = getIdempotencyStore();
  return store.processed_events.some(e => e.event_id === eventId);
}

/**
 * Mark an event as processed, handling duplicates appropriately
 * @param {string} eventId - The event ID
 * @param {object} payload - The event payload
 * @returns {object} - The event record
 */
function markProcessed(eventId, payload) {
  const store = getIdempotencyStore();
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const now = new Date().toISOString();
  
  const existingIndex = store.processed_events.findIndex(e => e.event_id === eventId);
  
  if (existingIndex === -1) {
    // New event - create entry
    const eventRecord = {
      event_id: eventId,
      type: payload.type || 'unknown',
      first_processed_at: now,
      last_received_at: now,
      receive_count: 1,
      processed_count: 1,
      payload_hash: payloadHash,
      data: payload.data || {}
    };
    
    store.processed_events.push(eventRecord);
    store.total_unique_events++;
  } else {
    // Duplicate event
    const existing = store.processed_events[existingIndex];
    existing.last_received_at = now;
    existing.receive_count++;
    store.total_duplicates_skipped++;
    
    // Check for payload mismatch
    if (existing.payload_hash !== payloadHash) {
      console.warn(`[idempotency] Event ${eventId} received with different payload, keeping original`);
      // Don't update payload_hash or data - keep original
    }
  }
  
  saveIdempotencyStore(store);
  return store.processed_events.find(e => e.event_id === eventId);
}

/**
 * Get idempotency metrics
 * @returns {object} - Metrics including idempotency score
 */
function getMetrics() {
  const store = getIdempotencyStore();
  const { total_unique_events, total_duplicates_skipped, double_processing_incidents } = store;
  
  // Calculate idempotency score based on actual metrics
  // Score = 1 - (double_processing_incidents / total_unique_events)
  // If no events processed, score is 1 (perfect)
  const idempotency_score = total_unique_events > 0 
    ? 1 - (double_processing_incidents / total_unique_events) 
    : 1;
  
  return {
    total_unique: total_unique_events,
    total_duplicates_skipped,
    double_processing_incidents,
    idempotency_score
  };
}

/**
 * Get the full store object
 * @returns {object} - The complete idempotency store
 */
function getStore() {
  return getIdempotencyStore();
}

/**
 * Reset the idempotency store
 */
function reset() {
  saveIdempotencyStore({
    store_version: '1.0',
    last_updated: null,
    processed_events: [],
    total_unique_events: 0,
    total_duplicates_skipped: 0,
    double_processing_incidents: 0
  });
}

module.exports = {
  isProcessed,
  markProcessed,
  getMetrics,
  getStore,
  reset
};
