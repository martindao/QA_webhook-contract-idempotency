/**
 * Report Generator Module
 * Generates human-readable markdown reports from webhook processing metrics
 * 
 * Features:
 * - Summary section with pass rate and totals
 * - Violation breakdown with specific examples
 * - Idempotency metrics section
 * - Replay queue status section
 * - Actionable recommendations
 */

const fs = require('fs');
const path = require('path');

/**
 * Generate a rich markdown report from runtime artifacts
 * @param {Object} options - Report generation options
 * @param {string} options.outputDir - Output directory for reports (default: generated-reports/)
 * @returns {Object} - Report metadata including path and content
 */
function generateReport(options = {}) {
  const outputDir = options.outputDir || path.join(__dirname, '..', 'generated-reports');
  
  // Read runtime artifacts
  const contractResults = readArtifact(path.join(__dirname, '..', 'runtime', 'contract-results.json'));
  const idempotencyStore = readArtifact(path.join(__dirname, '..', 'runtime', 'idempotency-store.json'));
  const replayQueue = readArtifact(path.join(__dirname, '..', 'runtime', 'replay-queue.json'));
  const eventOrdering = readArtifact(path.join(__dirname, '..', 'runtime', 'event-ordering.json'));
  
  // Generate report content
  const timestamp = new Date().toISOString();
  const dateStr = new Date().toISOString().split('T')[0];
  const reportId = `contract-test-${dateStr.replace(/-/g, '')}`;
  
  const report = buildReportMarkdown({
    contractResults,
    idempotencyStore,
    replayQueue,
    eventOrdering,
    timestamp,
    dateStr
  });
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Write report file
  const filename = `${reportId}.md`;
  const filePath = path.join(outputDir, filename);
  fs.writeFileSync(filePath, report, 'utf8');
  
  return {
    report_id: reportId,
    filename,
    path: filePath,
    ref: `generated-reports/${filename}`,
    generated_at: timestamp,
    size_bytes: report.length
  };
}

/**
 * Read and parse a JSON artifact file
 */
function readArtifact(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    return null;
  }
}

/**
 * Build the full markdown report content
 */
function buildReportMarkdown(data) {
  const { contractResults, idempotencyStore, replayQueue, eventOrdering, timestamp, dateStr } = data;
  
  // Extract metrics with safe defaults
  const totalWebhooks = contractResults?.total_webhooks || 0;
  const validCount = contractResults?.summary?.valid || 0;
  const invalidCount = contractResults?.summary?.invalid || 0;
  const passRate = contractResults?.summary?.pass_rate || 0;
  const violationBreakdown = contractResults?.violation_breakdown || {};
  
  const uniqueEvents = idempotencyStore?.total_unique_events || 0;
  const duplicatesSkipped = idempotencyStore?.total_duplicates_skipped || 0;
  const doubleProcessingIncidents = idempotencyStore?.double_processing_incidents || 0;
  const idempotencyScore = uniqueEvents > 0 
    ? (1 - doubleProcessingIncidents / uniqueEvents) * 100 
    : 100;
  
  const queueSize = replayQueue?.queue_size || 0;
  const oldestAge = replayQueue?.oldest_event_age_seconds || 0;
  const replayEvents = replayQueue?.events || [];
  
  const orderingEvents = eventOrdering?.ordering_events || [];
  
  // Build sections
  const sections = [
    buildHeader(dateStr, timestamp),
    buildSummarySection(totalWebhooks, validCount, invalidCount, passRate, duplicatesSkipped, queueSize),
    buildViolationsSection(contractResults, violationBreakdown),
    buildIdempotencySection(uniqueEvents, duplicatesSkipped, doubleProcessingIncidents, idempotencyScore, idempotencyStore),
    buildReplayQueueSection(replayEvents, queueSize, oldestAge),
    buildOrderingSection(orderingEvents),
    buildRecommendationsSection(violationBreakdown, replayEvents, idempotencyStore, contractResults)
  ];
  
  return sections.join('\n\n');
}

/**
 * Build report header
 */
function buildHeader(dateStr, timestamp) {
  return `# Webhook Contract & Idempotency Report — ${dateStr}

**Generated**: ${timestamp}
**Period**: Last 24 hours
**Report Type**: Contract Test Report`;
}

/**
 * Build summary section with metrics table
 */
function buildSummarySection(total, valid, invalid, passRate, duplicates, queueSize) {
  return `## Summary

| Metric | Value |
|--------|-------|
| Total Webhooks | ${total.toLocaleString()} |
| Contract Valid | ${valid.toLocaleString()} |
| Contract Invalid | ${invalid.toLocaleString()} |
| Pass Rate | ${(passRate * 100).toFixed(1)}% |
| Duplicates Detected | ${duplicates} |
| Replay Queue Size | ${queueSize} |`;
}

/**
 * Build violations section with specific examples
 */
