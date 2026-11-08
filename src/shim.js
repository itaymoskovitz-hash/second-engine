/* Second Engine · server layer
   Provides window.claude.use(name) on top of Supabase (auth, data, AI) and Google Calendar,
   so the app code runs unchanged outside claude.ai. Nothing resolves until the user is signed in with 2FA (aal2). */
(() => {
const CFG = window.SE_CONFIG;
if (CFG.ai === false) document.documentElement.classList.add('no-ai');   // hides every AI entry point (see .no-ai in app.html)
const sb = supabase.createClient(CFG.url, CFG.anonKey, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, flowType:'pkce'}});
window.SE = {sb};
const $g = id => document.getElementById(id);
const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const store = {get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }, set(k,v){ try { localStorage.setItem(k,v); } catch(e){} }, del(k){ try { localStorage.removeItem(k); } catch(e){} }};

let readyRes, UID = null, SESSION = null, entered = false, RECOVERY = false;
const READY = new Promise(r => readyRes = r);
const memo = {};
window.claude = {use(name){ if (!memo[name]) memo[name] = READY.then(() => CAPS[name] ? CAPS[name]() : null); return memo[name]; }};

/* ---------------- db: Firestore-like API over public.user_docs ---------------- */
const DB = {cache:{}, loading:{}, colL:{}, docL:{}, pending:{}, channel:null};
const relColl = path => path.split('/').slice(3).join('/') || '_root';
const key = (c,id) => c + '\u0000' + id;
/* offline: every loaded collection is mirrored in localStorage, and writes that fail for lack of a connection wait in an outbox */
const lsColl = c => 'se.db.' + UID + '.' + c, lsOut = () => 'se.outbox.' + UID;
const offline = e => !navigator.onLine || /fetch|network|load failed|timeout/i.test((e && e.message) || String(e || ''));
function persist(c){ if (DB.cache[c]) store.set(lsColl(c), JSON.stringify([...DB.cache[c]])); }
const outbox = () => { try { return JSON.parse(store.get(lsOut()) || '{}'); } catch(e){ return {}; } };
let flushing = false;
async function flush(){
  if (flushing || !UID || !navigator.onLine) return; flushing = true;
  try {
    const ob = outbox();
    for (const k of Object.keys(ob)){
      const {c, id, next} = ob[k];
      const {error} = next === null ? await sb.from('user_docs').delete().eq('coll', c).eq('doc_id', id)
        : await sb.from('user_docs').upsert({user_id: UID, coll: c, doc_id: id, data: next}, {onConflict:'user_id,coll,doc_id'});
      if (error && offline(error)) break;
      const cur = outbox(); delete cur[k]; store.set(lsOut(), JSON.stringify(cur));
    }
  } catch(e){} finally { flushing = false; }
}
addEventListener('online', flush);
function snapDoc(c, id){ const has = DB.cache[c] && DB.cache[c].has(id); const d = has ? DB.cache[c].get(id) : undefined; return {id, exists: has, data: () => clone(d)}; }
function emit(c, id){
  (DB.colL[c] || []).forEach(l => { const docs = [...(DB.cache[c] || new Map()).keys()].map(k => snapDoc(c, k)); try { l.cb({docs, size: docs.length, empty: !docs.length}); } catch(e){ console.error(e); } });
  if (id !== undefined) (DB.docL[key(c,id)] || []).forEach(l => { try { l.cb(snapDoc(c, id)); } catch(e){ console.error(e); } });
  else Object.keys(DB.docL).filter(k => k.startsWith(c + '\u0000')).forEach(k => DB.docL[k].forEach(l => { try { l.cb(snapDoc(c, k.split('\u0000')[1])); } catch(e){} }));
}
function loadColl(c){
  if (DB.cache[c]) return Promise.resolve();
  if (!DB.loading[c]) DB.loading[c] = (async () => {
    const fromDevice = () => { try { const v = JSON.parse(store.get(lsColl(c)) || 'null'); return v ? new Map(v) : null; } catch(e){ return null; } };
    const m = new Map(); let from = 0;
    try {
      if (!navigator.onLine) throw new Error('offline');
      for (;;){
        const {data, error} = await sb.from('user_docs').select('doc_id,data').eq('coll', c).range(from, from + 999);
        if (error) throw error;
        data.forEach(r => m.set(r.doc_id, r.data));
        if (data.length < 1000) break; from += 1000;
      }
    } catch(e){
      const local = offline(e) && fromDevice();
      if (!local){ DB.loading[c] = null; throw {code:'unavailable', message: e && e.message}; }
      DB.cache[c] = local; return;
    }
    const ob = outbox(); Object.values(ob).filter(x => x.c === c).forEach(x => x.next === null ? m.delete(x.id) : m.set(x.id, x.next));   // unsent local changes win
    DB.cache[c] = m; persist(c);
  })();
  return DB.loading[c];
}
function startRealtime(){
  DB.channel = sb.channel('user-docs-' + UID).on('postgres_changes', {event:'*', schema:'public', table:'user_docs', filter:'user_id=eq.' + UID}, p => {
    const row = p.eventType === 'DELETE' ? p.old : p.new; if (!row || !row.coll) return;
    const c = row.coll, id = row.doc_id;
    if (!DB.cache[c] || DB.pending[key(c,id)]) return;
    if (p.eventType === 'DELETE') DB.cache[c].delete(id); else DB.cache[c].set(id, row.data);
    persist(c); emit(c, id);
  }).subscribe();
}
async function write(c, id, fn){
  await loadColl(c);
  const k = key(c,id), prev = DB.cache[c].get(id), had = DB.cache[c].has(id);
  const next = fn(prev);
  if (next === null) DB.cache[c].delete(id); else DB.cache[c].set(id, next);
  emit(c, id); persist(c);
  DB.pending[k] = (DB.pending[k] || 0) + 1;
  const queue = () => { const ob = outbox(); ob[k] = {c, id, next}; store.set(lsOut(), JSON.stringify(ob)); };
  if (!navigator.onLine){ queue(); setTimeout(() => { DB.pending[k]--; if (!DB.pending[k]) delete DB.pending[k]; }, 1500); return; }
  try {
    const q = next === null ? sb.from('user_docs').delete().eq('coll', c).eq('doc_id', id)
      : sb.from('user_docs').upsert({user_id: UID, coll: c, doc_id: id, data: next}, {onConflict:'user_id,coll,doc_id'});
    const {error} = await q;
    if (error) throw error;
  } catch(err){
    if (offline(err)){ queue(); return; }
    if (had) DB.cache[c].set(id, prev); else DB.cache[c].delete(id);
    emit(c, id); persist(c);
    throw {code: /aal2|row-level/i.test(err && err.message || '') ? 'not_granted' : 'unavailable', message: err && err.message};
  } finally { setTimeout(() => { DB.pending[k]--; if (!DB.pending[k]) delete DB.pending[k]; }, 1500); }
}
function docRef(c, id){
  return {
    id,
    set: (data, opts) => write(c, id, prev => opts && opts.merge ? Object.assign({}, prev || {}, clone(data)) : clone(data)),
    update: patch => write(c, id, prev => Object.assign({}, prev || {}, clone(patch))),
    delete: () => write(c, id, () => null),
    get: async () => { await loadColl(c); return snapDoc(c, id); },
    onSnapshot(cb, err){
      const l = {cb}; (DB.docL[key(c,id)] = DB.docL[key(c,id)] || []).push(l);
      loadColl(c).then(() => cb(snapDoc(c, id)), e => err && err(e));
      return () => { DB.docL[key(c,id)] = DB.docL[key(c,id)].filter(x => x !== l); };
    }
  };
}
function collection(path){
  const c = relColl(path);
  return {
    doc: id => docRef(c, String(id)),
    get: async () => { await loadColl(c); const docs = [...DB.cache[c].keys()].map(k => snapDoc(c, k)); return {docs, size: docs.length, empty: !docs.length}; },
    onSnapshot(cb, err){
      const l = {cb}; (DB.colL[c] = DB.colL[c] || []).push(l);
      loadColl(c).then(() => { const docs = [...DB.cache[c].keys()].map(k => snapDoc(c, k)); cb({docs, size: docs.length, empty: !docs.length}); }, e => err && err(e));
      return () => { DB.colL[c] = DB.colL[c].filter(x => x !== l); };
    }
  };
}

