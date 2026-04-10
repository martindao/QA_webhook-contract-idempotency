/**
 * HMAC-SHA256 Signature Module
 * Signs and verifies webhook payloads using Node.js built-in crypto module
 */

const crypto = require('crypto');

const DEFAULT_SECRET = process.env.WEBHOOK_SECRET || 'webhook-demo-secret-2026';

/**
 * Creates an HMAC-SHA256 signature for a payload
 * @param {string} payload - The payload to sign
 * @param {string} secret - The secret key (defaults to WEBHOOK_SECRET env or default)
 * @returns {string} Signature in format 'sha256=<hex_digest>'
 */
function createSignature(payload, secret = DEFAULT_SECRET) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return `sha256=${hmac.digest('hex')}`;
}

/**
 * Verifies an HMAC-SHA256 signature against a payload
 * @param {string} payload - The payload to verify
 * @param {string} signature - The signature to check (format: 'sha256=<hex>')
 * @param {string} secret - The secret key (defaults to WEBHOOK_SECRET env or default)
 * @returns {boolean} True if signature is valid, false otherwise
 */
function verifySignature(payload, signature, secret = DEFAULT_SECRET) {
    // Handle missing or malformed signature
    if (!signature || typeof signature !== 'string') {
        return false;
    }
    
    if (!signature.startsWith('sha256=')) {
        return false;
    }
    
    // Compute expected signature
    const expected = createSignature(payload, secret);
    
    // Use timing-safe comparison to prevent timing attacks
    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expected)
        );
    } catch (err) {
        // Buffers must have same length for timingSafeEqual
        return false;
    }
}

module.exports = {
    createSignature,
    verifySignature
};