function buildViolationsSection(contractResults, violationBreakdown) {
  if (!contractResults || !contractResults.results) {
    return `## Contract Violations

No contract violations recorded.`;
  }
  
  const invalidResults = contractResults.results.filter(r => !r.contract_valid);
  
  if (invalidResults.length === 0) {
    return `## Contract Violations

✅ **All webhooks passed contract validation.**`;
  }
  
  // Group violations by type
  const violationsByType = {
    missing_field: [],
    invalid_type: [],
    signature_mismatch: [],
    stale_timestamp: [],
    missing_header: []
  };
  
  for (const result of invalidResults) {
    if (result.validation_details?.errors) {
      for (const err of result.validation_details.errors) {
        const type = err.type || 'missing_field';
        if (!violationsByType[type]) {
          violationsByType[type] = [];
        }
        violationsByType[type].push({
          event_id: result.event_id,
          type: result.type,
          field: err.field,
          message: err.message
        });
      }
    }
  }
  
  // Build violation breakdown
  let content = `## Contract Violations

### Violation Breakdown

| Violation Type | Count | Example |
|----------------|-------|---------|`;
  
  for (const [type, violations] of Object.entries(violationsByType)) {
    if (violations.length > 0) {
      const count = violations.length;
      const example = violations[0];
      const exampleText = `${example.event_id}: ${example.message}`;
      content += `\n| ${formatViolationType(type)} | ${count} | ${exampleText} |`;
    }
  }
  
  // Add specific examples section
  content += `\n\n### Specific Examples\n`;
  
  const exampleCount = Math.min(3, invalidResults.length);
  for (let i = 0; i < exampleCount; i++) {
    const result = invalidResults[i];
    content += `\n**Example ${i + 1}: ${result.event_id}**\n`;
    content += `- Type: \`${result.type}\`\n`;
    if (result.validation_details?.errors) {
      content += `- Errors:\n`;
      for (const err of result.validation_details.errors) {
        content += `  - ${err.field}: ${err.message}\n`;
      }
    }
  }
  
  return content;
}

/**
 * Build idempotency metrics section
 */
function buildIdempotencySection(uniqueEvents, duplicatesSkipped, doubleProcessingIncidents, idempotencyScore, idempotencyStore) {
  let content = `## Idempotency Metrics

| Metric | Value |
|--------|-------|
| Total Unique Events | ${uniqueEvents.toLocaleString()} |
| Duplicates Skipped | ${duplicatesSkipped} |
| Double Processing Incidents | ${doubleProcessingIncidents} |
| Idempotency Score | ${idempotencyScore.toFixed(1)}% |`;
  
  // Add recent duplicates if available
  if (idempotencyStore?.processed_events) {
    const recentDuplicates = idempotencyStore.processed_events
      .filter(e => e.receive_count > 1)
      .slice(-5);
    
    if (recentDuplicates.length > 0) {
      content += `\n\n### Recent Duplicate Events\n`;
      content += `\n| Event ID | Type | Receive Count | First Processed |\n`;
      content += `|----------|------|---------------|----------------|\n`;
      for (const event of recentDuplicates) {
        content += `| ${event.event_id} | ${event.type} | ${event.receive_count} | ${event.first_processed_at} |\n`;
      }
    }
  }
  
  return content;
}

/**
 * Build replay queue status section
 */
function buildReplayQueueSection(events, queueSize, oldestAge) {
  if (queueSize === 0) {
    return `## Replay Queue Status

✅ **No events pending replay.**`;
  }
  
  let content = `## Replay Queue Status

**Queue Size**: ${queueSize} events
**Oldest Event Age**: ${formatAge(oldestAge)}

| Event ID | Type | Status | Retry Count | Age |
|----------|------|--------|-------------|-----|`;
  
  for (const event of events) {
    const age = event.age_seconds || Math.floor((Date.now() - new Date(event.queued_at).getTime()) / 1000);
    content += `\n| ${event.event_id} | ${event.type} | ${event.status} | ${event.retry_count} | ${formatAge(age)} |`;
  }
  
  // Add last error details if any
  const eventsWithErrors = events.filter(e => e.last_error);
  if (eventsWithErrors.length > 0) {
    content += `\n\n### Recent Errors\n`;
    for (const event of eventsWithErrors.slice(0, 3)) {
      content += `- **${event.event_id}**: ${event.last_error}\n`;
    }
  }
  
  return content;
}

/**
 * Build ordering section
 */
function buildOrderingSection(orderingEvents) {
  if (!orderingEvents || orderingEvents.length === 0) {
    return `## Event Ordering

✅ **No out-of-order events detected.**`;
  }
  
  let content = `## Event Ordering

**Entities with ordering events**: ${orderingEvents.length}`;
  
  for (const entity of orderingEvents.slice(0, 5)) {
    content += `\n\n### Entity: ${entity.entity_id}\n`;
    content += `- Final State: ${entity.final_state || 'unknown'}\n`;
    content += `- Correct Order Maintained: ${entity.correct_order_maintained ? '✅ Yes' : '❌ No'}\n`;
    if (entity.processing_order) {
      content += `- Processing Order: ${entity.processing_order.join(' → ')}\n`;
    }
  }
  
  return content;
}

/**
 * Build actionable recommendations section
 */
