/**
 * CoreInventory — Shared Frontend Application Logic
 * 
 * API client, auth, toasts, modal helpers.
 * Every page includes this file.
 */

const API_BASE = '/api';
let authToken = localStorage.getItem('ims_token') || null;

/* ─── API CLIENT ─── */
const api = {
    async request(method, path, body = null) {
        const opts = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (authToken) opts.headers['Authorization'] = `Bearer ${authToken}`;
        if (body) opts.body = JSON.stringify(body);

        const res = await fetch(`${API_BASE}${path}`, opts);
        const data = await res.json();

        // Handle unauthorized by redirecting to login
        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('ims_token');
            sessionStorage.removeItem('accessToken');
            window.location.href = 'login.html';
            throw new Error('Session expired. Please login again.');
        }

        if (!res.ok) throw new Error(data.error?.message || data.error || data.message || 'Request failed');
        return data;
    },
    get: (path) => api.request('GET', path),
    post: (path, body) => api.request('POST', path, body),
    patch: (path, body) => api.request('PATCH', path, body),
    put: (path, body) => api.request('PUT', path, body),
    delete: (path) => api.request('DELETE', path),
};

/* ─── AUTH ─── */
async function ensureAuth() {
    authToken = localStorage.getItem('ims_token') || sessionStorage.getItem('accessToken') || null;
    if (!authToken) {
        window.location.href = 'login.html';
        throw new Error('Not authenticated');
    }
}

function logout() {
    localStorage.removeItem('ims_token');
    sessionStorage.removeItem('accessToken');
    authToken = null;
    window.location.href = 'login.html';
}

/* ─── TOAST NOTIFICATIONS ─── */
function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3500);
}

/* ─── MODAL ─── */
function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}
function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
}
// Close modal on overlay click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

/* ─── STATUS BADGE HELPER ─── */
function statusBadge(status) {
    if (!status) return '';
    const s = status.toLowerCase();
    const cls = `badge badge-${s}`;
    return `<span class="${cls}">${status.toUpperCase()}</span>`;
}

/* ─── QTY HELPER ─── */
function qtyHtml(change) {
    const n = Number(change);
    if (n > 0) return `<span class="qty-positive">+${n}</span>`;
    if (n < 0) return `<span class="qty-negative">${n}</span>`;
    return `<span>${n}</span>`;
}

/* ─── LOADING ROW ─── */
function loadingRow(cols) {
    return `<tr class="loading-row"><td colspan="${cols}"><div class="spinner"></div> Loading...</td></tr>`;
}
function emptyRow(cols, msg = 'No records found.') {
    return `<tr class="empty-row"><td colspan="${cols}">${msg}</td></tr>`;
}

/* ─── PRINT ─── */
function printPage() {
    window.print();
}

/* ─── FETCH PRODUCTS (for dropdowns) ─── */
async function fetchProducts() {
    try {
        // Use Person 1's backend API for products
        const data = await api.get('/products');
        return data.data || data || [];
    } catch { return []; }
}

/* ─── FETCH LOCATIONS (for dropdowns) ─── */
async function fetchLocations() {
    try {
        const data = await api.get('/locations');
        return data.data || data || [];
    } catch { return []; }
}

/* ─── INIT: ensure auth on load ─── */
document.addEventListener('DOMContentLoaded', () => {
    ensureAuth();
});
