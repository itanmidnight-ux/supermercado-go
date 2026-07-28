'use strict';
const logger = require('./logger');

const stores = new Map();
const WARN_MS = 3000;

function createStore(name, defaultTTL = 30_000) {
  if (stores.has(name)) return stores.get(name);
  const store = { _data: new Map(), _timers: new Map(), _hits: 0, _miss: 0, _expired: 0 };
  stores.set(name, store);

  function get(key) {
    const now = Date.now();
    const entry = store._data.get(key);
    if (!entry) { store._miss++; return undefined; }
    if (now > entry.expires) {
      store._data.delete(key);
      store._expired++;
      return undefined;
    }
    store._hits++;
    return entry.value;
  }

  function set(key, value, ttl = defaultTTL) {
    store._data.set(key, { value, expires: Date.now() + ttl });
    const existing = store._timers.get(key);
    if (existing) clearTimeout(existing);
    if (ttl < Infinity) {
      store._timers.set(key, setTimeout(() => { store._data.delete(key); store._timers.delete(key); }, ttl).unref());
    }
  }

  function del(key) {
    store._data.delete(key);
    const t = store._timers.get(key);
    if (t) { clearTimeout(t); store._timers.delete(key); }
  }

  function flush() {
    store._data.clear();
    for (const t of store._timers.values()) clearTimeout(t);
    store._timers.clear();
    store._hits = store._miss = store._expired = 0;
  }

  function stats() {
    const total = store._hits + store._miss;
    return { name, size: store._data.size, hits: store._hits, miss: store._miss, expired: store._expired, hitRate: total ? (store._hits / total * 100).toFixed(1) + '%' : '0%' };
  }

  function wrap(key, ttl, fetcher) {
    const cached = get(key);
    if (cached !== undefined) return cached;
    const start = Date.now();
    const result = fetcher();
    if (result && typeof result.then === 'function') {
      return result.then(v => { const elapsed = Date.now() - start; if (elapsed > WARN_MS) logger.warn({ cache: name, key, elapsed }, 'fetcher lento (>3s)'); if (v !== undefined && v !== null) set(key, v, ttl); return v; }).catch(e => { store._miss++; throw e; });
    }
    if (result !== undefined && result !== null) set(key, result, ttl);
    return result;
  }

  store.get = get; store.set = set; store.del = del; store.flush = flush; store.stats = stats;
  store.wrap = wrap;
  return store;
}

function allStats() {
  return [...stores.values()].map(s => s.stats());
}

// Cache preconfiguradas
const productsCache = createStore('products', 30_000);
const settingsCache = createStore('settings', 60_000);

module.exports = { createStore, allStats, productsCache, settingsCache };
