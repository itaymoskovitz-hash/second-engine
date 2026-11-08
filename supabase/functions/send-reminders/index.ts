// send-reminders: daily workout reminders through Web Push.
//   GET  -> {publicKey} (the VAPID public key the browser subscribes with; public by design)
//   POST -> called hourly by pg_cron with the x-cron-secret header; sends today's workout to every
//           subscription whose local hour matches, once per day. Subscriptions the push service reports gone are removed.
// The VAPID key pair is created here on first use and kept in Vault (reminders_store_keys / reminders_config,
// service_role only), so no key is ever in the repo or typed by hand. Deployed with verify_jwt off: POST checks
// the cron secret itself, GET returns only public data.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const ORIGINS = ["https://itaymoskovitz-hash.github.io", "http://localhost:8765"];
type Cfg = { vapid_public: string; vapid_private: string; reminders_cron_secret: string };
let cfg: Cfg | null = null;

async function config(): Promise<Cfg> {
  if (cfg?.vapid_private) return cfg;
  let { data, error } = await sb.rpc("reminders_config");
  if (error) throw error;
  if (!data?.vapid_private) {
    const k = webpush.generateVAPIDKeys();
    const r = await sb.rpc("reminders_store_keys", { pub: k.publicKey, priv: k.privateKey });
    if (r.error) throw r.error;
    ({ data, error } = await sb.rpc("reminders_config"));
    if (error) throw error;
  }
  cfg = data as Cfg;
  return cfg;
}

function local(tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const cors = {
    "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const c = await config();
    if (req.method === "GET") return Response.json({ publicKey: c.vapid_public }, { headers: { ...cors, "Cache-Control": "public, max-age=3600" } });
    if (req.method !== "POST" || req.headers.get("x-cron-secret") !== c.reminders_cron_secret) return new Response("forbidden", { status: 403 });

    webpush.setVapidDetails("mailto:itaymoskovitz@gmail.com", c.vapid_public, c.vapid_private);
    const { data: subs, error } = await sb.from("push_subs").select("endpoint,p256dh,auth,tz,hour,lang,days,last_sent");
    if (error) throw error;
    let sent = 0, gone = 0;
    for (const s of subs || []) {
      let L;
      try { L = local(s.tz); } catch { L = local("Asia/Jerusalem"); }
      if (L.hour !== s.hour || s.last_sent === L.date) continue;
      await sb.from("push_subs").update({ last_sent: L.date }).eq("endpoint", s.endpoint);
      const body = s.days?.[L.date];
      if (!body) continue; // rest day or no plan for today: no reminder
      const payload = JSON.stringify({ title: s.lang === "en" ? "Today's workout" : "האימון של היום", body, url: "./" });
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) { await sb.from("push_subs").delete().eq("endpoint", s.endpoint); gone++; }
        else console.error("push failed", code);
      }
    }
    return Response.json({ sent, gone });
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500, headers: cors });
  }
});
