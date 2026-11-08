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
src/config.js       public config: Supabase URL, anon key, googleClientId, googleAuth flag, ai flag
src/i18n/           English layer: core.js (runtime translator) + dict1-5.py (Hebrew -> English), inject.py merges them into app.html
build.py            builds docs/index.html from app.html + gate + config + shim
supabase/migrations/ SQL applied to the live project (record only; apply with the Supabase MCP or dashboard)
docs/               the published site (index.html, sw.js, icons, manifest.webmanifest, .nojekyll); sw.js and icons are hand-written, not built
```

Build with `python3 build.py` (reads `src/app.html`; override with `SE_SRC`). After changing a dictionary, run `python3 src/i18n/inject.py` to re-inject into `src/app.html`, then build.

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
- `delete_my_account()` (security definer, execute for `authenticated` only): deletes the caller's user_docs, ai_usage and auth user; requires aal2 if the caller has a verified TOTP factor. Called from Profile → delete account (type "מחק"/"delete"). SQL in `supabase/migrations/`. The advisor warning about it being callable by signed-in users is intentional.
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

Automated: `tests/` (Playwright). `cd tests && npm ci && npx playwright test --trace off` (in a sandbox with the preinstalled browser, set `PW_CHROMIUM=/opt/pw-browsers/chromium-*/chrome-linux64/chrome`). It serves `docs/` on localhost:8765 and stubs Supabase (`fixtures/supabase-stub.js`, controlled with localStorage `T_OUT`, `T_SCEN=new`, `T_LANG`), Google Calendar (`fixtures/calendar.json`, 8 weeks from 25.10.2026 plus a race) and the AI function; the clock is fixed at 8.11.2026. Specs: sign-in screen, legal pages, calendar week numbering and event times, English completeness (`I18N.full` must be empty apart from user content), onboarding without AI in both languages, AI-off mode, offline start + outbox, delete account. All at 390px. GitHub Actions (`.github/workflows/tests.yml`) also checks that `docs/` and `src/app.html` match a fresh inject + build.

There is no network to Supabase from a sandbox, so real sign-in, Calendar and email can only be checked by the owner on the live site. Add a spec when you add a feature.

## Open items

1. ~~Google~~ Done (Nov 2026): client ID in config.js, `googleAuth: true`, Supabase Google provider on, Calendar API enabled, redirect URLs set. Consent screen is **in production** (Nov 2026) with branding, home, privacy and terms links filled in. Sign-in (basic scopes) works for everyone. `calendar.events` is a sensitive scope and is not verified: Calendar connect shows Google's "unverified app" warning and is capped at 100 users for the project's lifetime. Full verification needs an owned domain (and likely a Supabase custom domain, since the sign-in redirect is on supabase.co) plus a demo video.
2. Anthropic key: not set (the owner has no budget for it yet). `ai: false` in config.js hides every AI entry point (`.no-ai` class from shim.js: coach chat, meal photo/estimate, fuel and workout analysis, AI brief refresh, plan import). The coach tab shows the rule-based `localBrief()` and the week card; onboarding skips "do you have a plan?" and builds one with `generatePlan`. To turn AI on: set the `ANTHROPIC_API_KEY` secret, then `ai: true`, rebuild.
3. ~~SMTP~~ Done: Supabase custom SMTP through Gmail (smtp.gmail.com:587, sender "Second Engine" <itaymoskovitz@gmail.com>, app password stored only in Supabase). Gmail allows about 500 mails/day; move to a domain-based provider once there is an owned domain.
4. English QA pass done (Nov 2026): a scripted tour of every tab, a calendar plan, timer, fuel race tabs and the full onboarding in English leaves only user content in Hebrew (names, calendar race names). Check `I18N.full` in the console after a tour to find gaps. Translate new strings when adding UI.
5. ~~Offline~~ Done: `docs/sw.js` (network-first for the site, cache-first for versioned CDN/fonts; never caches Supabase/Calendar/AI). shim.js mirrors each loaded collection in localStorage (`se.db.<uid>.<coll>`), queues writes made offline in `se.outbox.<uid>` and flushes on `online`; an offline start with an expired token opens the device copy. Sign-out clears both. Profile has an install row (Android prompt, iPhone instructions). PNG icons + apple-touch-icon in docs/.
6. Apple sign-in requires a paid Apple developer account; not started.
7. The owner's own plan lives in his Google Calendar; Calendar is connected and loads it.

## Workout reminders (Web Push)

- Table `push_subs` (endpoint PK, user_id, keys, tz, hour, lang, `days` = date → workout title for the next 14 days, last_sent), owner-only RLS + the same "mfa if enrolled" policy. The app fills `days` (`reminderDays()` in app.html → `SE.reminderDays` in shim.js) because calendar plans exist only in the browser; rest days are left out, so no reminder on rest days.
- Edge function `send-reminders` (source in `supabase/functions/`, verify_jwt off): GET returns the VAPID public key; POST with `x-cron-secret` sends due reminders and drops gone subscriptions. pg_cron job `send-reminders` runs at minute 5 every hour via pg_net.
- The VAPID key pair was generated by the function itself and lives in Vault (`vapid_public`, `vapid_private`, `reminders_cron_secret`), read through `reminders_config()` (service_role only). Nobody has seen the private key; the public one is in config.js (`vapidPublic`). Don't regenerate: every existing subscription would break.
- Profile row: switch + hour (05:00–21:00). On iPhone it only works from the home-screen app (iOS 16.4+), and the row says so in Safari. Signing out from Profile unsubscribes this device.

## Public pages and search

- `docs/privacy.html`, `docs/terms.html` (Hebrew + English) are generated by `python3 src/legal/page.py`; contact itaymoskovitz@gmail.com (the owner's address; also the custom SMTP sender via Gmail app password). Keep them true to what the code does (Calendar token only in the browser, device copy, AI off).
- `docs/sitemap.xml`; Search Console verified with a meta tag added in build.py.
- The sign-in screen has a short "what's inside" section (`.se-about` in gate.html) as the public landing content.

## Commit rules

Branch from `main` for big changes. End commit messages with the attribution lines the session gives. Don't commit secrets.
