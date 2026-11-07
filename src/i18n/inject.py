#!/usr/bin/env python3
"""Merge the English dictionaries and inject them (plus core.js) into coach.html."""
import json, re, importlib.util, pathlib
H = pathlib.Path('/home/claude/i18n')
D = {}
for n in ['dict1','dict2','dict3','dict4','dict5']:
    p = H / (n + '.py')
    if not p.exists(): continue
    spec = importlib.util.spec_from_file_location(n, p); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    D.update(m.D)
norm = lambda s: re.sub(r'\s+', ' ', re.sub('[‎‏⁦-⁩]', '', s)).strip()
D = {norm(k): v for k, v in D.items()}
RULES = r'''[
  [/^(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת) (.+)$/, (m, P) => P(m[1]) + ' ' + P(m[2])],
  [/^יום (ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)(.*)$/, (m, P) => P('יום ' + m[1]) + P(m[2])],
  [/^מתי ה(.+)\?$/, (m, P) => 'When is the ' + P(m[1]).replace(/^./, c => c.toLowerCase()) + '?'],
  [/^(.+) סט (\d+)$/, (m, P) => P(m[1]) + ' set ' + m[2]]
]'''
js = 'I18N.load(' + json.dumps(D, ensure_ascii=False, separators=(',', ':')) + ', ' + RULES + ');\n'
c = open('/home/claude/coach.html').read()
a = c.index('/* @i18n-dict */\n') + len('/* @i18n-dict */\n'); b = c.index('/* @i18n-dict-end */')
c = c[:a] + js + c[b:]
core = (H / 'core.js').read_text()
a = c.index('/* @i18n-core */\n') + len('/* @i18n-core */\n'); b = c.index('function langSampler(sm)')
c = c[:a] + core + c[b:]
open('/home/claude/coach.html', 'w').write(c)
print('entries', len(D), 'bytes', len(js))
