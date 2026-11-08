/* Test double for @supabase/supabase-js (served instead of the CDN file).
   Controlled through localStorage before the page loads:
     T_OUT=1        signed out
     T_SCEN=new     brand-new user (no prefs, onboarding opens)
     T_LANG=en|he   language saved in prefs
   Records calls in window.__calls and localStorage (T_RPC, T_SO). Writes reject while navigator.onLine is false. */
window.__calls = [];
window.supabase = {createClient(){
  const ls = k => localStorage.getItem(k);
  const sess = {access_token:'t', user:{id:'u1', email:'tester@example.com', user_metadata:{full_name:'Tester'}, app_metadata:{providers:['email']}, identities:[]}};
  const current = () => ls('T_OUT') ? null : sess;
  const prefs = () => ls('T_SCEN') === 'new'
    ? {lang: ls('T_LANG') || 'he', onboarded:false, diet:[]}
    : {lang: ls('T_LANG') || 'he', onboarded:true, planSource:'calendar', weight:72, maxHr:188, restHr:50, pace:'5:45', diet:['vegetarian']};
  const chain = table => { let coll = ''; const c = {
    select: () => c, eq: (k, v) => { if (k === 'coll') coll = v; return c; },
    range: () => Promise.resolve({data: coll === '_root' ? [{doc_id:'coach', data: prefs()}] : [], error:null}),
    delete: () => { window.__calls.push(['delete', table]); return c; },
    upsert: row => { window.__calls.push(table === 'push_subs' ? ['upsert', table, row] : ['upsert', row.coll, row.doc_id]); return navigator.onLine ? Promise.resolve({error:null}) : Promise.reject(new TypeError('Failed to fetch')); },
    then: r => r({data:[], error:null})
  }; return c; };
  const auth = {
    getSession: async () => ({data:{session: current()}}),
    getUser: async () => ({data:{user: sess.user}}),
    onAuthStateChange(cb){ setTimeout(() => cb('INITIAL_SESSION', current()), 0); return {data:{subscription:{unsubscribe(){}}}}; },
    mfa: {getAuthenticatorAssuranceLevel: async () => ({data:{currentLevel:'aal1'}}), listFactors: async () => ({data:{totp:[], all:[]}})},
    signInWithOAuth: async o => { window.__calls.push(['oauth', o]); return {error:null}; },
    signInWithPassword: async o => { window.__calls.push(['password', o.email]); return {error:null}; },
    signOut: async o => { localStorage.setItem('T_SO', JSON.stringify(o || {})); return {}; }
  };
  const ch = {on(){ return ch; }, subscribe(){ return ch; }};
  return {auth, rpc: async n => { localStorage.setItem('T_RPC', n); return {error:null}; }, from: chain, channel: () => ch, removeChannel(){}};
}};
