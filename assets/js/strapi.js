const API = 'http://192.168.1.227:1337/api'; // change for prod if needed

async function getStrapi(endpoint, params = {}) {
  const qs = new URLSearchParams({ populate: '*', ...params }).toString();
  const url = `${API}/${endpoint}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  const json = await res.json();
  return json.data; // single type: object, collection: array
}

function firstRecord(data) {
  return Array.isArray(data) ? data[0] : data;
}

function toAttrs(rec) {
  if (!rec) return null;
  return rec.attributes || rec;
}

function mediaUrl(file, base = API.replace('/api', '')) {
  if (!file) return null;
  const url = file.url || file;
  return typeof url === 'string' && url.startsWith('http') ? url : `${base}${url}`;
}

// supports paths with [index], for example Hero_Photos[2].formats.large.url
function getDeep(obj, path) {
  if (!obj || !path) return undefined;
  const norm = path.replace(/\[(\d+)\]/g, '.$1'); // a[0].b -> a.0.b
  return norm.split('.').reduce((acc, key) => acc == null ? acc : acc[key], obj);
}

function setValue(el, value, attr = 'text') {
  const prefix   = el.getAttribute('data-prefix') || '';
  const suffix   = el.getAttribute('data-suffix') || '';
  const fmt      = el.getAttribute('data-format');   // "currency" or "date"
  const locale   = el.getAttribute('data-locale') || 'en-NZ';
  const currency = el.getAttribute('data-currency') || 'NZD';

  let v = value == null ? '' : value;

  // NEW: date formatting
  if (fmt === 'date' && v !== '') {
    // supports ISO like "2025-10-19" or full timestamps
    const d = new Date(v);
    if (!isNaN(d)) {
      const dateStyle = el.getAttribute('data-date-style') || 'medium'; // "short", "medium", "long"
      v = new Intl.DateTimeFormat(locale, { dateStyle }).format(d);
    }
  }

  // existing: currency formatting
  if (fmt === 'currency' && v !== '') {
    const num = Number(v);
    v = Number.isFinite(num)
      ? new Intl.NumberFormat(locale, { style: 'currency', currency }).format(num)
      : v;
  }

  const finalVal = prefix + String(v) + suffix;

  if (attr === 'text') {
    el.textContent = finalVal;
  } else if (attr === 'document-title') {
    document.title = String(v);
    const titleEl = document.querySelector('head > title');
    if (titleEl) titleEl.textContent = String(v);
    const metaTitle = document.querySelector('meta[name="title"]');
    if (metaTitle) metaTitle.setAttribute('content', String(v));
  } else if (['src','href','content','alt','style'].includes(attr)) {
    if (v !== '') el.setAttribute(attr, finalVal);
  } else {
    if (v !== '') el.setAttribute(attr, String(v));
  }
}



function bindSingles(cache) {
  const els = document.querySelectorAll('[data-strapi][data-field]');
  els.forEach(el => {
    // skip anything inside a data-repeat container
    if (el.closest('[data-repeat]')) return;

    const endpoint = el.getAttribute('data-strapi');
    const field = el.getAttribute('data-field');
    const attr = el.getAttribute('data-attr') || 'text';
    const idxAttr = el.getAttribute('data-index');
    const idx = idxAttr != null ? Number(idxAttr) : 0;

    const data = cache[endpoint];
    if (!data) return;

    const rec = Array.isArray(data) ? data[idx] : data;
    const a = toAttrs(rec);
    if (!a) return;

    // optional media handling when the value is a Strapi media relation object
    if (el.hasAttribute('data-media')) {
      const m = getDeep(a, field);
      // Strapi relation form: { data: { attributes: { url } } } or list
      if (m?.data) {
        if (!Array.isArray(m.data)) {
          const url = mediaUrl(m.data.attributes);
          setValue(el, url, el.getAttribute('data-attr') || 'src');
          return;
        }
        const i = Number(el.getAttribute('data-media-index') || 0);
        const file = m.data[i]?.attributes;
        const url = mediaUrl(file);
        setValue(el, url, el.getAttribute('data-attr') || 'src');
        return;
      }
      // if not in the relation shape, fall through to plain value below
    }

    // plain value, supports bracket paths
    let val = getDeep(a, field);

    // simple fallback for images when you point at formats.large.url but it is missing
    if ((val == null || val === '') && /\.formats\.large\.url$/.test(field)) {
      const basePath = field.replace(/\.formats\.large\.url$/, '');
      const obj = getDeep(a, basePath);
      val = obj?.url || val;
    }

    setValue(el, val, attr);
  });
}

function bindRepeats(cache) {
  const containers = document.querySelectorAll('[data-repeat]');
  containers.forEach(c => {
    const endpoint  = c.getAttribute('data-repeat');
    const fieldPath = c.getAttribute('data-repeat-field');
    const unwrap    = c.getAttribute('data-unwrap') === 'children';
    let data = cache[endpoint];
    if (!data) return;

    if (fieldPath) {
      const root = (Array.isArray(data) ? data[0] : data);
      const a = root?.attributes || root;
      data = fieldPath.split('.').reduce((acc, k) => acc?.[k], a);
    }
    if (!Array.isArray(data)) return;

    const limit = Number(c.getAttribute('data-limit') || data.length);
    const template = c.querySelector('template');
    if (!template) return;

    // clear previous instances
    c.querySelectorAll('.__repeat_instance').forEach(n => n.remove());
    if (unwrap) {
      // also remove any previously unwrapped children we created
      c.querySelectorAll('.__repeat_child').forEach(n => n.remove());
    }

    for (let i = 0; i < Math.min(limit, data.length); i++) {
      const rec = data[i];
      const frag = template.content.cloneNode(true);

      // bind all elements inside the fragment
      frag.querySelectorAll('[data-field]').forEach(el => {
        const attr   = el.getAttribute('data-attr') || 'text';
        const path   = el.getAttribute('data-field');
        const prefix = el.getAttribute('data-prefix') || '';
        const suffix = el.getAttribute('data-suffix') || '';
        const val = path.split('.').reduce((acc, k) => acc?.[k], rec);
        setValue(el, val, attr); // uses your upgraded setValue that handles prefix, suffix, currency
      });

      if (unwrap) {
        // append each top-level child directly to the container
        const tmp = document.createElement('div');
        tmp.appendChild(frag);
        // move children out
        Array.from(tmp.childNodes).forEach(node => {
          if (node.nodeType === 1) node.classList.add('__repeat_child');
          c.appendChild(node);
        });
      } else {
        const wrapper = document.createElement('div');
        wrapper.className = '__repeat_instance';
        wrapper.appendChild(frag);
        c.appendChild(wrapper);
      }
    }
  });
}


document.addEventListener('DOMContentLoaded', async () => {
  const endpoints = new Set();
  document.querySelectorAll('[data-strapi]').forEach(el => endpoints.add(el.getAttribute('data-strapi')));
  document.querySelectorAll('[data-repeat]').forEach(el => endpoints.add(el.getAttribute('data-repeat')));

  const cache = {};
  await Promise.all([...endpoints].map(async ep => {
    try { cache[ep] = await getStrapi(ep); } catch (e) { console.error(e); }
  }));

  bindSingles(cache);
  bindRepeats(cache);
});