/* ---------------- sample: Claude through the coach-ai edge function ---------------- */
function shrink(blob){
  return new Promise(res => {
    const url = URL.createObjectURL(blob), img = new Image();
    img.onload = () => {
      const s = Math.min(1, 1568 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
      cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      res(cv.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(null); };
    img.src = url;
  });
}
async function callAI(body, signal){
  const {data:{session}} = await sb.auth.getSession();
  let r;
  try {
    r = await fetch(CFG.url + '/functions/v1/coach-ai', {method:'POST', signal, headers:{'Content-Type':'application/json', apikey: CFG.anonKey, Authorization:'Bearer ' + (session && session.access_token)}, body: JSON.stringify(body)});
  } catch(e){ throw {code: e && e.name === 'AbortError' ? 'cancelled' : 'unavailable', message:'network'}; }
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw {code: r.status === 429 ? 'rate_limited' : (r.status === 401 || r.status === 403) ? 'not_granted' : r.status === 503 ? 'not_configured' : 'unavailable', message: out.message || 'AI error'};
  return out;
}
async function sample(input, opts = {}){
  const msgs = typeof input === 'string' ? [{role:'user', content: input}] : input.map(m => ({role: m.role, content: m.content}));
  if (opts.images && opts.images.length){
    const last = msgs[msgs.length - 1];
    const blocks = (await Promise.all(opts.images.slice(0, 8).map(shrink))).filter(Boolean).map(data => ({type:'image', source:{type:'base64', media_type:'image/jpeg', data}}));
    last.content = blocks.concat([{type:'text', text: String(last.content)}]);
  }
  const tools = opts.tools || [];
  const defs = tools.map(t => ({name: t.name, description: t.description, input_schema: t.inputSchema || {type:'object', properties:{}}}));
  let text = '';
  for (let turn = 0; turn < 6; turn++){
    if (opts.signal && opts.signal.aborted) throw {code:'cancelled', text};
    let res;
    try { res = await callAI({messages: msgs, tools: defs, tier: opts.modelTier || 'default', system: opts.system, max_tokens: opts.maxTokens || 2500}, opts.signal); }
    catch(e){ e.text = text; throw e; }
    const t = (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    if (t){ const delta = (text ? '\n\n' : '') + t; text += delta; opts.onText && opts.onText({text, delta}); }
    if (res.stop_reason !== 'tool_use') return {text, truncated: res.stop_reason === 'max_tokens', remaining: res.remaining};
    msgs.push({role:'assistant', content: res.content});
    const results = [];
    for (const b of res.content.filter(b => b.type === 'tool_use')){
      const tool = tools.find(x => x.name === b.name);
      try { const out = tool ? await tool.execute(b.input || {}) : 'unknown tool'; results.push({type:'tool_result', tool_use_id: b.id, content: typeof out === 'string' ? out : JSON.stringify(out === undefined ? 'ok' : out)}); }
      catch(e){ results.push({type:'tool_result', tool_use_id: b.id, content: String(e && e.message || e), is_error: true}); }
    }
    msgs.push({role:'user', content: results});
  }
  return {text, truncated: false};
}
sample.json = async (input, opts = {}) => {
  const add = '\n\nהחזר JSON תקין בלבד, בלי טקסט נוסף ובלי ```.';
  const inp = typeof input === 'string' ? input + add : input.map((m, i) => i === input.length - 1 ? {role: m.role, content: m.content + add} : m);
  const {text} = await sample(inp, Object.assign({}, opts, {onText: null, tools: null}));
  const s = text.replace(/```(?:json)?/g, '');
  const a = Math.min(...['{','['].map(ch => { const i = s.indexOf(ch); return i < 0 ? Infinity : i; }));
  const b = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  try { return JSON.parse(s.slice(a, b + 1)); } catch(e){ throw {code:'bad_json', message:'invalid JSON', text}; }
};
sample.limits = async () => ({images: true, tools: true});

/* ---------------- mcp: Google Calendar through Google Identity Services ---------------- */
const GC = {token: null, exp: 0, inflight: null, watchers: []};
try { const t = JSON.parse(sessionStorage.getItem('se.gc') || 'null'); if (t && t.exp > Date.now() + 60000){ GC.token = t.token; GC.exp = t.exp; } } catch(e){}
function gcToken(interactive){
  if (GC.token && Date.now() < GC.exp - 60000) return Promise.resolve(GC.token);
  if (!CFG.googleClientId || !(window.google && google.accounts && google.accounts.oauth2)) return Promise.reject({code:'server_not_connected'});
  if (!interactive) return Promise.reject({code:'consent_required'});
  if (GC.inflight) return GC.inflight;
  GC.inflight = new Promise((res, rej) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CFG.googleClientId, scope: 'https://www.googleapis.com/auth/calendar.events',
      login_hint: SESSION && SESSION.user && SESSION.user.email || undefined,
      callback: r => { GC.inflight = null; if (r.error){ rej({code:'consent_required'}); return; } GC.token = r.access_token; GC.exp = Date.now() + (r.expires_in || 3600) * 1000; try { sessionStorage.setItem('se.gc', JSON.stringify({token: GC.token, exp: GC.exp})); } catch(e){} res(GC.token); },
      error_callback: () => { GC.inflight = null; rej({code:'consent_required'}); }
    });
    client.requestAccessToken({prompt: ''});
  });
  return GC.inflight;
}
const rfc = s => /[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : new Date(s).toISOString();
async function gfetch(path, init, interactive){
  const tok = await gcToken(interactive);
  const r = await fetch('https://www.googleapis.com/calendar/v3/' + path, Object.assign({}, init, {headers: Object.assign({Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json'}, init && init.headers)}));
  if (r.status === 401){ GC.token = null; try { sessionStorage.removeItem('se.gc'); } catch(e){} throw {code:'needs_reauth'}; }
  if (!r.ok) throw {code:'tool_error', message: 'calendar ' + r.status};
  return r.json();
}
const TOOLS = {
  async list_events(inp, interactive){
    const q = new URLSearchParams({singleEvents:'true', orderBy:'startTime', maxResults: String(Math.min(inp.pageSize || 250, 250))});
    if (inp.startTime) q.set('timeMin', rfc(inp.startTime)); if (inp.endTime) q.set('timeMax', rfc(inp.endTime));
    let events = [], page = '';
    do { if (page) q.set('pageToken', page); const out = await gfetch('calendars/primary/events?' + q, null, interactive); events = events.concat(out.items || []); page = out.nextPageToken; } while (page && events.length < 2000);
    return {events};
  },
  async update_event(inp, interactive){
    const body = {};
    if (inp.summary != null) body.summary = inp.summary;
    if (inp.description != null) body.description = inp.description;
    if (inp.startTime){ body.start = inp.allDay ? {date: inp.startTime.slice(0,10)} : {dateTime: rfc(inp.startTime)}; body.end = inp.allDay ? {date: (inp.endTime || inp.startTime).slice(0,10)} : {dateTime: rfc(inp.endTime || inp.startTime)}; }
    return gfetch('calendars/primary/events/' + encodeURIComponent(inp.eventId) + '?sendUpdates=none', {method:'PATCH', body: JSON.stringify(body)}, interactive);
  }
};
const ckey = (tool, inp) => 'se.cal.' + UID + '.' + tool + '.' + JSON.stringify(inp);
const mcp = {
  async callTool(server, tool, input){
    if (!TOOLS[tool]) throw {code:'not_in_manifest'};
    const payload = await TOOLS[tool](input || {}, true);
    if (tool === 'list_events') store.set(ckey(tool, input), JSON.stringify({at: Date.now(), payload}));
    return {payload, cache: {storedAt: Date.now()}};
  },
  watchTool(server, tool, input, handler, opts = {}){
    const w = {tool, input, handler, stopped: false};
    const run = interactive => TOOLS[tool](input || {}, interactive).then(payload => {
      if (w.stopped) return; store.set(ckey(tool, input), JSON.stringify({at: Date.now(), payload}));
      handler({type:'data', result:{payload, cache:{storedAt: Date.now()}}});
    }, error => { if (!w.stopped) handler({type:'error', error}); });
    w.run = run;
    try { const c = JSON.parse(store.get(ckey(tool, input)) || 'null'); if (c) setTimeout(() => handler({type:'data', result:{payload: c.payload, cache:{storedAt: c.at}}}), 0); } catch(e){}
    setTimeout(() => run(false), 0);
    if (opts.refetchInterval) w.timer = setInterval(() => { if (GC.token) run(false); }, Math.max(60000, opts.refetchInterval));
    GC.watchers.push(w);
    return () => { w.stopped = true; clearInterval(w.timer); };
  },
  invalidate(server, tool){ GC.watchers.filter(w => !w.stopped && (!tool || w.tool === tool)).forEach(w => w.run(false)); },
  listTools: async () => Object.keys(TOOLS).map(name => ({name}))
};

/* ---------------- user & downloads ---------------- */
const user = {
  id: async () => UID,
  me: async () => { const u = SESSION.user, m = u.user_metadata || {}; return {id: UID, name: m.full_name || m.name || '', email: u.email || ''}; },
  isOwner: () => true, canEdit: () => true, can: () => true,
  profiles: async ids => Object.fromEntries((ids || []).map(id => [id, {id, name: ''}]))
};
const downloads = {save: async ({filename, data}) => {
  const blob = data instanceof Blob ? data : new Blob([data]); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename || 'download'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000); return {ok: true};
}};
const CAPS = {db: () => ({collection, doc: p => { const s = p.split('/'); return collection(s.slice(0, -1).join('/')).doc(s[s.length - 1]); }}), user: () => user, sample: () => CFG.ai === false ? null : sample, mcp: () => mcp, downloads: () => downloads};

/* ---------------- auth gate ---------------- */
const HE = {
  'Invalid login credentials': 'המייל או הסיסמה לא נכונים.',
  'Email not confirmed': 'צריך לאשר את המייל קודם. חפש את ההודעה מ-Second Engine בתיבה.',
  'User already registered': 'כבר יש חשבון עם המייל הזה. נסה להיכנס.',
  'Invalid TOTP code entered': 'הקוד לא נכון או שפג תוקפו. נסה את הקוד הבא.',
  'Email rate limit exceeded': 'נשלחו יותר מדי מיילים. נסה שוב בעוד כמה דקות.',
  'New password should be different from the old password.': 'הסיסמה החדשה צריכה להיות שונה מהקודמת.'
};
const heErr = e => { const m = (e && e.message) || String(e || ''); for (const k in HE) if (m.includes(k)) return HE[k]; if (/rate limit|429/i.test(m)) return 'יותר מדי ניסיונות. חכה רגע ונסה שוב.'; if (/password/i.test(m) && /least|weak|short/i.test(m)) return 'הסיסמה חלשה מדי. לפחות 10 תווים, עם אותיות ומספרים.'; if (/network|fetch/i.test(m)) return 'אין חיבור לשרת. בדוק את האינטרנט.'; return 'משהו השתבש. נסה שוב.'; };
const G = {factor: null, enrollId: null, mode: 'in'};
function panel(name){
  G.mode = name;
  document.querySelectorAll('#seGate [data-p]').forEach(p => p.hidden = p.dataset.p !== name);
  $g('seErr').textContent = ''; $g('seGate').hidden = false; document.documentElement.classList.add('se-locked');
  const f = document.querySelector('#seGate [data-p="' + name + '"] input:not([type=hidden])'); if (f && matchMedia('(pointer:fine)').matches) setTimeout(() => f.focus(), 50);
}
const err = m => { $g('seErr').textContent = m; };
async function busy(btn, fn){ if (btn.disabled) return; const t = btn.textContent; btn.disabled = true; btn.textContent = '…'; err(''); try { await fn(); } catch(e){ err(heErr(e)); } finally { btn.disabled = false; btn.textContent = t; } }
const redirect = () => location.origin + location.pathname;

async function route(){
  let {data:{session}} = await sb.auth.getSession();
  if (!session && !navigator.onLine){
    try { const t = JSON.parse(localStorage.getItem('sb-' + new URL(CFG.url).hostname.split('.')[0] + '-auth-token') || 'null'); const s = t && (t.currentSession || t);
      if (s && s.user && s.user.id && localStorage.getItem('se.db.' + s.user.id + '._root')){ enter(s); addEventListener('online', () => location.reload(), {once:true}); return; } } catch(e){}
  }
  SESSION = session;
  if (!session){ panel(G.mode === 'up' || G.mode === 'sent' || G.mode === 'reset' ? G.mode : 'in'); return; }
  const {data: aal, error} = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error){ err(heErr(error)); return; }
  if (aal.currentLevel !== 'aal2'){
    const {data: f} = await sb.auth.mfa.listFactors();
    const v = (f && f.totp || []).find(x => x.status === 'verified');
    if (v){ G.factor = v.id; panel('verify'); return; }
  }
  if (RECOVERY){ panel('newpass'); return; }
  enter(session);
}
/* optional 2FA, started from the profile */
async function startEnroll(){
  panel('enroll'); $g('seQr').innerHTML = '<span class="se-dim">מכין קוד…</span>'; $g('seAddApp').hidden = true;
  const {data: f} = await sb.auth.mfa.listFactors();
  for (const x of (f && f.all || []).filter(x => x.status !== 'verified')) await sb.auth.mfa.unenroll({factorId: x.id});
  const {data, error} = await sb.auth.mfa.enroll({factorType:'totp', friendlyName:'Second Engine'});
  if (error){ err(heErr(error)); return; }
  G.enrollId = data.id;
  const qr = String(data.totp.qr_code || ''), img = new Image();
  img.alt = 'קוד QR לסריקה באפליקציית האימות';
  const svg = qr.trim().startsWith('<') ? qr : (/^data:image\/svg\+xml[^,]*,\s*</.test(qr) ? qr.slice(qr.indexOf(',') + 1) : null);
  img.src = svg ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) : qr;
  $g('seQr').replaceChildren(img);
  $g('seSecret').textContent = data.totp.secret.replace(/(.{4})/g, '$1 ').trim();
  if (data.totp.uri && matchMedia('(pointer:coarse)').matches){ $g('seAddApp').href = data.totp.uri; $g('seAddApp').hidden = false; }
}
async function cancelEnroll(){
  try { if (G.enrollId) await sb.auth.mfa.unenroll({factorId: G.enrollId}); } catch(e){}
  G.enrollId = null; $g('seGate').hidden = true; document.documentElement.classList.remove('se-locked');
}
function enter(session){
  SESSION = session; UID = session.user.id;
  $g('seGate').hidden = true; document.documentElement.classList.remove('se-locked');
  if (entered) return; entered = true;
  startRealtime(); readyRes(); wireProfile(); flush();
}

sb.auth.onAuthStateChange((ev, session) => {
  if (ev === 'PASSWORD_RECOVERY') RECOVERY = true;
  if (ev === 'SIGNED_OUT'){ if (entered){ Object.keys(localStorage).filter(k => /^se\.(cal|db|outbox)\./.test(k)).forEach(k => store.del(k)); try { sessionStorage.removeItem('se.gc'); } catch(e){} location.replace(redirect()); } else setTimeout(route, 0); return; }
  if (ev === 'TOKEN_REFRESHED'){ SESSION = session; return; }
  if (['SIGNED_IN','MFA_CHALLENGE_VERIFIED','INITIAL_SESSION','PASSWORD_RECOVERY','USER_UPDATED'].includes(ev) && !(entered && ev === 'SIGNED_IN')) setTimeout(route, 0);
});

function wireGate(){
  if (!CFG.googleAuth) document.querySelectorAll('#seGate .se-google, #seGate .se-or').forEach(x => x.hidden = true);
  const q = s => document.querySelector('#seGate ' + s);
  q('[data-p="in"] form').onsubmit = e => { e.preventDefault(); busy(e.submitter || q('[data-p="in"] .se-primary'), async () => {
    const {error} = await sb.auth.signInWithPassword({email: $g('seEmail').value.trim(), password: $g('sePass').value}); if (error) throw error; }); };
  q('[data-p="up"] form').onsubmit = e => { e.preventDefault(); busy(q('[data-p="up"] .se-primary'), async () => {
    const pw = $g('seNewPass').value; if (pw.length < 10 || !/\d/.test(pw) || !/\p{L}/u.test(pw)) throw {message:'password too short'};
    const {data, error} = await sb.auth.signUp({email: $g('seUpEmail').value.trim(), password: pw, options:{emailRedirectTo: redirect(), data:{full_name: $g('seUpName').value.trim()}}}); if (error) throw error;
    if (!data.session){ $g('seSentTo').textContent = $g('seUpEmail').value.trim(); $g('seSentWhat').textContent = 'לחץ על הקישור במייל כדי לאשר את החשבון ולהיכנס.'; panel('sent'); } }); };
  q('[data-p="reset"] form').onsubmit = e => { e.preventDefault(); busy(q('[data-p="reset"] .se-primary'), async () => {
    const em = $g('seResetEmail').value.trim(); const {error} = await sb.auth.resetPasswordForEmail(em, {redirectTo: redirect()}); if (error) throw error;
    $g('seSentTo').textContent = em; $g('seSentWhat').textContent = 'שלחנו קישור לבחירת סיסמה חדשה.'; panel('sent'); }); };
  q('[data-p="newpass"] form').onsubmit = e => { e.preventDefault(); busy(q('[data-p="newpass"] .se-primary'), async () => {
    const pw = $g('seSetPass').value; if (pw.length < 10 || !/\d/.test(pw) || !/\p{L}/u.test(pw)) throw {message:'password too short'};
    const {error} = await sb.auth.updateUser({password: pw}); if (error) throw error; RECOVERY = false; await route(); }); };
  q('[data-p="enroll"] form').onsubmit = e => { e.preventDefault(); busy(q('[data-p="enroll"] .se-primary'), async () => {
    const {error} = await sb.auth.mfa.challengeAndVerify({factorId: G.enrollId, code: $g('seEnrollCode').value.replace(/\s/g,'')}); if (error) throw error;
    G.enrollId = null; $g('seEnrollCode').value = ''; await route(); wireProfile(); }); };
  $g('seEnrollCancel').onclick = cancelEnroll;
  q('[data-p="verify"] form').onsubmit = e => { e.preventDefault(); busy(q('[data-p="verify"] .se-primary'), async () => {
    const {error} = await sb.auth.mfa.challengeAndVerify({factorId: G.factor, code: $g('seCode').value.replace(/\s/g,'')}); if (error) throw error; await route(); }); };
  document.querySelectorAll('#seGate [data-go]').forEach(b => b.onclick = () => panel(b.dataset.go));
  document.querySelectorAll('#seGate .se-google').forEach(b => b.onclick = () => busy(b, async () => {
    const {error} = await sb.auth.signInWithOAuth({provider:'google', options:{redirectTo: redirect()}}); if (error) throw error; }));
  $g('seMagic').onclick = () => busy($g('seMagic'), async () => {
    const em = $g('seEmail').value.trim(); if (!/.+@.+\..+/.test(em)){ err('כתוב קודם את המייל שלך בשדה למעלה.'); return; }
    const {error} = await sb.auth.signInWithOtp({email: em, options:{emailRedirectTo: redirect(), shouldCreateUser: true}}); if (error) throw error;
    $g('seSentTo').textContent = em; $g('seSentWhat').textContent = 'לחץ על קישור הכניסה במייל. הוא תקף לשעה ועובד פעם אחת.'; panel('sent'); });
  document.querySelectorAll('#seGate .se-out').forEach(b => b.onclick = () => sb.auth.signOut());
  $g('seCopy').onclick = async () => { try { await navigator.clipboard.writeText($g('seSecret').textContent.replace(/\s/g,'')); $g('seCopy').textContent = 'הועתק'; } catch(e){ const r = document.createRange(); r.selectNodeContents($g('seSecret')); getSelection().removeAllRanges(); getSelection().addRange(r); } };
  document.querySelectorAll('#seGate input[inputmode=numeric]').forEach(i => i.addEventListener('input', () => { const v = i.value.replace(/\D/g,''); if (v.length === 6) i.form.requestSubmit(); }));
}

/* ---------------- profile: live security rows ---------------- */
async function wireProfile(){
  if (!navigator.onLine){ addEventListener('online', wireProfile, {once:true}); return; }
  const u = SESSION.user, prov = (u.app_metadata && u.app_metadata.providers) || [u.app_metadata && u.app_metadata.provider];
  const set = (id, t) => { const el = $g(id); if (el) el.textContent = t; };
  set('pfLogin', (u.email || '') + ' · ' + (prov.includes('google') ? 'Google' : 'מייל וסיסמה'));
  const {data: f} = await sb.auth.mfa.listFactors(); const n = (f && f.totp || []).filter(x => x.status === 'verified').length;
  set('se2faState', n ? 'פעיל · קוד מאפליקציית אימות בכל מכשיר חדש' : 'כבוי · מומלץ להפעיל להגנה נוספת');
  const tb = $g('se2faBtn');
  if (tb){
    tb.textContent = n ? 'כבה' : 'הפעל'; tb.classList.toggle('ok', !n); tb.disabled = false; let armed = false;
    tb.onclick = async () => {
      if (!n){ startEnroll(); return; }
      if (!armed){ armed = true; tb.textContent = 'לכבות? לחץ שוב'; setTimeout(() => { if (armed){ armed = false; tb.textContent = 'כבה'; } }, 4000); return; }
      tb.disabled = true; tb.textContent = '…';
      for (const x of (f && f.totp || [])) { const {error} = await sb.auth.mfa.unenroll({factorId: x.id}); if (error){ set('se2faState', heErr(error)); break; } }
      await sb.auth.refreshSession(); wireProfile();
    };
  }
  const pwBtn = $g('sePwBtn'), pwForm = $g('sePwForm');
  if (pwBtn) pwBtn.onclick = () => { pwForm.hidden = !pwForm.hidden; if (!pwForm.hidden) $g('sePwNew').focus(); };
  if (pwForm) pwForm.onsubmit = async e => {
    e.preventDefault(); const pw = $g('sePwNew').value, msg = $g('sePwMsg');
    if (pw.length < 10 || !/\d/.test(pw) || !/\p{L}/u.test(pw)){ msg.textContent = 'לפחות 10 תווים, עם אותיות ומספרים.'; return; }
    const {error} = await sb.auth.updateUser({password: pw});
    msg.textContent = error ? heErr(error) : 'הסיסמה עודכנה.'; if (!error){ $g('sePwNew').value = ''; setTimeout(() => { pwForm.hidden = true; msg.textContent = ''; }, 1800); }
  };
  const others = $g('seOthers'); if (others) others.onclick = async () => { const {error} = await sb.auth.signOut({scope:'others'}); others.textContent = error ? 'נכשל' : 'נותקו'; others.disabled = !error; };
  const out = $g('seSignOut'); if (out) out.onclick = () => sb.auth.signOut();
}

/* ---------------- install as an app + offline shell ---------------- */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
let installEv = null;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function wireInstall(){
  const row = $g('seInstallRow'), btn = $g('seInstall'); if (!row || !btn) return;
  row.hidden = standalone() || !(installEv || isIOS);
  btn.onclick = async () => {
    if (installEv){ installEv.prompt(); const r = await installEv.userChoice.catch(() => null); installEv = null; if (r && r.outcome === 'accepted') row.hidden = true; return; }
    $g('seInstallSub').textContent = 'בספארי: לחץ על כפתור השיתוף ובחר "הוסף למסך הבית".'; btn.hidden = true;
  };
}
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEv = e; wireInstall(); });
addEventListener('appinstalled', () => { installEv = null; const r = $g('seInstallRow'); if (r) r.hidden = true; });

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { wireGate(); wireInstall(); }); else { wireGate(); wireInstall(); }
})();
