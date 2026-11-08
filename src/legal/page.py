#!/usr/bin/env python3
"""Builds docs/privacy.html and docs/terms.html (Hebrew + English on one page). Run from the repo root."""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]
MAIL = 'itaymoskovitz@gmail.com'
UPDATED_HE, UPDATED_EN = 'נובמבר 2026', 'November 2026'

CSS = """:root{color-scheme:dark;--ink:#0E0F11;--panel:#16181B;--line:#2A2D31;--platinum:#E9E6E0;--steel:#9A9790;--accent:#7FB4C6}
*{box-sizing:border-box}html,body{margin:0;background:var(--ink);color:var(--platinum)}
body{font-family:"IBM Plex Sans Hebrew","Segoe UI",Arial,sans-serif;font-size:15.5px;line-height:1.7;-webkit-font-smoothing:antialiased}
main{max-width:720px;margin:0 auto;padding:28px 16px 64px}
a{color:var(--accent)}h1{font-weight:500;font-size:28px;line-height:1.2;margin:8px 0 4px}h2{font-weight:600;font-size:18px;margin:28px 0 6px}
.upd{color:var(--steel);font-size:13px;margin:0 0 20px}.top{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:14px}
.lang{border-top:1px solid var(--line);margin-top:48px;padding-top:24px}ul{padding-inline-start:20px}li{margin:4px 0}p{margin:8px 0}"""

def page(name, title_he, title_en, he, en):
    out = f"""<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title_he} · Second Engine</title><meta name="description" content="{title_he} של Second Engine. {title_en}.">
<link rel="icon" href="icon.svg" type="image/svg+xml"><link rel="canonical" href="https://itaymoskovitz-hash.github.io/second-engine/{name}">
<style>{CSS}</style></head><body><main>
<div class="top"><a href="./">חזרה לאפליקציה</a><a href="#en" lang="en">English</a></div>
<h1>{title_he}</h1><p class="upd">עודכן: {UPDATED_HE}</p>
{he}
<section class="lang" id="en" lang="en" dir="ltr"><h1>{title_en}</h1><p class="upd">Last updated: {UPDATED_EN}</p>
{en}</section>
</main></body></html>
"""
    (ROOT / 'docs' / name).write_text(out)

