/* website/js/notifications.js — Notifications Module
   Polls GET /api/notifications (the backend has no WS push for this — see
   server/src/services/notification.service.js, it only writes to the DB) while
   the tab is visible, and exposes unread count + mark-as-read. */
const Notifications = (() => {
  const POLL_MS = 30000;
  let items = [];
  let unreadCount = 0;
  let listeners = [];
  let pollTimer = null;

  function notifyListeners() {
    listeners.forEach(fn => fn({ items, unreadCount }));
  }

  async function load() {
    if (!Auth.isLogged()) {
      items = [];
      unreadCount = 0;
      notifyListeners();
      return;
    }
    try {
      const res = await App.api('/api/notifications');
      items = res.data || [];
      unreadCount = res.unread_count || 0;
    } catch {
      // Silent — polling will retry; a toast every 30s on a flaky connection would be noisy.
    }
    notifyListeners();
  }

  function getUnreadCount() { return unreadCount; }
  function getAll() { return [...items]; }

  async function markRead(id) {
    const notif = items.find(n => n.id === id);
    if (notif && !notif.read_at) {
      notif.read_at = new Date().toISOString();
      unreadCount = Math.max(0, unreadCount - 1);
      notifyListeners();
    }
    try {
      await App.api('/api/notifications/' + id + '/read', { method: 'POST', headers: Auth.getHeaders() });
    } catch (err) {
      App.toast(err.message, 'error');
    }
  }

  function startPolling() {
    stopPolling();
    load();
    pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && Auth.isLogged()) load();
    }, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function onChange(callback) {
    listeners.push(callback);
    return () => { listeners = listeners.filter(fn => fn !== callback); };
  }

  return { load, getUnreadCount, getAll, markRead, startPolling, stopPolling, onChange };
})();
