// webhook-consumer/src/replay-queue.js
// Queues dropped/failed events for manual replay

const { getReplayQueue, saveReplayQueue } = require('../../runtime/store');

const MAX_AGE_SECONDS = 86400; // 24 hours

/**
 * Add an event to the replay queue
 * @param {Object} event - The webhook event to queue
 * @returns {Object|null} The queued entry or null if duplicate
 */
function addToQueue(event) {
  const queue = getReplayQueue();
  
  // Don't add duplicates
  if (queue.events.find(e => e.event_id === event.id)) {
    return null;
  }
  
  const entry = {
    event_id: event.id,
    type: event.type,
    original_timestamp: event.timestamp,
    queued_at: new Date().toISOString(),
    source: event.source || 'unknown',
    retry_count: 0,
    status: 'pending',
    last_error: null,
    payload: event
  };
  
  queue.events.push(entry);
  saveReplayQueue(queue);
  
  return entry;
}

/**
 * Get all events in the queue with age calculations
 * @returns {Array} Array of events with age_seconds and max_age_exceeded flags
 */
function getQueue() {
  const queue = getReplayQueue();
  const now = Date.now();
  
  return queue.events.map(entry => ({
    ...entry,
    age_seconds: Math.floor((now - new Date(entry.queued_at).getTime()) / 1000),
    max_age_exceeded: isAgedOut(entry)
  }));
}

/**
 * Get count of pending events in queue
 * @returns {number} Count of events with status='pending'
 */
function getQueueSize() {
  const queue = getReplayQueue();
  return queue.events.filter(e => e.status === 'pending').length;
}

/**
 * Mark an event as succeeded or failed after replay attempt
 * @param {string} eventId - The event ID to update
 * @param {boolean} success - Whether the replay succeeded
 * @param {string} [error] - Optional error message if failed
 * @returns {Object|undefined} The updated entry or undefined if not found
 */
function markReplayed(eventId, success, error = null) {
  const queue = getReplayQueue();
  const entry = queue.events.find(e => e.event_id === eventId);
  
  if (entry) {
    entry.status = success ? 'succeeded' : 'failed';
    entry.retry_count++;
    if (error) {
      entry.last_error = error;
    }
    saveReplayQueue(queue);
  }
  
  return entry;
}

/**
 * Check if an event has exceeded max age
 * @param {Object} entry - The queue entry to check
 * @returns {boolean} True if age > MAX_AGE_SECONDS
 */
function isAgedOut(entry) {
  const age = (Date.now() - new Date(entry.queued_at).getTime()) / 1000;
  return age > MAX_AGE_SECONDS;
}

/**
 * Clear the replay queue
 */
function reset() {
  saveReplayQueue({
    events: []
  });
}

module.exports = {
  addToQueue,
  getQueue,
  getQueueSize,
  markReplayed,
  isAgedOut,
  reset
};