PRIV_HE = f"""
<p>Second Engine היא אפליקציית ליווי אימונים למי שמשלב ריצה ואימוני כוח. המסמך מסביר איזה מידע נשמר, למה, ואיך אפשר למחוק אותו.</p>
<h2>איזה מידע נשמר</h2>
<ul>
<li><b>חשבון:</b> מייל, שם, ודרך הכניסה (מייל וסיסמה או Google). סיסמאות נשמרות מוצפנות ואנחנו לא יכולים לקרוא אותן.</li>
<li><b>נתוני אימון שאתה מזין:</b> תוכנית האימונים, סימוני ביצוע, מוכנות (שינה, רגליים, אנרגיה), סיכומי אימון, משקלים, נעליים, יומן תזונה, ופרטים שבחרת למלא בפרופיל: משקל, דופק, קצב יעד והגבלות תזונה.</li>
<li><b>אימות דו-שלבי:</b> אם הפעלת אותו, נשמר מפתח האימות לצורך בדיקת הקודים.</li>
</ul>
<h2>איפה המידע נשמר</h2>
<p>בשרת של Supabase באירופה (פרנקפורט), מוצפן בדרך ובאחסון. כללי גישה בבסיס הנתונים מאפשרים לכל משתמש לקרוא ולשנות רק את הנתונים שלו. עותק של הנתונים נשמר גם בדפדפן במכשיר שלך, כדי שהאפליקציה תעבוד בלי אינטרנט. היציאה מהחשבון מוחקת את העותק הזה.</p>
<h2>כניסה ויומן של גוגל</h2>
<ul>
<li><b>כניסה עם Google:</b> אנחנו מקבלים את השם והמייל שלך בלבד.</li>
<li><b>Google Calendar (רק אם חיברת):</b> האפליקציה קוראת את האירועים ביומן כדי להציג את תוכנית האימונים שלך, ומשנה אירוע אימון רק כשאתה מבקש להזיז אותו. הגישה ניתנת בדפדפן שלך. אישור הגישה לא נשמר בשרת שלנו, והאירועים לא נשלחים לשרת שלנו, חוץ מכותרות האימונים אם הפעלת תזכורות (ראה למטה). עותק של האירועים נשמר בדפדפן שלך בלבד.</li>
<li>השימוש במידע מ-Google עומד ב-<a href="https://developers.google.com/terms/api-services-user-data-policy">מדיניות נתוני המשתמשים של Google API Services</a>, כולל דרישות השימוש המוגבל (Limited Use). המידע לא משמש לפרסום, לא נמכר ולא מועבר לאחרים.</li>
</ul>
<h2>תזכורות</h2>
<p>אם הפעלת תזכורת לאימון בפרופיל, נשמרים בשרת כתובת ההתראות של הדפדפן שלך, אזור הזמן, השעה שבחרת וכותרות האימונים של 14 הימים הקרובים, כדי לשלוח לך בבוקר את האימון של היום. כיבוי התזכורת או יציאה מהחשבון מוחקים את המידע הזה.</p>
<h2>בינה מלאכותית</h2>
<p>תכונות המאמן החכם כבויות כרגע. אם יופעלו, הנתונים הרלוונטיים לשאלה שלך (למשל האימונים האחרונים) יישלחו ל-Anthropic רק כדי לנסח תשובה. Anthropic לא משתמשת בהם לאימון מודלים.</p>
<h2>מה אנחנו לא עושים</h2>
<p>אין פרסומות, אין מכירת מידע ואין כלי מעקב או אנליטיקס של צד שלישי. הגופנים נטענים מ-Google Fonts וקוד הספרייה מ-jsDelivr, ולכן השירותים האלה רואים את כתובת ה-IP שלך כמו בכל אתר.</p>
<h2>הזכויות שלך</h2>
<ul>
<li><b>ייצוא:</b> בפרופיל ← הנתונים שלי ← הורד קובץ.</li>
<li><b>מחיקה:</b> בפרופיל ← הנתונים שלי ← מחיקת החשבון. החשבון וכל הנתונים נמחקים מיד ולצמיתות. אפשר גם לשלוח מייל ל-<a href="mailto:{MAIL}">{MAIL}</a> מהכתובת של החשבון, ונמחק תוך 30 יום.</li>
<li><b>ביטול הגישה ליומן:</b> בכל רגע, ב-<a href="https://myaccount.google.com/permissions">הרשאות חשבון Google</a>.</li>
</ul>
<h2>גיל</h2><p>האפליקציה מיועדת לבני 16 ומעלה.</p>
<h2>שינויים ויצירת קשר</h2><p>אם המדיניות תשתנה, נעדכן את התאריך בראש הדף. שאלות: <a href="mailto:{MAIL}">{MAIL}</a></p>
"""
PRIV_EN = f"""
<p>Second Engine is a training companion for people who combine running and strength training. This page explains what we store, why, and how to delete it.</p>
<h2>What we store</h2>
<ul>
<li><b>Account:</b> email, name and sign-in method (email and password, or Google). Passwords are stored hashed; we cannot read them.</li>
<li><b>Training data you enter:</b> your plan, completed workouts, readiness (sleep, legs, energy), workout summaries, lifts, shoes, food log, and optional profile details: weight, heart rate, target pace and dietary restrictions.</li>
<li><b>Two-step verification:</b> if you turn it on, the authenticator secret is stored to check your codes.</li>
</ul>
<h2>Where it is stored</h2>
<p>On Supabase servers in the EU (Frankfurt), encrypted in transit and at rest. Database access rules let each user read and change only their own data. A copy is also kept in your browser so the app works offline; signing out deletes it.</p>
<h2>Google</h2>
<ul>
<li><b>Sign in with Google:</b> we receive only your name and email.</li>
<li><b>Google Calendar (only if you connect it):</b> the app reads your calendar events to show your training plan, and changes a training event only when you ask to move it. Access is granted in your browser; the access token is not stored on our server and your events are not sent to our server, except workout titles if you turn on reminders (see below). A copy of the events is kept only in your browser.</li>
<li>Second Engine's use of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements. It is not used for advertising, not sold and not shared.</li>
</ul>
<h2>Reminders</h2>
<p>If you turn on the workout reminder in your profile, we store your browser's push address, time zone, chosen hour and the titles of your next 14 days' workouts, to send you today's workout in the morning. Turning the reminder off or signing out deletes this.</p>
<h2>AI</h2>
<p>The AI coach features are currently off. If they are turned on, the data relevant to your question (for example recent workouts) is sent to Anthropic only to write a reply. Anthropic does not use it to train models.</p>
<h2>What we don't do</h2>
<p>No ads, no selling of data, no third-party tracking or analytics. Fonts load from Google Fonts and a library from jsDelivr, so those services see your IP address as with any website.</p>
<h2>Your rights</h2>
<ul>
<li><b>Export:</b> Profile → My data → Download file.</li>
<li><b>Deletion:</b> Profile → My data → Delete account removes your account and all data immediately and permanently. You can also email <a href="mailto:{MAIL}">{MAIL}</a> from your account's address and we'll delete it within 30 days.</li>
<li><b>Revoke calendar access:</b> any time, in your <a href="https://myaccount.google.com/permissions">Google Account permissions</a>.</li>
</ul>
<h2>Age</h2><p>The app is meant for people 16 and older.</p>
<h2>Changes and contact</h2><p>If this policy changes, we update the date at the top. Questions: <a href="mailto:{MAIL}">{MAIL}</a></p>
"""
TERMS_HE = f"""
<p>השימוש ב-Second Engine מותנה בתנאים האלה. אם אתה לא מסכים להם, אל תשתמש באפליקציה.</p>
<h2>לא ייעוץ רפואי</h2>
<p>התוכניות, הקצבים, המלצות התזונה וההערות באפליקציה הם מידע כללי לאימון, ולא ייעוץ רפואי או תזונתי אישי. לפני תחילת תוכנית אימונים, ובמיוחד אם יש לך מצב רפואי, כאב או פציעה, התייעץ עם רופא או איש מקצוע. הקשב לגוף שלך ועצור אם משהו לא מרגיש נכון.</p>
<h2>החשבון שלך</h2>
<p>אתה אחראי לשמור על הסיסמה ועל המכשיר שלך. מומלץ להפעיל אימות דו-שלבי בפרופיל. אל תשתמש באפליקציה כדי לפגוע בשירות או במשתמשים אחרים.</p>
<h2>התוכן שלך</h2>
<p>הנתונים שאתה מזין שייכים לך. אתה נותן לנו רשות לשמור ולעבד אותם רק כדי להפעיל את האפליקציה עבורך. פרטים במדיניות <a href="privacy.html">הפרטיות</a>.</p>
<h2>השירות</h2>
<p>האפליקציה ניתנת כמו שהיא (AS IS), בלי התחייבות לזמינות רציפה או לדיוק. אנחנו עשויים לשנות, להוסיף או להפסיק תכונות. ככל שהחוק מתיר, Second Engine ומפעיליה לא אחראים לנזק או לפציעה שנובעים מהשימוש באפליקציה.</p>
<h2>סיום</h2>
<p>אפשר להפסיק להשתמש ולמחוק את החשבון מהפרופיל בכל זמן. אנחנו רשאים לחסום חשבון שמשתמש לרעה בשירות.</p>
<h2>דין</h2><p>על התנאים חל הדין הישראלי.</p>
<h2>יצירת קשר</h2><p><a href="mailto:{MAIL}">{MAIL}</a></p>
"""
TERMS_EN = f"""
<p>Using Second Engine means you accept these terms. If you don't agree, please don't use the app.</p>
<h2>Not medical advice</h2>
<p>Plans, paces, nutrition guidance and notes in the app are general training information, not personal medical or dietary advice. Before starting a training plan, and especially if you have a medical condition, pain or an injury, consult a doctor or qualified professional. Listen to your body and stop if something feels wrong.</p>
<h2>Your account</h2>
<p>You are responsible for keeping your password and device secure. We recommend turning on two-step verification in your profile. Don't use the app to harm the service or other users.</p>
<h2>Your content</h2>
<p>The data you enter belongs to you. You allow us to store and process it only to run the app for you. Details are in the <a href="privacy.html">privacy policy</a>.</p>
<h2>The service</h2>
<p>The app is provided as is, without any promise of availability or accuracy. We may change, add or remove features. To the extent the law allows, Second Engine and its operators are not liable for damage or injury resulting from using the app.</p>
<h2>Ending</h2>
<p>You can stop using the app and delete your account from your profile at any time. We may block an account that abuses the service.</p>
<h2>Law</h2><p>These terms are governed by the laws of Israel.</p>
<h2>Contact</h2><p><a href="mailto:{MAIL}">{MAIL}</a></p>
"""
page('privacy.html', 'מדיניות פרטיות', 'Privacy policy', PRIV_HE, PRIV_EN)
page('terms.html', 'תנאי שימוש', 'Terms of use', TERMS_HE, TERMS_EN)
base = 'https://itaymoskovitz-hash.github.io/second-engine/'
(ROOT / 'docs/sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + ''.join(f'  <url><loc>{base}{p}</loc></url>\n' for p in ['', 'privacy.html', 'terms.html']) + '</urlset>\n')
print('legal pages built')
