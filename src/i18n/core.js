/* ---------- i18n: Hebrew is the source language; English is applied as a display layer ---------- */
const I18N = (() => {
  const HEB = /[֐-׿]/;
  const ls = {get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }, set(k,v){ try { localStorage.setItem(k,v); } catch(e){} }};
  const navHe = () => { try { return (navigator.languages || [navigator.language]).some(l => /^(he|iw)\b/i.test(l || '')); } catch(e){ return true; } };
  const saved = ls.get('se.lang');
  const st = {lang: saved === 'en' || saved === 'he' ? saved : (navHe() ? 'he' : 'en'), dict: null, rules: [], miss: new Set(), full: new Set(), obs: null, cache: new Map()};
  const norm = s => s.replace(/[‎‏⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();
  const SKIP_PARENT = new Set(['SCRIPT','STYLE','TEXTAREA','CODE']);
  function skip(el){
    for (let e = el, i = 0; e && i < 40; e = e.parentElement, i++){
      if (SKIP_PARENT.has(e.tagName)) return true;
      if (e.hasAttribute && e.hasAttribute('data-noi18n')) return true;
      if (i === 0 && e.classList && (e.classList.contains('msg') || e.classList.contains('nm2'))) return true;
    }
    return false;
  }
  function tr(s){
    if (st.lang !== 'en' || !s || !HEB.test(s)) return s;
    if (st.cache.has(s)) return st.cache.get(s);
    const lead = s.match(/^\s*/)[0], tail = s.match(/\s*$/)[0];
    const nk = norm(s), out = lead + piece(nk, 0) + tail;
    if (HEB.test(out)) st.full.add(tkey(nk));
    if (st.cache.size > 5000) st.cache.clear();
    st.cache.set(s, out);
    return out;
  }
  const NUM = /\d+(?:[.:,]\d+)*(?:\s?[–-]\s?\d+(?:[.:,]\d+)*)?/g;
  const tkey = k => k.replace(NUM, '#');
  function lookup(k){
    const D = st.dict || {};
    if (D[k] !== undefined) return D[k];
    const t = tkey(k);
    if (t !== k && D[t] !== undefined){ const nums = k.match(NUM) || []; let i = 0; return D[t].replace(/#/g, () => nums[i++] || ''); }
    return undefined;
  }
  function piece(k, depth){
    if (!k || !HEB.test(k)) return k;
    const hit = lookup(k); if (hit !== undefined) return hit;
    if (!/[.?!:]$/.test(k)){ const h2 = lookup(k + '.'); if (h2 !== undefined) return h2.replace(/\.$/, ''); }
    for (const [re, fn] of st.rules){ re.lastIndex = 0; const m = k.match(re); if (m){ const r = fn(m, x => piece(norm(x), depth + 1)); if (r != null) return r; } }
    if (depth < 6){
      for (const sep of ['. ', ' · ', ' + ', ' — ', ' | ', ': ', ', ', ' / ', ' ← ', ' (', ') ']){
        if (k.includes(sep)){ const parts = k.split(sep); if (parts.length > 1) return parts.map(p => piece(p.trim(), depth + 1)).join(sep); }
      }
    }
    st.miss.add(tkey(k));
    return k;
  }
  const ATTRS = ['placeholder','aria-label','title','alt'];
  function node(n){
    if (n.nodeType === 3){
      const v = n.data; if (!HEB.test(v) || skip(n.parentElement)) return;
      const t = tr(v); if (t !== v) n.data = t;
    } else if (n.nodeType === 1){
      if (n.getAttribute('dir') === 'rtl' && !n.hasAttribute('data-noi18n')) n.setAttribute('dir', 'ltr');
      for (const a of ATTRS){ const v = n.getAttribute(a); if (v && HEB.test(v)){ const t = tr(v); if (t !== v) n.setAttribute(a, t); } }
      if (n.dataset && n.dataset.en){ if (n.textContent !== n.dataset.en) n.textContent = n.dataset.en; return; }
      if (SKIP_PARENT.has(n.tagName) || n.hasAttribute('data-noi18n')) return;
      if (n.tagName === 'INPUT' && n.type === 'button' && HEB.test(n.value)) n.value = tr(n.value);
      for (let c = n.firstChild; c; c = c.nextSibling) node(c);
    }
  }
  function apply(){
    document.documentElement.lang = st.lang;
    document.documentElement.dir = st.lang === 'en' ? 'ltr' : 'rtl';
    document.documentElement.classList.toggle('lang-en', st.lang === 'en');
    if (st.lang !== 'en') return;
    if (document.title && HEB.test(document.title)) document.title = tr(document.title);
    node(document.body || document.documentElement);
    if (!st.obs){
      st.obs = new MutationObserver(list => {
        for (const m of list){
          if (m.type === 'characterData') node(m.target);
          else if (m.type === 'attributes') { if (m.attributeName === 'dir' || HEB.test(m.target.getAttribute(m.attributeName) || '')) node(m.target); }
          else m.addedNodes.forEach(node);
        }
      });
      st.obs.observe(document.documentElement, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat(['dir'])});
    }
  }
  function set(lang, reload){
    if (lang !== 'en' && lang !== 'he') return;
    ls.set('se.lang', lang);
    if (lang === st.lang) return;
    if (st.lang === 'en' && reload !== false){ st.lang = lang; location.reload(); return; }
    st.lang = lang; apply();
  }
  return {
    get lang(){ return st.lang; }, tr, apply, set, miss: st.miss, full: st.full,
    load(dict, rules){ st.dict = dict; st.rules = rules; st.cache.clear(); },
    /* tell the AI which language to answer in; plan text for tools/imports stays in the app's Hebrew format */
    aiNote(){ return st.lang === 'en' ? '\n\nLANGUAGE: The user reads this app in English. Write every word the user will read in natural English (units: km, min/km). Keep JSON keys as specified, and keep any workout text passed to a tool in the Hebrew format the tool describes.' : ''; }
  };
})();
const tr = I18N.tr;
