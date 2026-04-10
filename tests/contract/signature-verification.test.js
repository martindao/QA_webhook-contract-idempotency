import { describe, it, expect } from 'vitest';
import { validateContract } from '../../webhook-consumer/src/contract-validator.js';
import { createSignature, verifySignature } from '../../mock-provider/src/signature-signer.js';
import signatureKeys from '../fixtures/signature-keys.json' with { type: 'json' };

describe('Contract Validator - Signature Verification', () => {
  const secret = signatureKeys.validSecret;

  describe('Valid Signatures', () => {
    it('should pass with valid HMAC-SHA256 signature', () => {
      const payload = validPayload();
      const payloadString = JSON.stringify(payload);
      const signature = createSignature(payloadString, secret);
      const headers = { 'x-webhook-signature': signature };

      const result = validateContract(payload, headers, secret);

      expect(result.valid).toBe(true);
      expect(result.details.signature_valid).toBe(true);
    });

    it('should verify signature using timing-safe comparison', () => {
      const payload = validPayload();
      const payloadString = JSON.stringify(payload);
      const signature = createSignature(payloadString, secret);

      expect(verifySignature(payloadString, signature, secret)).toBe(true);
    });
  });

  describe('Invalid Signatures', () => {
    it('should fail with wrong secret', () => {
      const payload = validPayload();
      const payloadString = JSON.stringify(payload);
      const signature = createSignature(payloadString, secret);
      const headers = { 'x-webhook-signature': signature };
      const wrongSecret = signatureKeys.invalidSecret;

      const result = validateContract(payload, headers, wrongSecret);

      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'signature')).toBeDefined();
    });

    it('should fail with tampered payload', () => {
      const payload = validPayload();
      const payloadString = JSON.stringify(payload);
      const signature = createSignature(payloadString, secret);
      const headers = { 'x-webhook-signature': signature };

      // Tamper with payload after signing
      const tamperedPayload = { ...payload, data: { amount: 99999 } };

      const result = validateContract(tamperedPayload, headers, secret);

      expect(result.valid).toBe(false);
      expect(result.details.signature_valid).toBe(false);
    });

    it('should fail with malformed signature format', () => {
      const payload = validPayload();
      const headers = { 'x-webhook-signature': 'invalid_format' };

      const result = validateContract(payload, headers, secret);

      expect(result.valid).toBe(false);
      expect(verifySignature(JSON.stringify(payload), 'invalid_format', secret)).toBe(false);
    });
  });

  describe('Missing Signatures', () => {
    it('should fail when signature header is missing', () => {
      const payload = validPayload();
      const headers = {};

      const result = validateContract(payload, headers, secret);

      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'signature')).toBeDefined();
    });

    it('should pass when no secret provided (skip signature check)', () => {
      const payload = validPayload();
      const headers = {};

      const result = validateContract(payload, headers);

      // Should pass since no secret means signature check is skipped
      expect(result.valid).toBe(true);
    });
  });
});

function validPayload() {
  return {
    id: 'evt_sig_test',
    type: 'payment.succeeded',
    timestamp: new Date().toISOString(),
    data: { amount: 1000 }
  };
}
