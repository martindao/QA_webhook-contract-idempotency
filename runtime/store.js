// runtime/store.js
// File-backed shared state store for cross-process communication
// All services read/write through this layer instead of in-memory shared objects

const fs = require('fs');
const path = require('path');

const RUNTIME_DIR = path.join(__dirname);
const CONTRACT_RESULTS_FILE = path.join(RUNTIME_DIR, 'contract-results.json');
const IDEMPOTENCY_STORE_FILE = path.join(RUNTIME_DIR, 'idempotency-store.json');
const REPLAY_QUEUE_FILE = path.join(RUNTIME_DIR, 'replay-queue.json');
const EVENT_ORDERING_FILE = path.join(RUNTIME_DIR, 'event-ordering.json');
const LOGS_FILE = path.join(RUNTIME_DIR, 'logs.ndjson');
const SCENARIO_FILE = path.join(RUNTIME_DIR, 'scenario-mode.json');
const ARTIFACTS_DIR = path.join(RUNTIME_DIR, '..', 'generated-reports');

// --- Helpers ---

function readJSON(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function appendNDJSON(filePath, entry) {
  fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf8');
}

function readNDJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (!content) return [];
    return content.split('\n').map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

// --- Contract Results ---

function getContractResults() {
  return readJSON(CONTRACT_RESULTS_FILE, {
    validated_at: null,
    total_webhooks: 0,
    results: [],
    summary: {
      valid: 0,
      invalid: 0,
      pass_rate: 0
    },
    violation_breakdown: {
      missing_field: 0,
      invalid_type: 0,
      signature_mismatch: 0,
      stale_timestamp: 0
    }
  });
}

/**
 * Add a contract result to the results array
 * Ensures the result matches ARTIFACT_SCHEMA.md format
 */
function addContractResult(result) {
  const results = getContractResults();
  
  results.total_webhooks++;
  results.validated_at = new Date().toISOString();
  results.results.push(result);
  
  if (result.contract_valid) {
    results.summary.valid++;
  } else {
    results.summary.invalid++;
    
    // Track violation breakdown from validation_details errors
    if (result.validation_details && result.validation_details.errors) {
      for (const err of result.validation_details.errors) {
        if (err.type === 'signature_mismatch') {
          results.violation_breakdown.signature_mismatch++;
        } else if (err.type === 'invalid_type') {
          results.violation_breakdown.invalid_type++;
        } else if (err.type === 'stale_timestamp') {
          results.violation_breakdown.stale_timestamp++;
        } else {
          results.violation_breakdown.missing_field++;
        }
      }
    }
  }
  
  // Calculate pass rate
  results.summary.pass_rate = results.total_webhooks > 0
    ? results.summary.valid / results.total_webhooks
    : 0;
  
  saveContractResults(results);
  return results;
}

function saveContractResults(data) {
  writeJSON(CONTRACT_RESULTS_FILE, {
    ...data,
    validated_at: data.validated_at || new Date().toISOString()
  });
}

// --- Idempotency Store ---

function getIdempotencyStore() {
  return readJSON(IDEMPOTENCY_STORE_FILE, {
    store_version: '1.0',
    last_updated: null,
    processed_events: [],
    total_unique_events: 0,
    total_duplicates_skipped: 0,
    double_processing_incidents: 0
  });
}

function saveIdempotencyStore(data) {
  writeJSON(IDEMPOTENCY_STORE_FILE, {
    ...data,
    store_version: '1.0',
    last_updated: data.last_updated || new Date().toISOString()
  });
}

// --- Replay Queue ---

function getReplayQueue() {
  return readJSON(REPLAY_QUEUE_FILE, {
    queue_version: '1.0',
    last_updated: null,
    events: [],
    queue_size: 0,
    oldest_event_age_seconds: 0,
    max_age_seconds: 86400
  });
}

function saveReplayQueue(data) {
  writeJSON(REPLAY_QUEUE_FILE, {
    ...data,
    queue_version: '1.0',
    last_updated: data.last_updated || new Date().toISOString(),
    queue_size: data.events ? data.events.length : 0
  });
}

// --- Event Ordering ---

function getEventOrdering() {
  return readJSON(EVENT_ORDERING_FILE, {
    last_updated: null,
    ordering_events: []
  });
}

function saveEventOrdering(data) {
  writeJSON(EVENT_ORDERING_FILE, {
    ...data,
    last_updated: data.last_updated || new Date().toISOString()
  });
}

// --- Logs / Events ---

function logEvent(entry) {
  appendNDJSON(LOGS_FILE, {
    ...entry,
    logged_at: entry.logged_at || new Date().toISOString()
  });
}

function getNewEvents(sinceIndex) {
  const all = readNDJSON(LOGS_FILE);
  return all.slice(sinceIndex);
}

function getEventCount() {
  try {
    const content = fs.readFileSync(LOGS_FILE, 'utf8').trim();
    return content ? content.split('\n').length : 0;
  } catch {
    return 0;
  }
}

// --- Scenario Mode ---

function getScenarioMode() {
  return readJSON(SCENARIO_FILE, { mode: null }).mode;
}

function setScenarioMode(mode) {
  writeJSON(SCENARIO_FILE, { mode, set_at: new Date().toISOString() });
}

// --- Reset All ---

function resetAll() {
  // Clear all runtime JSON files
  writeJSON(CONTRACT_RESULTS_FILE, {
    validated_at: null,
    total_webhooks: 0,
    results: [],
    summary: {
      valid: 0,
      invalid: 0,
      pass_rate: 0
    },
    violation_breakdown: {
      missing_field: 0,
      invalid_type: 0,
      signature_mismatch: 0,
      stale_timestamp: 0
    }
  });

  writeJSON(IDEMPOTENCY_STORE_FILE, {
    store_version: '1.0',
    last_updated: null,
    processed_events: [],
    total_unique_events: 0,
    total_duplicates_skipped: 0,
    double_processing_incidents: 0
  });

  writeJSON(REPLAY_QUEUE_FILE, {
    queue_version: '1.0',
    last_updated: null,
    events: [],
    queue_size: 0,
    oldest_event_age_seconds: 0,
    max_age_seconds: 86400
  });

  writeJSON(EVENT_ORDERING_FILE, {
    last_updated: null,
    ordering_events: []
  });

  // Clear logs file
  fs.writeFileSync(LOGS_FILE, '', 'utf8');

  // Clear scenario mode
  writeJSON(SCENARIO_FILE, { mode: null });

  // Clear artifacts directory (generated-reports/)
  if (fs.existsSync(ARTIFACTS_DIR)) {
    fs.rmSync(ARTIFACTS_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

// --- Initialize if missing ---

function ensureRuntimeFiles() {
  if (!fs.existsSync(CONTRACT_RESULTS_FILE)) {
    writeJSON(CONTRACT_RESULTS_FILE, {
      validated_at: null,
      total_webhooks: 0,
      results: [],
      summary: { valid: 0, invalid: 0, pass_rate: 0 },
      violation_breakdown: { missing_field: 0, invalid_type: 0, signature_mismatch: 0, stale_timestamp: 0 }
    });
  }
  if (!fs.existsSync(IDEMPOTENCY_STORE_FILE)) {
    writeJSON(IDEMPOTENCY_STORE_FILE, {
      store_version: '1.0',
      last_updated: null,
      processed_events: [],
      total_unique_events: 0,
      total_duplicates_skipped: 0,
      double_processing_incidents: 0
    });
  }
  if (!fs.existsSync(REPLAY_QUEUE_FILE)) {
    writeJSON(REPLAY_QUEUE_FILE, {
      queue_version: '1.0',
      last_updated: null,
      events: [],
      queue_size: 0,
      oldest_event_age_seconds: 0,
      max_age_seconds: 86400
    });
  }
  if (!fs.existsSync(EVENT_ORDERING_FILE)) {
    writeJSON(EVENT_ORDERING_FILE, {
      last_updated: null,
      ordering_events: []
    });
  }
  if (!fs.existsSync(LOGS_FILE)) {
    fs.writeFileSync(LOGS_FILE, '', 'utf8');
  }
  if (!fs.existsSync(SCENARIO_FILE)) {
    writeJSON(SCENARIO_FILE, { mode: null });
  }
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
}

ensureRuntimeFiles();

module.exports = {
  getContractResults,
  saveContractResults,
  addContractResult,
  getIdempotencyStore,
  saveIdempotencyStore,
  getReplayQueue,
  saveReplayQueue,
  getEventOrdering,
  saveEventOrdering,
  logEvent,
  getNewEvents,
  getEventCount,
  getScenarioMode,
  setScenarioMode,
  resetAll,
  ensureRuntimeFiles
};
