import { describe, it, expect } from 'vitest';
import { validateContract } from '../../webhook-consumer/src/contract-validator.js';
import { createSignature } from '../../mock-provider/src/signature-signer.js';
import signatureKeys from '../fixtures/signature-keys.json' with { type: 'json' };

describe('Contract Validator - Header Validation', () => {
  const secret = signatureKeys.validSecret;

  describe('X-Webhook-Signature Header', () => {
    it('should accept valid signature header', () => {
      const payload = validPayload();
      const signature = createSignature(JSON.stringify(payload), secret);
      const headers = { 'x-webhook-signature': signature };

      const result = validateContract(payload, headers, secret);

      expect(result.valid).toBe(true);
      expect(result.validation_details.signature_valid).toBe(true);
    });

    it('should fail when X-Webhook-Signature is missing', () => {
      const payload = validPayload();
      const headers = {};

      const result = validateContract(payload, headers, secret);

      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.error.includes('Missing required header'))).toBeDefined();
      expect(result.validation_details.signature_error).toBeDefined();
    });

    it('should handle case-insensitive header lookup', () => {
      const payload = validPayload();
      const signature = createSignature(JSON.stringify(payload), secret);
      // Express lowercases headers
      const headers = { 'x-webhook-signature': signature };

      const result = validateContract(payload, headers, secret);

      expect(result.validation_details.signature_valid).toBe(true);
    });
  });

  describe('Header with Empty Values', () => {
    it('should fail when signature header is empty string', () => {
      const payload = validPayload();
      const headers = { 'x-webhook-signature': '' };

      const result = validateContract(payload, headers, secret);

      expect(result.valid).toBe(false);
      expect(result.validation_details.signature_valid).toBe(false);
    });
  });
});

function validPayload() {
  return {
    id: 'evt_header_test',
    type: 'payment.succeeded',
    timestamp: new Date().toISOString(),
    data: { amount: 1000 }
  };
}
