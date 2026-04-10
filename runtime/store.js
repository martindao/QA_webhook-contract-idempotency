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
      signature_mismatch: 0
    }
  });
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

// --- Reset All ---

function resetAll() {
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
      signature_mismatch: 0
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
}

// --- Initialize if missing ---

function ensureRuntimeFiles() {
  if (!fs.existsSync(CONTRACT_RESULTS_FILE)) {
    writeJSON(CONTRACT_RESULTS_FILE, {
      validated_at: null,
      total_webhooks: 0,
      results: [],
      summary: { valid: 0, invalid: 0, pass_rate: 0 },
      violation_breakdown: { missing_field: 0, invalid_type: 0, signature_mismatch: 0 }
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
}

ensureRuntimeFiles();

module.exports = {
  getContractResults,
  saveContractResults,
  getIdempotencyStore,
  saveIdempotencyStore,
  getReplayQueue,
  saveReplayQueue,
  getEventOrdering,
  saveEventOrdering,
  resetAll,
  ensureRuntimeFiles
};
