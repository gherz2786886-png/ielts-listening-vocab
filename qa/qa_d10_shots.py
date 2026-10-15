# -*- coding: utf-8 -*-
import subprocess, pathlib, sys
ROOT = pathlib.Path(r"C:\Users\33362\Doubao\chats\2026-10-15\new-chat\ielts-listening-vocab")
SHOT = r"C:\Users\33362\AppData\Local\Doubao\User Data\Default\.doubao\agent_mode\workspace\.skills\html\scripts\shot.py"
HTML = str(ROOT / "index.html")
BASE = ROOT / "qa" / "qa_shots"

SEED_WRONG = """
localStorage.setItem('ieltsVocab.wrong', JSON.stringify({garden:{headword:'garden',count:2,display:'garden',meaning:'花园',page:6,scenarioId:'travel',scenario:'旅游场景',lastReason:'漏写了字母 e',updatedAt:Date.now()},
'restaurant':{headword:'restaurant',count:1,display:'restaurant',meaning:'餐厅',page:3,scenarioId:'renting',scenario:'租房场景',lastReason:'把 a 写成了 e',updatedAt:Date.now()-1000}}));
localStorage.setItem('ieltsVocab.mastered', JSON.stringify({'parking lot':1}));
localStorage.setItem('ieltsVocab.learned', JSON.stringify({'p02-001':1,'p02-002':1}));
"""

VIEWS = [
  ("v1_learn", "--only", "desktop",
   "--eval", "location.hash='#/learn'; await new Promise(r=>setTimeout(r,700));"),
  ("v2_dict_setup", "--only", "desktop",
   "--eval", "location.hash='#/dictation'; await new Promise(r=>setTimeout(r,700));"),
  ("v3_dict_session", "--only", "desktop",
   "--eval", SEED_WRONG + """
location.hash='#/dictation'; await new Promise(r=>setTimeout(r,500));
var b=document.querySelector('[data-dstart]'); if(b) b.click();
await new Promise(r=>setTimeout(r,900));"""),
  ("v4_wrong", "--only", "desktop",
   "--eval", SEED_WRONG + """
location.hash='#/wrong'; await new Promise(r=>setTimeout(r,700));
var t=document.querySelector('[data-toggle-mastered]'); if(t) t.click();
await new Promise(r=>setTimeout(r,300));"""),
  ("v5_summary", "--only", "desktop",
   "--eval", SEED_WRONG + """
location.hash='#/dictation'; await new Promise(r=>setTimeout(r,400));
var rg=document.querySelector('[data-drange="page"]'); if(rg) rg.click();
await new Promise(r=>setTimeout(r,200));
var st=document.querySelector('[data-dstart]'); if(st) st.click();
await new Promise(r=>setTimeout(r,800));
var inp=document.querySelector('.dl-input')||document.querySelector('textarea')||document.querySelector('input[type=text]');
if(inp){ inp.value='zzz'; inp.dispatchEvent(new Event('input',{bubbles:true})); }
await new Promise(r=>setTimeout(r,200));
var sb=document.querySelector('[data-dsubmit]'); if(sb) sb.click();
await new Promise(r=>setTimeout(r,500));
var fin=document.querySelector('[data-dfinish]'); if(fin) fin.click();
await new Promise(r=>setTimeout(r,800));"""),
  ("v6_learn_mobile", "--only", "mobile",
   "--eval", "location.hash='#/learn'; await new Promise(r=>setTimeout(r,700));"),
]

for name, *rest in VIEWS:
    out = BASE / name
    out.mkdir(parents=True, exist_ok=True)
    cmd = ["python", SHOT, HTML, "--outdir", str(out), "--format", "jpg"] + rest
    print("=== running", name, flush=True)
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    print("rc:", r.returncode)
    if r.stdout.strip(): print(r.stdout[-800:])
    if r.stderr.strip(): print("ERR:", r.stderr[-800:])
print("done")
