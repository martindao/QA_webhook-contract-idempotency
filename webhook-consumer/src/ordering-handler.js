// webhook-consumer/src/ordering-handler.js
// Handles out-of-order event delivery by tracking sequence numbers per entity

const { getEventOrdering, saveEventOrdering } = require('../../runtime/store');

/**
 * Derive final state from event type
 * @param {string} eventType - The event type
 * @returns {string} The derived final state
 */
function deriveFinalState(eventType) {
	// Map event types to states
	const stateMap = {
		'order.created': 'created',
		'order.confirmed': 'confirmed',
		'order.shipped': 'shipped',
		'order.delivered': 'delivered',
		'order.cancelled': 'cancelled',
		'payment.succeeded': 'paid',
		'payment.failed': 'payment_failed',
		'payment.refunded': 'refunded'
	};
	return stateMap[eventType] || eventType.split('.').pop() || 'unknown';
}

/**
 * Handle an incoming event, processing or holding based on sequence order
 * @param {Object} event - The event to process
 * @param {string} event.id - Event ID
 * @param {string} event.entity_id - Entity ID to group events
 * @param {number} event.sequence - Sequence number for ordering
 * @param {string} event.type - Event type
 * @param {string} event.timestamp - Event timestamp
 * @returns {Object} - { processed: [events], held: [events] }
 */
function handleEvent(event) {
    const state = getEventOrdering();
    const result = { processed: [], held: [] };
    
    // No sequence number or entity_id — process immediately (no ordering constraint)
    if (!event.sequence || !event.entity_id) {
        result.processed.push(event);
        logOrdering(state, event.entity_id || 'none', event.id, event.sequence || 0, 'processed');
        saveEventOrdering(state);
        return result;
    }
    
    const entityId = event.entity_id;
    const now = new Date().toISOString();
    
    // Find or create entity entry in ordering_events
    let entityEntry = state.ordering_events.find(e => e.entity_id === entityId);
    if (!entityEntry) {
        entityEntry = {
            entity_id: entityId,
            events: [],
            expected_sequence: 1,
            pending: [],
            final_state: null,
            processing_order: [],
            correct_order_maintained: true
        };
        state.ordering_events.push(entityEntry);
    }
    
    // Initialize expected_sequence if not present
    if (entityEntry.expected_sequence === undefined) {
        entityEntry.expected_sequence = 1;
    }
    if (!entityEntry.pending) {
        entityEntry.pending = [];
    }
    
    const expectedSeq = entityEntry.expected_sequence;
    
	if (event.sequence === expectedSeq) {
		// Expected sequence — process immediately
		const processedEvent = {
			event_id: event.id,
			type: event.type,
			sequence: event.sequence,
			timestamp: event.timestamp,
			received_at: now,
			processed_at: now
		};
		entityEntry.events.push(processedEvent);
		entityEntry.processing_order.push(event.id);
		result.processed.push(event);
		logOrdering(state, entityId, event.id, event.sequence, 'processed');

		// Update final_state based on event type
		entityEntry.final_state = deriveFinalState(event.type);

		entityEntry.expected_sequence++;
        
	// Check pending events for next in sequence
		while (entityEntry.pending.length > 0) {
			const nextPending = entityEntry.pending.find(e => e.sequence === entityEntry.expected_sequence);
			if (nextPending) {
				// Release held event
				const releasedEvent = {
					event_id: nextPending.event_id,
					type: nextPending.type,
					sequence: nextPending.sequence,
					timestamp: nextPending.timestamp,
					received_at: nextPending.held_at,
					held_until: now,
					processed_at: now
				};
				entityEntry.events.push(releasedEvent);
				entityEntry.processing_order.push(nextPending.event_id);
				result.processed.push(nextPending);
				logOrdering(state, entityId, nextPending.event_id, nextPending.sequence, 'released');

				// Update final_state based on event type
				entityEntry.final_state = deriveFinalState(nextPending.type);

				entityEntry.pending = entityEntry.pending.filter(e => e !== nextPending);
				entityEntry.expected_sequence++;
			} else {
				break;
			}
		}
    } else if (event.sequence > expectedSeq) {
        // Future sequence — hold in pending queue
        const heldEvent = {
            event_id: event.id,
            type: event.type,
            sequence: event.sequence,
            timestamp: event.timestamp,
            held_at: now
        };
        entityEntry.pending.push(heldEvent);
        result.held.push(event);
        logOrdering(state, entityId, event.id, event.sequence, 'held');
    }
    // else: sequence < expected — already processed, skip (duplicate)
    
    saveEventOrdering(state);
    return result;
}

/**
 * Log ordering decision to state
 */
function logOrdering(state, entityId, eventId, sequence, action) {
    // The schema uses ordering_events array, so we log within entity entries
    // Action is tracked via presence in events array and held_until field
    // This function is kept for consistency but logging is inline in handleEvent
}

/**
 * Get all pending events waiting for earlier sequences
 * @returns {Array} - Array of pending events
 */
function getPendingEvents() {
    const state = getEventOrdering();
    const pending = [];
    
    for (const entity of state.ordering_events) {
        if (entity.pending && entity.pending.length > 0) {
            pending.push(...entity.pending.map(p => ({
                event_id: p.event_id,
                type: p.type,
                sequence: p.sequence,
                entity_id: entity.entity_id,
                held_at: p.held_at
            })));
        }
    }
    
    return pending;
}

/**
 * Reset ordering state — clears all tracking data
 */
function reset() {
    saveEventOrdering({
        ordering_events: []
    });
}

module.exports = {
    handleEvent,
    getPendingEvents,
    reset
};
