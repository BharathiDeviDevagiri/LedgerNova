import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ledgerline_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle session expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        localStorage.removeItem('ledgerline_token');
        localStorage.removeItem('ledgerline_user');
      }
    }
    return Promise.reject(error);
  }
);

export function generateIdempotencyKey() {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('Secure random number generation is unavailable.');
  }

  if (cryptoApi.randomUUID) return cryptoApi.randomUUID();

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

async function getPayloadFingerprint(payload) {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle || typeof TextEncoder === 'undefined') {
    throw new Error('Secure request fingerprinting is unavailable in this browser.');
  }

  const bytes = new TextEncoder().encode(stableStringify(payload));
  const digest = await cryptoApi.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

function readPendingRequests(storageKey) {
  try {
    const stored = sessionStorage.getItem(storageKey);
    const pending = stored ? JSON.parse(stored) : {};
    if (!pending || typeof pending !== 'object' || Array.isArray(pending)) {
      throw new Error('Invalid pending request data.');
    }
    return pending;
  } catch (error) {
    throw new Error(`Could not read the pending financial request safely: ${error.message}`);
  }
}

async function getOrCreatePendingKey(path, payload) {
  const fingerprint = await getPayloadFingerprint(payload);
  const storageKey = `ledgerline:pending:${path}`;
  const pending = readPendingRequests(storageKey);
  const existingKey = pending[fingerprint];

  if (typeof existingKey === 'string') {
    return { key: existingKey, fingerprint, storageKey };
  }

  const key = generateIdempotencyKey();
  pending[fingerprint] = key;
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(pending));
  } catch (error) {
    throw new Error(`Could not safely save the financial request key: ${error.message}`);
  }

  return { key, fingerprint, storageKey };
}

function clearPendingKey({ fingerprint, storageKey, key }) {
  try {
    const pending = readPendingRequests(storageKey);
    if (pending[fingerprint] !== key) return;

    delete pending[fingerprint];
    if (Object.keys(pending).length === 0) {
      sessionStorage.removeItem(storageKey);
    } else {
      sessionStorage.setItem(storageKey, JSON.stringify(pending));
    }
  } catch (error) {
    console.error('[LedgerLine] Could not clear a completed financial request key.', error);
  }
}

async function postFinancialOperation(path, data, explicitKey) {
  if (explicitKey) {
    return api.post(path, data, {
      headers: { 'Idempotency-Key': explicitKey },
    });
  }

  const pendingKey = await getOrCreatePendingKey(path, data);
  let response;
  try {
    response = await api.post(path, data, {
      headers: { 'Idempotency-Key': pendingKey.key },
    });
  } catch (error) {
    if (error.response && error.response.status < 500) {
      clearPendingKey(pendingKey);
    }
    throw error;
  }

  clearPendingKey(pendingKey);
  return response;
}

// API Service Methods
export const authService = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (fullName, email, password) => api.post('/auth/register', { fullName, email, password }),
  getMe: () => api.get('/auth/me'),
};

export const accountService = {
  getAccounts: () => api.get('/accounts'),
  getAccount: (id) => api.get(`/accounts/${id}`),
  createAccount: (name) => api.post('/accounts', { name }),
  getStatement: (id, params) => api.get(`/accounts/${id}/statement`, { params }),
};

export const transactionService = {
  deposit: (data, idempotencyKey) =>
    postFinancialOperation('/transactions/deposit', data, idempotencyKey),
  withdraw: (data, idempotencyKey) =>
    postFinancialOperation('/transactions/withdraw', data, idempotencyKey),
  transfer: (data, idempotencyKey) =>
    postFinancialOperation('/transactions/transfer', data, idempotencyKey),
  getTransactions: (params) => api.get('/transactions', { params }),
  getTransaction: (id) => api.get(`/transactions/${id}`),
};

export const adminService = {
  getMetrics: () => api.get('/admin/metrics'),
  getUsers: () => api.get('/admin/users'),
  updateUserStatus: (id, isActive) => api.patch(`/admin/users/${id}/status`, { isActive }),
};

export const auditService = {
  getAuditLogs: (params) => api.get('/audit-logs', { params }),
};

export const systemService = {
  getHealth: () => api.get('/health'),
};

export default api;
