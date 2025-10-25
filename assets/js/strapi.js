(function () {
  // Public surface
  const StrapiUtil = {
    init,
    get: getStrapi,
  };
  if (!window.StrapiUtil) window.StrapiUtil = StrapiUtil;

  // Config
  const API_BASE = 'https://admin.thesailandanchor.co.nz';
  const API = API_BASE.replace(/\/$/, '') + '/api';
  const STRAPI_TOKEN = ''; // optional: 'Bearer …'

  function buildHeaders() {
    return {
      'Content-Type': 'application/json',
      ...(STRAPI_TOKEN ? { Authorization: STRAPI_TOKEN } : {}),
    };
  }

  // Deep query serializer, produces keys like a[b][c][0]=x
  function qsDeep(obj, prefix, out = []) {
    if (obj == null) return '';
    if (Array.isArray(obj)) {
      obj.forEach((v, i) => qsDeep(v, `${prefix}[${i}]`, out));
    } else if (typeof obj === 'object') {
      Object.entries(obj).forEach(([k, v]) => {
        const key = prefix ? `${prefix}[${encodeURIComponent(k)}]` : encodeURIComponent(k);
        qsDeep(v, key, out);
      });
    } else {
      out.push(`${prefix}=${encodeURIComponent(String(obj))}`);
    }
    return out.join('&');
  }

  // Build a nested populate object from tokens like "*", "Flavours.Dinner", "images"
  function applyPopulateToken(popObj, token) {
    if (!token || token === ',') return;
    if (token === '*') {
      // star wins
      popObj.__STAR__ = true;
      return;
    }
    const parts = String(token).split('.').map(s => s.trim()).filter(Boolean);
    if (!parts.length) return;

    // We only handle "A.B" where A is a relation on the root, and B is a nested relation
    const root = parts[0];
    const nested = parts.slice(1);
    popObj[root] = popObj[root] || {};
    if (nested.length === 0) {
      // populate[root]=true
      popObj[root].__SELF__ = true;
    } else {
      // populate[root][populate][]=nested[0] and so on we only need the first hop for Strapi’s deep populate
      popObj[root].children = popObj[root].children || new Set();
      popObj[root].children.add(nested.join('.'));
    }
  }

  // Convert our in-memory populate description into Strapi v5 query params
  // Input shape:
  // { __STAR__: true } or
  // {
  //   Flavours: { __SELF__: true, children: Set(['Dinner','Dessert']) },
  //   images:   { __SELF__: true }
  // }
  // Convert our populate map into Strapi v5 friendly "array of paths"
  function populateToParams(popMap) {
    if (popMap.__STAR__) return { populate: '*' };

    const paths = [];

    Object.entries(popMap).forEach(([rel, spec]) => {
      if (rel === '__STAR__') return;

      // populate the relation itself, e.g. "Hero_Photos" or "Our_story"
      if (spec.__SELF__) paths.push(rel);

      // deep children as dot paths, e.g. "Flavours.Dinner"
      if (spec.children && spec.children.size) {
        spec.children.forEach(child => paths.push(`${rel}.${child}`));
      }
    });

    // Build query params: populate[0]=A&populate[1]=B
    const params = {};
    paths.forEach((p, i) => { params[`populate[${i}]`] = p; });
    return params;
  }

  // Merge populate requests coming from many elements targeting the same endpoint
  function mergePopulate(existingMap, tokenList) {
    const map = existingMap || {};
    tokenList.forEach(tok => applyPopulateToken(map, tok));
    return map;
  }

  async function getStrapi(endpoint, params = {}) {
    const url = `${API}/${endpoint}${Object.keys(params).length ? `?${qsDeep(params)}` : ''}`;
    const res = await fetch(url, { headers: buildHeaders() });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Fetch failed ${res.status}: ${text}`);
    }
    const json = await res.json();
    return json.data;
  }

  function firstRecord(data) {
    return Array.isArray(data) ? data[0] : data;
  }
  function toAttrs(rec) {
    return rec ? (rec.attributes || rec) : null;
  }
  function mediaUrl(file, base = API_BASE) {
    if (!file) return null;
    const url = file.url || file;
    return typeof url === 'string' && url.startsWith('http') ? url : `${base}${url}`;
  }
  function getDeep(obj, path) {
    if (!obj || !path) return undefined;
    const norm = path.replace(/\[(\d+)\]/g, '.$1');
    return norm.split('.').reduce((acc, key) => acc == null ? acc : acc[key], obj);
  }

  function setValue(el, value, attr = 'text') {
    const prefix   = el.getAttribute('data-prefix') || '';
    const suffix   = el.getAttribute('data-suffix') || '';
    const fmt      = el.getAttribute('data-format');
    const locale   = el.getAttribute('data-locale') || 'en-NZ';
    const currency = el.getAttribute('data-currency') || 'NZD';

    let v = value == null ? '' : value;

    if (fmt === 'date' && v !== '') {
      const d = new Date(v);
      if (!isNaN(d)) {
        const dateStyle = el.getAttribute('data-date-style') || 'medium';
        v = new Intl.DateTimeFormat(locale, { dateStyle }).format(d);
      }
    }
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

      if (el.hasAttribute('data-media')) {
        const m = getDeep(a, field);
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
      }

      let val = getDeep(a, field);
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

      c.querySelectorAll('.__repeat_instance').forEach(n => n.remove());
      if (unwrap) c.querySelectorAll('.__repeat_child').forEach(n => n.remove());

      for (let i = 0; i < Math.min(limit, data.length); i++) {
        const rec = data[i];
        const frag = template.content.cloneNode(true);

        frag.querySelectorAll('[data-field]').forEach(el => {
          const attr = el.getAttribute('data-attr') || 'text';
          const path = el.getAttribute('data-field');
          const val  = path.split('.').reduce((acc, k) => acc?.[k], rec);
          setValue(el, val, attr);
        });

        if (unwrap) {
          const tmp = document.createElement('div');
          tmp.appendChild(frag);
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

  // Scans DOM, fetches all endpoints once, binds values
  async function init() {
    // endpoint -> { populateMap }
    const endpointParams = new Map();

    // Collect from singles
    document.querySelectorAll('[data-strapi]').forEach(el => {
      const ep  = el.getAttribute('data-strapi');
      const pop = (el.getAttribute('data-populate') || '').split(',').map(s => s.trim()).filter(Boolean);
      const current = endpointParams.get(ep) || { populateMap: {} };
      current.populateMap = mergePopulate(current.populateMap, pop);
      endpointParams.set(ep, current);
    });

    // Collect from repeats
    document.querySelectorAll('[data-repeat]').forEach(el => {
      const ep  = el.getAttribute('data-repeat');
      const pop = (el.getAttribute('data-populate') || '').split(',').map(s => s.trim()).filter(Boolean);
      const current = endpointParams.get(ep) || { populateMap: {} };
      current.populateMap = mergePopulate(current.populateMap, pop);
      endpointParams.set(ep, current);
    });

    // Default populate="*" if nothing provided
    for (const [, info] of endpointParams.entries()) {
      if (!Object.keys(info.populateMap).length) info.populateMap.__STAR__ = true;
    }

    // Build requests with proper deep populate
    const cache = {};
    await Promise.all(
      [...endpointParams.entries()].map(async ([ep, info]) => {
        const qsObj = populateToParams(info.populateMap);
        try {
          cache[ep] = await getStrapi(ep, qsObj);
        } catch (e) {
          console.error(e);
        }
      })
    );

    bindSingles(cache);
    bindRepeats(cache);
  }

  // Auto-run on DOM ready
  document.addEventListener('DOMContentLoaded', () => init());

})();