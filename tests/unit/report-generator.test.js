// tests/unit/report-generator.test.js
// Unit tests for report-generator.js

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { generateReport, generateReportFromMetrics } from '../../flake-control-plane/report-generator.js';
import store from '../../runtime/store.js';

const REPORTS_DIR = path.join(process.cwd(), 'generated-reports');

describe('Report Generator', () => {
  // Use unique timestamps for each test to avoid collisions
  let testCounter = 0;

  beforeEach(() => {
    testCounter++;
    store.resetAll();
    // Ensure reports directory exists
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    store.resetAll();
  });

  describe('generateReport', () => {
    it('should generate a markdown report file', () => {
      // Add some test data
      store.addContractResult({
        event_id: 'evt_report_001',
        type: 'payment.succeeded',
        contract_valid: true,
        received_at: new Date().toISOString(),
        validation_details: { valid: true, errors: [] }
      });

      const result = generateReport();

      expect(result.report_id).toBeDefined();
      expect(result.filename).toMatch(/\.md$/);
      expect(result.generated_at).toBeDefined();
      expect(result.size_bytes).toBeGreaterThan(0);

      // Verify file exists
      const filePath = path.join(REPORTS_DIR, result.filename);
      expect(fs.existsSync(filePath)).toBe(true);

      // Clean up
      fs.unlinkSync(filePath);
    });

    it('should include summary section in report', () => {
      store.addContractResult({
        event_id: 'evt_summary_001',
        type: 'payment.succeeded',
        contract_valid: true,
        received_at: new Date().toISOString(),
        validation_details: { valid: true, errors: [] }
      });

      const result = generateReport();
      const content = fs.readFileSync(path.join(REPORTS_DIR, result.filename), 'utf8');

      expect(content).toContain('## Summary');
      expect(content).toContain('Total Webhooks');
      expect(content).toContain('Pass Rate');

      // Clean up
      fs.unlinkSync(path.join(REPORTS_DIR, result.filename));
    });

    it('should include idempotency metrics in report', () => {
      const result = generateReport();
      const content = fs.readFileSync(path.join(REPORTS_DIR, result.filename), 'utf8');

      expect(content).toContain('## Idempotency Metrics');
      expect(content).toContain('Total Unique Events');
      expect(content).toContain('Idempotency Score');

      // Clean up
      fs.unlinkSync(path.join(REPORTS_DIR, result.filename));
    });

    it('should include replay queue status in report', () => {
      const result = generateReport();
      const content = fs.readFileSync(path.join(REPORTS_DIR, result.filename), 'utf8');

      expect(content).toContain('## Replay Queue Status');

      // Clean up
      fs.unlinkSync(path.join(REPORTS_DIR, result.filename));
    });

    it('should include recommendations section in report', () => {
      const result = generateReport();
      const content = fs.readFileSync(path.join(REPORTS_DIR, result.filename), 'utf8');

      expect(content).toContain('## Recommended Actions');

      // Clean up
      fs.unlinkSync(path.join(REPORTS_DIR, result.filename));
    });
  });

  describe('generateReport with violations', () => {
    it('should include violation breakdown for invalid events', () => {
      store.addContractResult({
        event_id: `evt_violation_${testCounter}_${Date.now()}`,
        type: 'payment.succeeded',
        contract_valid: false,
        received_at: new Date().toISOString(),
        validation_details: {
          valid: false,
          errors: [
            { type: 'missing_field', field: 'id', message: 'Missing id field' }
          ]
        }
      });

      const result = generateReport();
      const content = fs.readFileSync(path.join(REPORTS_DIR, result.filename), 'utf8');

      expect(content).toContain('## Contract Violations');
      expect(content).toContain('Missing Field');

      // Clean up
      fs.unlinkSync(path.join(REPORTS_DIR, result.filename));
    });

    it('should track signature mismatch violations', () => {
      store.addContractResult({
        event_id: `evt_sig_${testCounter}_${Date.now()}`,
        type: 'payment.succeeded',
        contract_valid: false,
        received_at: new Date().toISOString(),
        validation_details: {
          valid: false,
          errors: [
            { type: 'signature_mismatch', field: 'signature', message: 'Invalid signature' }
          ]
        }
      });

      const result = generateReport();
      const content = fs.readFileSync(path.join(REPORTS_DIR, result.filename), 'utf8');

      expect(content).toContain('Signature Mismatch');

      // Clean up
      fs.unlinkSync(path.join(REPORTS_DIR, result.filename));
    });

    it('should track stale timestamp violations', () => {
      store.addContractResult({
        event_id: `evt_stale_${testCounter}_${Date.now()}`,
        type: 'payment.succeeded',
        contract_valid: false,
        received_at: new Date().toISOString(),
        validation_details: {
          valid: false,
          errors: [
            { type: 'stale_timestamp', field: 'timestamp', message: 'Timestamp too old' }
          ]
        }
      });

      const result = generateReport();
      const content = fs.readFileSync(path.join(REPORTS_DIR, result.filename), 'utf8');

      expect(content).toContain('Stale Timestamp');

      // Clean up
      fs.unlinkSync(path.join(REPORTS_DIR, result.filename));
    });
  });

  describe('generateReportFromMetrics', () => {
    it('should generate report from metrics object', () => {
      const metrics = {
        total: 100,
        valid: 95,
        invalid: 5,
        duplicates: 10,
        replayQueue: [],
        violations: null
      };

      const report = generateReportFromMetrics(metrics);

      expect(report).toContain('## Summary');
      expect(report).toContain('100');
      expect(report).toContain('95.0%');
    });

    it('should handle empty metrics', () => {
      const metrics = {
        total: 0,
        valid: 0,
        invalid: 0,
        duplicates: 0,
        replayQueue: [],
        violations: null
      };

      const report = generateReportFromMetrics(metrics);

      expect(report).toContain('## Summary');
      expect(report).toContain('0');
    });

    it('should include replay queue in report', () => {
      const metrics = {
        total: 10,
        valid: 10,
        invalid: 0,
        duplicates: 0,
        replayQueue: [
          { id: 'evt_replay_001', type: 'payment.succeeded', age: 3600, status: 'pending' }
        ],
        violations: null
      };

      const report = generateReportFromMetrics(metrics);

      expect(report).toContain('evt_replay_001');
      expect(report).toContain('pending');
    });
  });

  describe('Report formatting', () => {
    it('should format age correctly', () => {
      // Test via generateReportFromMetrics which uses formatAge internally
      const metrics = {
        total: 1,
        valid: 1,
        invalid: 0,
        duplicates: 0,
        replayQueue: [
          { id: `evt_age_${testCounter}_${Date.now()}`, type: 'payment.succeeded', age: 3661, status: 'pending' }
        ],
        violations: null
      };

      const report = generateReportFromMetrics(metrics);

      // 3661 seconds = 1h 1m - the legacy format uses raw seconds
      expect(report).toContain('3661s');
    });

    it('should include date in header', () => {
      const result = generateReport();
      const content = fs.readFileSync(path.join(REPORTS_DIR, result.filename), 'utf8');
      const today = new Date().toISOString().split('T')[0];

      expect(content).toContain(today);

      // Clean up
      fs.unlinkSync(path.join(REPORTS_DIR, result.filename));
    });
  });
});
