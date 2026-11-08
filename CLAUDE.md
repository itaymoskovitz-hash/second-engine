# Second Engine (E²)

Training companion app for people who do **both running and strength training**. Hebrew-first (RTL), with an English display layer. The owner is the pilot user and plans to market the app to other athletes, so every feature must work for any user (beginner or advanced, any dietary restriction, with or without an existing plan).

The owner communicates in Hebrew. Reply to him in Hebrew. Keep UI titles free of English words in the Hebrew UI (e.g. "אימון דחיפה", not "Push").

## Live

- Site: https://itaymoskovitz-hash.github.io/second-engine/ (GitHub Pages, `main` branch, `/docs` folder)
- Backend: Supabase project `SECOND ENGINE`, ref `qapppwgruymsnsxfvlda`, region eu-central-1
- The claude.ai artifact version (https://claude.ai/artifact/RuD2eLHR1yC8DsufNj6KbW) is the original prototype; the standalone site is the product.

## Layout

```
src/app.html        the whole app: markup, CSS and JS in one file (source of truth for the UI)
src/shim.js         implements window.claude.use(name) on top of Supabase, so app.html runs unchanged outside claude.ai
src/gate.html       sign-in screens (email+password, magic link, Google, optional TOTP 2FA) + their CSS
src/config.js       public config: Supabase URL, anon key, googleClientId, googleAuth flag
src/i18n/           English layer: core.js (runtime translator) + dict1-5.py (Hebrew -> English), inject.py merges them into app.html
build.py            builds docs/index.html from app.html + gate + config + shim
docs/               the published site (index.html, icon.svg, manifest.webmanifest, .nojekyll)
```

`build.py` reads the app from the `SE_SRC` env var, defaulting to `/home/claude/coach.html` (the original working path). In a fresh checkout run `SE_SRC=src/app.html python3 build.py`, or change the default to `src/app.html`. After changing a dictionary, run `src/i18n/inject.py` (adjust its paths to `src/`) to re-inject into app.html, then build.

## How the app talks to the backend

app.html only calls `await claude.use('db' | 'user' | 'sample' | 'mcp' | 'downloads')`. shim.js maps these:

- **db** → table `public.user_docs(user_id uuid, coll text, doc_id text, data jsonb, updated_at)`, PK (user_id, coll, doc_id). Firestore-like API: `collection(path).doc(id).set/update/delete/get/onSnapshot`, collection `onSnapshot` with `snap.docs[i].data()`. The path prefix `data/users/<id>/` is stripped: `data/users/<id>/coach/days` → coll `coach/days`; the prefs doc `data/users/<id>` doc `coach` → coll `_root`. Realtime via `postgres_changes` filtered on user_id. Optimistic local cache plus a pending counter to ignore echoes.
- **user** → Supabase auth user (id, name from `user_metadata.full_name`, email).
- **sample** → POST to the edge function `coach-ai` with `{messages, tools, tier, system, max_tokens}`. The tool-use loop runs client-side (max 6 turns). Images are downscaled to 1568px JPEG. `sample.json` asks for JSON only and parses it.
- **mcp** (Google Calendar `list_events`, `update_event`) → Google Calendar REST with a token from Google Identity Services (`google.accounts.oauth2.initTokenClient`, scope `calendar.events`). Needs `googleClientId` in config.js. watchTool caches results in localStorage.
- **downloads** → blob + `<a download>`.

Collections: `coach/days` (per date: checks, all, ready{sleep,legs,energy}, session{run,lift}), `coach/shoes`, `coach/lifts`, `coach/food`, `coach/ai` (chat, brief-YYYY-MM-DD, week-N), `coach/meta` doc `plan` (app-built or imported plan: {source,start,paces,races,days:[{d,s}]}), `_root/coach` (prefs: display, weight, maxHr, restHr, pace, beep, voice, autoRest, diet[], planSource 'calendar'|'app', onboarded, lang).

## Security (do not weaken)

- RLS on `user_docs`: owner-only select/insert/update/delete with `(select auth.uid()) = user_id`.
- Restrictive policy "mfa if enrolled": a user who has a verified TOTP factor must be at aal2. 2FA is **optional**, turned on from Profile; the owner asked for it not to be mandatory.
- `ai_usage(user_id, day, calls, tokens)` plus `ai_bump(user, limit, tokens)` (security definer, service_role only) enforce 80 AI calls/user/day.
- Edge function `coach-ai` (verify_jwt on): checks the JWT, requires aal2 only if the user enrolled 2FA, rate-limits, then proxies to `https://api.anthropic.com/v1/messages`. Models: quick → claude-haiku-5-5, default/complex → claude-sonnet-5-5. CORS allows only the GitHub Pages origin and localhost. Secret `ANTHROPIC_API_KEY` (not set yet; the owner deferred it).
- Never put secrets in this public repo. The anon key in config.js is public by design.

## Plan data

- Plans use a micro-format, one line per day: `🏃 שבוע N | יום | text` (🏅/🏁 for races). `parseDay` turns it into modes: easy, recovery, interval, tempo, mp, long, push, pull, outdoor, core, race, rest, lift.
- Sources: the user's Google Calendar (`planSource:'calendar'`, moves write back with a swap) or the app (`planSource:'app'`, stored in `coach/meta/plan`).
- New users with no plan get a neutral placeholder week (`src:'placeholder'`), and onboarding opens automatically. Onboarding: a coach-style chat that either builds a research-based plan with `generatePlan` or imports an existing one (photo/file/text via AI, or Google Calendar).
- Research basis used in the engine and in the Fuel tab: gradual volume with a deload every 4th week; about 80% easy running (Seiler 2010); taper of 40–60% volume (Bosquet 2007); heavy strength for runners (Blagrove 2018); hypertrophy volume (Schoenfeld 2017); Riegel for paces; ACSM/AND/DC 2016 carbs by load; ISSN protein about 1.6 g/kg; IOC supplements; REDs.

## Bidi and layout rules

- Wrap number ranges with LRM: `‎5:40‎–‎6:15` (runtime: `.replace(/(\d[\d:.]*)–(\d)/g, '‎$1‎–‎$2')`). Unicode isolates rendered badly on iPhone.
- Must work at every width (phone first) without flipping text. Dark design: carbon/platinum, IBM Plex Sans Hebrew + Plex Mono, colors per workout type.

## English layer

`I18N` (src/i18n/core.js) translates text nodes and attributes through a MutationObserver when `lang === 'en'`. Numbers are templated as `#`. Exact match first, then rules, then splitting on separators (`. `, ` · `, ` + `, `, ` …). Elements with `data-noi18n` (user content, calendar event titles) are skipped; `data-en="…"` forces a label. Switching to Hebrew reloads the page. The AI gets a language note (`I18N.aiNote()`); plan text sent to tools stays in the Hebrew micro-format.

## Testing

There is no network to Supabase from a sandbox. Test the UI with Playwright by stubbing `window.supabase` (a fake createClient: auth + `from()` chain + channel) and routing the CDN script URL to the stub. For app-only checks, inject `window.claude` stubs for sample/mcp. Check: sign-in, optional 2FA enroll/verify, data load, coach tool calls, no `pageerror`s, phone width 390px, and the English mode.

## Open items

1. Google: the owner created the OAuth client. Put its Client ID in `src/config.js` (`googleClientId`), set `googleAuth: true`, rebuild, push. The Google provider must be enabled in Supabase with the client ID + secret. The consent screen is in Testing mode, so only listed test users can sign in until it's verified.
2. Anthropic key: until `ANTHROPIC_API_KEY` is set as an edge-function secret, AI features show "the coach isn't available".
3. Supabase built-in email is rate-limited; before launch, configure custom SMTP.
4. Finish the English QA pass (some long sentences still translate in fragments). Translate new strings when adding UI.
5. Offline support (service worker / PWA caching) was discussed, not built.
6. Apple sign-in requires a paid Apple developer account; not started.
7. The owner's own plan lives in his Google Calendar; it loads once Calendar is connected.

## Commit rules

Branch from `main` for big changes. End commit messages with the attribution lines the session gives. Don't commit secrets.
