#!/usr/bin/env python3
"""Build the standalone Second Engine site (site/index.html) from the claude.ai artifact source."""
import pathlib, sys
ROOT = pathlib.Path(__file__).parent
import os
app = pathlib.Path(os.environ.get('SE_SRC', '/home/claude/coach.html')).read_text()
shim = (ROOT / 'src/shim.js').read_text()
gate = (ROOT / 'src/gate.html').read_text()
cfg = (ROOT / 'src/config.js').read_text()

def rep(s, old, new, count=1):
    if old not in s:
        sys.exit('build: pattern not found: ' + old[:80])
    return s.replace(old, new, count)

# head / body split: the artifact file has head content then body markup
first_script = app.index('<script>')
head_end = app.index('</style>') + len('</style>')
head = app[:head_end]
body = app[head_end:]

# profile: live security rows
body = rep(body, '<span class="pill ok">פעיל</span></div>\n      <div class="row"><span>סיסמה<small>שינוי סיסמה ואיפוס דרך המייל</small></span><span class="pill">בגרסה עם השרת</span></div>',
  '<span class="pill ok">פעיל</span></div>\n      <div class="row"><span>סיסמה<small>שינוי הסיסמה לחשבון</small></span><button type="button" class="pill" id="sePwBtn">שינוי</button></div>\n'
  '      <form class="se-pw" id="sePwForm" hidden novalidate><input type="password" id="sePwNew" autocomplete="new-password" placeholder="סיסמה חדשה" aria-label="סיסמה חדשה"><button class="btn primary" type="submit">שמירה</button><small id="sePwMsg" role="status"></small></form>')
body = rep(body, '<span>אימות דו-שלבי<small>קוד מאפליקציית אימות בכל כניסה ממכשיר חדש</small></span><span class="pill">בגרסה עם השרת</span>',
  '<span>אימות דו-שלבי<small id="se2faState">קוד מאפליקציית אימות בכל מכשיר חדש</small></span><button type="button" class="pill" id="se2faBtn">…</button>')
body = rep(body, '<span>מכשירים מחוברים<small>ניתוק מרחוק של טלפון או מחשב</small></span><span class="pill">בגרסה עם השרת</span></div>',
  '<span>מכשירים מחוברים<small>ניתוק מרחוק של כל שאר המכשירים</small></span><button type="button" class="pill" id="seOthers">נתק אחרים</button></div>\n'
  '      <div class="row"><span>יציאה<small>יציאה מהחשבון במכשיר הזה</small></span><button type="button" class="pill" id="seSignOut">התנתק</button></div>')
body = rep(body, 'הנתונים שלך שמורים באופן פרטי ורק אתה יכול לקרוא אותם. סיסמה ואימות דו-שלבי ייכנסו כשהאפליקציה תעבור לשרת משלה לקראת ההשקה.',
  'הנתונים שלך שמורים בשרת מאובטח באירופה, ורק אתה יכול לקרוא אותם. עם אימות דו-שלבי, כניסה ממכשיר חדש תדרוש גם קוד מהטלפון.')
body = rep(body, 'כרגע דרך חשבון Claude שלך', '')

# calendar messages for the standalone build
body = rep(body, "server_not_connected: 'כדי לטעון את כל התוכנית צריך לחבר את Google Calendar ב-claude.ai, בהגדרות ← Connectors.'",
  "server_not_connected: 'החיבור ל-Google Calendar עוד לא הוגדר בשרת.'")
body = rep(body, "needs_reauth: 'החיבור ל-Google Calendar פג. חבר אותו מחדש ב-claude.ai, בהגדרות ← Connectors.'",
  "needs_reauth: 'החיבור ל-Google Calendar פג. לחץ כדי לחבר שוב.'")
body = rep(body, "['server_not_connected','needs_reauth','blocked_by_policy']", "['server_not_connected','blocked_by_policy']")
for old in ["'המאמן זמין רק כשהאפליקציה פתוחה בתוך claude.ai'", "'ניתוח תמונות זמין רק בתוך claude.ai'"]:
    body = body.replace(old, "'המאמן לא זמין כרגע'")

# load order: config + supabase + GIS + shim, then the gate markup, then the app script
inject = (gate + '\n<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>\n'
          '<script src="https://accounts.google.com/gsi/client" async></script>\n'
          '<script>\n' + cfg + '\n</script>\n<script>\n' + shim + '\n</script>\n')
i = body.index('<script>')
body = body[:i] + inject + body[i:]

title_line = head.split('\n', 1)
out = ('<!doctype html>\n<html lang="he" dir="rtl">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
       '<meta name="theme-color" content="#0E0F11">\n<meta name="referrer" content="strict-origin-when-cross-origin">\n'
       '<link rel="icon" href="icon.svg" type="image/svg+xml">\n<link rel="manifest" href="manifest.webmanifest">\n'
       '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
       + head.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '') +
       '\n<style>html,body{margin:0}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style>\n'
       '</head>\n<body>\n' + body + '\n</body>\n</html>\n')
(ROOT / 'docs').mkdir(exist_ok=True)
(ROOT / 'docs/index.html').write_text(out)
print('built', len(out), 'bytes')
