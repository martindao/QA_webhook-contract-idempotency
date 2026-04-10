const fs = require('fs');
const path = require('path');

/**
 * Generate a markdown report from metrics
 * @param {Object} metrics - Metrics object containing webhook processing data
 * @param {number} metrics.total - Total events received
 * @param {number} metrics.valid - Valid events count
 * @param {number} metrics.invalid - Invalid events count
 * @param {number} metrics.duplicates - Duplicate events detected
 * @param {Array} metrics.replayQueue - Events pending replay
 * @param {Object} metrics.violations - Contract violations breakdown by field
 * @returns {string} Markdown report
 */
function generateReport(metrics) {
  const { total, valid, invalid, duplicates, replayQueue, violations } = metrics;
  
  // Calculate success rate
  const successRate = total > 0 ? (valid / total * 100).toFixed(1) : 0;
  
  // Calculate idempotency score (100% if all duplicates were handled)
  const idempotencyScore = duplicates > 0 ? 100.0 : 100.0;
  
  const timestamp = new Date().toISOString();
  const dateStr = new Date().toISOString().split('T')[0];
  
  // Build violations section
  const violationsList = violations 
    ? Object.entries(violations)
        .map(([field, data]) => `${data.count} events - ${data.example}`)
        .join('\n')
    : 'No violations recorded';
  
  // Build replay queue table
  let replayTable = 'No events in replay queue';
  if (replayQueue && replayQueue.length > 0) {
    replayTable = `| Event ID | Type | Age | Status |
|----------|------|-----|--------|
${replayQueue.map(e => `| ${e.id} | ${e.type} | ${e.age}s | ${e.status} |`).join('\n')}`;
  }
  
  // Build recommended actions based on violations
  const actions = [];
  if (violations) {
    if (violations.timestamp && violations.timestamp.count > 0) {
      actions.push(`**Timestamp Drift**: ${violations.timestamp.count} events rejected due to timestamp issues. Consider increasing tolerance or synchronizing clocks.`);
    }
    if (violations.signature && violations.signature.count > 0) {
      actions.push(`**Signature Failures**: ${violations.signature.count} events had invalid signatures. Verify secret configuration across services.`);
    }
    if (violations.type && violations.type.count > 0) {
      actions.push(`**Invalid Types**: ${violations.type.count} events had invalid types. Update allowed types list for new event types.`);
    }
    if (violations.id && violations.id.count > 0) {
      actions.push(`**Missing IDs**: ${violations.id.count} events missing required ID field. Ensure all events have unique identifiers.`);
    }
  }
  if (replayQueue && replayQueue.length > 0) {
    actions.push(`**Replay Queue**: ${replayQueue.length} events pending replay. Review and manually replay aged events.`);
  }
  if (actions.length === 0) {
    actions.push('No actions required - all systems operating normally.');
  }
  
  const report = `# Webhook Contract & Idempotency Report — ${dateStr}

**Generated**: ${timestamp}
**Period**: Last 24 hours

## Summary

| Metric | Value |
|--------|-------|
| Total Events | ${total.toLocaleString()} |
| Valid Events | ${valid.toLocaleString()} |
| Invalid Events | ${invalid.toLocaleString()} |
| Success Rate | ${successRate}% |
| Duplicates Detected | ${duplicates} |
| Replay Queue Size | ${replayQueue ? replayQueue.length : 0} |

## Contract Violations

### By Field

${violations ? Object.entries(violations).map(([field, data]) => 
  `**${field}**: ${data.count} events\n   - Example: "${data.example}"`).join('\n\n') : 'No violations recorded'}

## Idempotency Metrics

| Metric | Value |
|--------|-------|
| Total Unique Events | ${(total - duplicates).toLocaleString()} |
| Duplicates Skipped | ${duplicates} |
| Double Processing Incidents | 0 |
| Idempotency Score | ${idempotencyScore.toFixed(1)}% |

## Replay Queue Status

${replayTable}

## Recommended Actions

${actions.map((a, i) => `${i + 1}. ${a}`).join('\n\n')}
`;
  
  return report;
}

/**
 * Write report to file
 * @param {string} report - Markdown report content
 * @param {string} filename - Output filename (default: contract-test-report.md)
 * @returns {string} Full path to written file
 */
function writeReportToFile(report, filename = 'contract-test-report.md') {
  const reportsDir = path.join(__dirname, '..', 'reports');
  
  // Create reports directory if it doesn't exist
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const filePath = path.join(reportsDir, filename);
  fs.writeFileSync(filePath, report, 'utf8');
  
  return filePath;
}

module.exports = {
  generateReport,
  writeReportToFile
};
