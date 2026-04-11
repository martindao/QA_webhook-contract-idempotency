/**
 * Contract Validator Module
 * Validates webhook payloads against the contract specification
 * 
 * Features:
 * - Per-field validation status (validation_details)
 * - Timing-safe signature comparison (crypto.timingSafeEqual)
 * - Specific error messages for each failure type
 * - Configurable timestamp freshness tolerance
 */

const crypto = require('crypto');

const ALLOWED_TYPES = ['payment.succeeded', 'payment.failed', 'order.created', 'order.shipped'];
const DEFAULT_TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes

/**
 * Validates a webhook payload against the contract specification
 * @param {object} payload - The webhook payload to validate
 * @param {object} headers - The request headers (must include X-Webhook-Signature)
 * @param {string} secret - The secret key for signature verification
 * @param {object} options - Optional configuration
 * @param {number} options.timestampToleranceSeconds - Timestamp tolerance in seconds (default: 300)
 * @returns {object} Validation result with valid, errors, and validation_details
 */
function validateContract(payload, headers, secret, options = {}) {
  const timestampToleranceSeconds = options.timestampToleranceSeconds || DEFAULT_TIMESTAMP_TOLERANCE_SECONDS;
  
  const errors = [];
  const validation_details = {
    id_present: false,
    type_valid: false,
    timestamp_valid: false,
    signature_valid: false,
    timestamp_fresh: false
  };

  // Check required field: id
  if (!payload.id) {
    errors.push({ 
      field: 'id', 
      error: 'Missing required field: id',
      error_type: 'missing_field'
    });
  } else if (typeof payload.id !== 'string' || payload.id.trim() === '') {
    errors.push({ 
      field: 'id', 
      error: `Invalid id: expected non-empty string, got '${typeof payload.id}'`,
      error_type: 'invalid_type'
    });
  } else {
    validation_details.id_present = true;
  }

  // Check required field: type
  if (!payload.type) {
    errors.push({ 
      field: 'type', 
      error: 'Missing required field: type',
      error_type: 'missing_field'
    });
  } else if (typeof payload.type !== 'string') {
    errors.push({ 
      field: 'type', 
      error: `Invalid type: expected string, got '${typeof payload.type}'`,
      error_type: 'invalid_type'
    });
  } else if (!ALLOWED_TYPES.includes(payload.type)) {
    errors.push({ 
      field: 'type', 
      error: `Invalid type: '${payload.type}' not in allowed list [${ALLOWED_TYPES.join(', ')}]`,
      error_type: 'invalid_type'
    });
  } else {
    validation_details.type_valid = true;
  }

  // Check required field: timestamp
  if (!payload.timestamp) {
    errors.push({ 
      field: 'timestamp', 
      error: 'Missing required field: timestamp',
      error_type: 'missing_field'
    });
    validation_details.timestamp_error = 'Missing required field: timestamp';
  } else {
    validation_details.timestamp_valid = true;

    // Check timestamp freshness
    const now = Date.now();
    const eventTime = new Date(payload.timestamp).getTime();
    
    if (isNaN(eventTime)) {
      errors.push({ 
        field: 'timestamp', 
        error: `Invalid timestamp: '${payload.timestamp}' is not a valid ISO 8601 date`,
        error_type: 'invalid_type'
      });
      validation_details.timestamp_valid = false;
      validation_details.timestamp_error = `Invalid timestamp format: '${payload.timestamp}'`;
    } else {
      const driftSeconds = Math.abs(now - eventTime) / 1000;

      if (driftSeconds > timestampToleranceSeconds) {
        const direction = eventTime < now ? 'past' : 'future';
        errors.push({ 
          field: 'timestamp', 
          error: `Timestamp too old: ${Math.floor(driftSeconds)} seconds drift (${direction})`,
          error_type: 'stale_timestamp',
          drift_seconds: Math.floor(driftSeconds),
          direction: direction
        });
        validation_details.timestamp_error = `Timestamp ${Math.floor(driftSeconds)}s drift (${direction}, tolerance: ${timestampToleranceSeconds}s)`;
      } else {
        validation_details.timestamp_fresh = true;
      }
    }
  }

  // Check required field: data
  if (!payload.data) {
    errors.push({ 
      field: 'data', 
      error: 'Missing required field: data',
      error_type: 'missing_field'
    });
  } else if (typeof payload.data !== 'object' || payload.data === null || Array.isArray(payload.data)) {
    errors.push({ 
      field: 'data', 
      error: `Invalid data: expected object, got '${Array.isArray(payload.data) ? 'array' : typeof payload.data}'`,
      error_type: 'invalid_type'
    });
  }

  // Check signature (if headers and secret provided)
  if (headers && secret) {
    const signatureHeader = headers['x-webhook-signature'];
    
    if (!signatureHeader) {
      errors.push({ 
        field: 'signature', 
        error: 'Missing required header: X-Webhook-Signature',
        error_type: 'missing_header'
      });
      validation_details.signature_error = 'Missing required header: X-Webhook-Signature';
    } else {
      const payloadString = JSON.stringify(payload);
      const signatureValid = verifySignatureTimingSafe(payloadString, signatureHeader, secret);
      
      if (!signatureValid) {
        errors.push({ 
          field: 'signature', 
          error: 'Signature verification failed: HMAC mismatch',
          error_type: 'signature_mismatch'
        });
        validation_details.signature_error = 'HMAC signature does not match expected value';
      } else {
        validation_details.signature_valid = true;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    validation_details
  };
}

/**
 * Verifies an HMAC-SHA256 signature using timing-safe comparison
 * This prevents timing attacks where an attacker could determine the correct
 * signature by measuring response times.
 * 
 * @param {string} payload - The payload to verify
 * @param {string} signature - The signature to check (format: 'sha256=<hex>')
 * @param {string} secret - The secret key
 * @returns {boolean} True if signature is valid, false otherwise
 */
function verifySignatureTimingSafe(payload, signature, secret) {
  // Handle missing or malformed signature
  if (!signature || typeof signature !== 'string') {
    return false;
  }

  if (!signature.startsWith('sha256=')) {
    return false;
  }

  // Compute expected signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;

  // Use timing-safe comparison to prevent timing attacks
  try {
    const signatureBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    
    // Buffers must have same length for timingSafeEqual
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (err) {
    // Any error in comparison means invalid signature
    return false;
  }
}

/**
 * Creates a contract result object suitable for storage
 * @param {object} payload - The webhook payload
 * @param {object} validationResult - The validation result from validateContract
 * @returns {object} Contract result object matching ARTIFACT_SCHEMA.md
 */
function createContractResult(payload, validationResult) {
  return {
    event_id: payload.id || 'unknown',
    type: payload.type || 'unknown',
    contract_valid: validationResult.valid,
    validation_details: {
      ...validationResult.validation_details,
      // Include specific error messages for UI display
      ...(validationResult.errors.length > 0 && {
        errors: validationResult.errors.map(e => ({
          field: e.field,
          message: e.error,
          type: e.error_type
        }))
      })
    },
    received_at: new Date().toISOString()
  };
}

module.exports = {
  validateContract,
  verifySignatureTimingSafe,
  createContractResult,
  ALLOWED_TYPES,
  DEFAULT_TIMESTAMP_TOLERANCE_SECONDS
};
