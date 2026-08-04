/* website/js/addresses.js — Addresses Module (client's saved delivery addresses) */
const Addresses = (() => {
  let items = [];

  async function load() {
    if (!Auth.isLogged() || Auth.getUser().role !== 'client') { items = []; return items; }
    try {
      const res = await App.api('/api/addresses');
      items = res.data || [];
    } catch {
      items = [];
    }
    return items;
  }

  function getAll() { return [...items]; }
  function getDefault() { return items.find(a => a.is_default) || items[0] || null; }

  async function create(data) {
    const res = await App.api('/api/addresses', {
      method: 'POST',
      headers: Auth.getHeaders(),
      body: JSON.stringify(data),
    });
    items.push(res.data);
    if (res.data.is_default) items.forEach(a => { if (a.id !== res.data.id) a.is_default = false; });
    return res.data;
  }

  async function update(id, data) {
    const res = await App.api('/api/addresses/' + id, {
      method: 'PUT',
      headers: Auth.getHeaders(),
      body: JSON.stringify(data),
    });
    items = items.map(a => a.id === id ? res.data : a);
    if (res.data.is_default) items.forEach(a => { if (a.id !== id) a.is_default = false; });
    return res.data;
  }

  async function remove(id) {
    await App.api('/api/addresses/' + id, { method: 'DELETE', headers: Auth.getHeaders() });
    items = items.filter(a => a.id !== id);
  }

  return { load, getAll, getDefault, create, update, remove };
})();