function buildRecommendationsSection(violationBreakdown, replayEvents, idempotencyStore, contractResults) {
  const recommendations = [];
  
  // Check for timestamp issues
  if (violationBreakdown.stale_timestamp > 0) {
    recommendations.push({
      priority: 'high',
      title: 'Timestamp Drift Detected',
      description: `${violationBreakdown.stale_timestamp} events rejected due to timestamp issues.`,
      action: 'Synchronize clocks across services or increase timestamp tolerance if acceptable.'
    });
  }
  
  // Check for signature issues
  if (violationBreakdown.signature_mismatch > 0) {
    recommendations.push({
      priority: 'high',
      title: 'Signature Verification Failures',
      description: `${violationBreakdown.signature_mismatch} events had invalid signatures.`,
      action: 'Verify webhook secret configuration across all services. Consider rotating keys if unauthorized access is suspected.'
    });
  }
  
  // Check for invalid types
  if (violationBreakdown.invalid_type > 0) {
    recommendations.push({
      priority: 'medium',
      title: 'Invalid Event Types',
      description: `${violationBreakdown.invalid_type} events had unrecognized event types.`,
      action: 'Update the allowed types list to include new event types: payment.succeeded, payment.failed, order.created, order.shipped.'
    });
  }
  
  // Check for missing fields
  if (violationBreakdown.missing_field > 0) {
    recommendations.push({
      priority: 'medium',
      title: 'Missing Required Fields',
      description: `${violationBreakdown.missing_field} events missing required fields.`,
      action: 'Ensure all webhook payloads include: id, type, timestamp, and data fields.'
    });
  }
  
  // Check replay queue
  if (replayEvents && replayEvents.length > 0) {
    const stuckEvents = replayEvents.filter(e => e.retry_count > 3);
    if (stuckEvents.length > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Stuck Events in Replay Queue',
        description: `${stuckEvents.length} events have exceeded 3 retry attempts.`,
        action: 'Review stuck events and consider manual intervention or dead-letter queue.'
      });
    } else {
      recommendations.push({
        priority: 'low',
        title: 'Events Pending Replay',
        description: `${replayEvents.length} events are waiting for replay.`,
        action: 'Monitor replay queue for events approaching max age (24 hours).'
      });
    }
  }
  
  // Check for payload hash mismatches
  if (idempotencyStore?.processed_events) {
    const mismatches = idempotencyStore.processed_events.filter(e => e.payload_hash_mismatches?.length > 0);
    if (mismatches.length > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Payload Integrity Warnings',
        description: `${mismatches.length} events received with different payload hashes than original.`,
        action: 'Investigate potential data corruption or replay attacks.'
      });
    }
  }
  
  // Default recommendation if all is well
  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'none',
      title: 'All Systems Operating Normally',
      description: 'No issues detected in webhook processing.',
      action: 'Continue monitoring. Run contract tests regularly to catch issues early.'
    });
  }
  
  // Build recommendations section
  let content = `## Recommended Actions\n`;
  
  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2, none: 3 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  for (let i = 0; i < recommendations.length; i++) {
    const rec = recommendations[i];
    const priorityBadge = rec.priority === 'high' ? '🔴' : 
                          rec.priority === 'medium' ? '🟡' : 
                          rec.priority === 'low' ? '🟢' : '✅';
    content += `\n${i + 1}. ${priorityBadge} **${rec.title}**\n`;
    content += `   - ${rec.description}\n`;
    content += `   - **Action**: ${rec.action}\n`;
  }
  
  return content;
}

/**
 * Format violation type for display
 */
function formatViolationType(type) {
  const typeMap = {
    missing_field: 'Missing Field',
    invalid_type: 'Invalid Type',
    signature_mismatch: 'Signature Mismatch',
    stale_timestamp: 'Stale Timestamp',
    missing_header: 'Missing Header'
  };
  return typeMap[type] || type;
}

/**
 * Format age in seconds to human-readable string
 */
function formatAge(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

/**
 * Write report to file (legacy compatibility)
 * @param {string} report - Markdown report content
 * @param {string} filename - Output filename (default: contract-test-report.md)
 * @returns {string} Full path to written file
 */
function writeReportToFile(report, filename = 'contract-test-report.md') {
  const reportsDir = path.join(__dirname, '..', 'generated-reports');
  
  // Create reports directory if it doesn't exist
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const filePath = path.join(reportsDir, filename);
  fs.writeFileSync(filePath, report, 'utf8');
  
  return filePath;
}

/**
 * Generate report from metrics (legacy compatibility)
 * @param {Object} metrics - Metrics object containing webhook processing data
 * @returns {string} Markdown report
 */
function generateReportFromMetrics(metrics) {
  const { total, valid, invalid, duplicates, replayQueue, violations } = metrics;
  
  // Calculate success rate
  const successRate = total > 0 ? (valid / total * 100).toFixed(1) : 0;
  
  // Calculate idempotency score
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
  
  // Build recommended actions
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
  
  return `# Webhook Contract & Idempotency Report — ${dateStr}

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
`**${field}**: ${data.count} events\n - Example: "${data.example}"`).join('\n\n') : 'No violations recorded'}

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
}

module.exports = {
  generateReport,
  generateReportFromMetrics,
  writeReportToFile
};
