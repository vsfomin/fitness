(() => {
  if (window.claude && window.claude.use) return;

  let docs = {};
  let refreshPromise = null;
  let refreshQueued = false;
  const listeners = new Set();

  async function request(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.status === 204 ? null : response.json();
  }

  async function refresh() {
    if (refreshPromise) {
      refreshQueued = true;
      return refreshPromise;
    }
    refreshPromise = (async () => {
      do {
        refreshQueued = false;
        docs = await request('/api/state');
        for (const listener of listeners) listener();
      } while (refreshQueued);
    })();
    try {
      await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  }

  function notify() {
    refresh().catch(() => {});
  }

  function docSnapshot(path) {
    const data = docs[path];
    return {exists: data !== undefined, data: () => data};
  }

  function collectionSnapshot(name, field, direction, maximum) {
    const rows = Object.entries(docs)
      .filter(([path]) => path.startsWith(name + '/'))
      .map(([, data]) => data)
      .sort((a, b) => {
        const av = a && a[field], bv = b && b[field];
        if (av === bv) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av < bv ? -1 : 1) * (direction === 'desc' ? -1 : 1);
      })
      .slice(0, maximum);
    return {docs: rows.map(data => ({data: () => data}))};
  }

  function subscribe(path, onNext, onError, makeSnapshot) {
    const listener = () => {
      try { onNext(makeSnapshot()); } catch (error) { if (onError) onError(error); }
    };
    listeners.add(listener);
    refresh().catch(error => { if (onError) onError(error); });
    return () => listeners.delete(listener);
  }

  const db = {
    doc(path) {
      return {
        async set(data) {
          await request(`/api/doc/${path.split('/').map(encodeURIComponent).join('/')}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data),
          });
          await refresh();
        },
        async delete() {
          await request(`/api/doc/${path.split('/').map(encodeURIComponent).join('/')}`, {method: 'DELETE'});
          await refresh();
        },
        onSnapshot(onNext, onError) {
          return subscribe(path, onNext, onError, () => docSnapshot(path));
        },
      };
    },
    collection(name) {
      let field = 'date', direction = 'asc', maximum = 1000;
      const query = {
        orderBy(value, dir) { field = value; direction = dir; return query; },
        limit(value) { maximum = value; return query; },
        onSnapshot(onNext, onError) {
          return subscribe(name, onNext, onError, () => collectionSnapshot(name, field, direction, maximum));
        },
      };
      return query;
    },
  };

  const assets = {
    async upload(blob, options = {}) {
      return request('/api/assets', {
        method: 'POST',
        headers: {'Content-Type': options.type || blob.type || 'application/octet-stream'},
        body: blob,
      });
    },
    async delete(id) {
      await request(`/api/assets/${encodeURIComponent(id)}`, {method: 'DELETE'});
    },
  };

  const events = new EventSource('/api/events');
  events.addEventListener('change', notify);
  events.onerror = () => { setTimeout(notify, 1000); };

  window.claude = {
    async use(name) {
      if (name === 'db') return db;
      if (name === 'assets') return assets;
      return null;
    },
  };
})();
