/**
 * Contract Validator Module
 * Validates webhook payloads against the contract specification
 */

const { verifySignature } = require('../../mock-provider/src/signature-signer');

const ALLOWED_TYPES = ['payment.succeeded', 'payment.failed', 'order.created', 'order.shipped'];
const TIMESTAMP_TOLERANCE_SECONDS = 300;

/**
 * Validates a webhook payload against the contract specification
 * @param {object} payload - The webhook payload to validate
 * @param {object} headers - The request headers (must include X-Webhook-Signature)
 * @param {string} secret - The secret key for signature verification
 * @returns {object} Validation result with valid, errors, and details
 */
function validateContract(payload, headers, secret) {
    const errors = [];
    const details = {
        id_present: false,
        type_valid: false,
        timestamp_valid: false,
        signature_valid: false,
        timestamp_fresh: false
    };

    // Check required field: id
    if (!payload.id) {
        errors.push({ field: 'id', error: 'Missing required field: id' });
    } else {
        details.id_present = true;
    }

    // Check required field: type
    if (!payload.type) {
        errors.push({ field: 'type', error: 'Missing required field: type' });
    } else if (!ALLOWED_TYPES.includes(payload.type)) {
        errors.push({ field: 'type', error: `Invalid type: '${payload.type}' not in allowed list` });
    } else {
        details.type_valid = true;
    }

    // Check required field: timestamp
    if (!payload.timestamp) {
        errors.push({ field: 'timestamp', error: 'Missing required field: timestamp' });
    } else {
        details.timestamp_valid = true;

        // Check timestamp freshness (within 300s)
        const now = Date.now();
        const eventTime = new Date(payload.timestamp).getTime();
        const drift = Math.abs(now - eventTime) / 1000;

        if (drift > TIMESTAMP_TOLERANCE_SECONDS) {
            errors.push({ field: 'timestamp', error: `Timestamp too old: ${Math.floor(drift)} seconds drift` });
        } else {
            details.timestamp_fresh = true;
        }
    }

    // Check required field: data
    if (!payload.data) {
        errors.push({ field: 'data', error: 'Missing required field: data' });
    }

    // Check signature (if headers provided)
    if (headers && headers['x-webhook-signature'] && secret) {
        const payloadString = JSON.stringify(payload);
        const signatureValid = verifySignature(payloadString, headers['x-webhook-signature'], secret);
        if (!signatureValid) {
            errors.push({ field: 'signature', error: 'Signature verification failed' });
        } else {
            details.signature_valid = true;
        }
    } else if (headers && secret) {
        errors.push({ field: 'signature', error: 'Missing required header: X-Webhook-Signature' });
    }

    return {
        valid: errors.length === 0,
        errors,
        details
    };
}

module.exports = {
    validateContract,
    ALLOWED_TYPES,
    TIMESTAMP_TOLERANCE_SECONDS
};
