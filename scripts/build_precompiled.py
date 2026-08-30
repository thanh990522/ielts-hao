from pathlib import Path
import re,json,gzip,base64,html
from bs4 import BeautifulSoup,Tag

OUT=Path('generated'); OUT.mkdir(exist_ok=True)
META={1:('Baseline & Study System','Lessons 1 & 2'),2:('Speaking Baseline & Present Time','Lessons 3 & 4'),3:('Present Time & Routines','Lessons 5 & 6'),4:('Past Time & Experiences','Lessons 7 & 8'),5:('Special Occasions & Month 1 Check','Lessons 9 & 10'),6:('Month 1 Consolidation','Lessons 11 & 12')}
ORDER={
1:['l1-t1','l1-t2','l1-t3','l1-nationalities','l1-t4','l1-t5','l1-t6','l1-t7','l1-t8','l1-t9','l1-t10','l1-t11','l1-t12','l1-t13','l1-t14','l1-t15','l1-t16','l1-t17','l1-t18','l1-t19','l1-t20'],
2:[f'l2-t{i}' for i in range(1,23)],3:[f'l3-t{i}' for i in range(1,22)],4:[f'l4-t{i}' for i in range(1,21)],5:[f'l5-t{i}' for i in range(1,22)],6:[f'l6-t{i}' for i in range(1,22)]}

def txt(x): return re.sub(r'\s+',' ',x.get_text(' ',strip=True)).strip()
def esc(s): return html.escape(s or '',quote=True)
def pack(n):
    fs=[Path('exact-v3/l1.js')] if n==1 else sorted(Path('exact-v2').glob(f'l{n}-*.js'))
    s=''.join(p.read_text(encoding='utf8') for p in fs)
    b=''.join(re.findall(r"'([A-Za-z0-9+/=]{500,})'",s))
    if not b: raise RuntimeError(f'No packed source for lesson {n}')
    return gzip.decompress(base64.b64decode(b)).decode('utf8')

def inline(s):
    s=esc(s)
    s=re.sub(r'_{3,}',lambda m:f'<input class="gap {"short" if len(m.group())<12 else "medium" if len(m.group())<24 else "long"}" type="text" autocomplete="off">',s)
    s=s.replace('❑','<input class="tickbox" type="checkbox">')
    def choice(m):
        a,b=m.group(1).strip(),m.group(2).strip()
        return f'<select class="gap medium"><option value="">— choose —</option><option>{a}</option><option>{b}</option></select>'
    if 'http' not in s:
        s=re.sub(r'\b([A-Za-z][A-Za-z’\'-]*(?:\s+[A-Za-z][A-Za-z’\'-]*)?)\s*/\s*([A-Za-z][A-Za-z’\'-]*(?:\s+[A-Za-z][A-Za-z’\'-]*)?)',choice,s)
    s=re.sub(r'(https?://[^\s<]+)',r'<a class="extlink" href="\1" target="_blank" rel="noopener">\1 ↗</a>',s)
    return s

def rows(t):
    return [[txt(c) for c in tr.find_all(['th','td'],recursive=False)] for tr in t.find_all('tr') if tr.find_all(['th','td'],recursive=False)]

def table(t,title=''):
    rr=rows(t)
    if not rr:return ''
    if re.search(r'\bmatch\b',title,re.I) and len(rr)>2 and all(len(r)==2 for r in rr):
        opts=[r[1] for r in rr[1:] if len(r)>1 and r[1]]
        q=[]
        for i,r in enumerate(rr[1:],1):
            if not r[0]:continue
            op=''.join(f'<option>{esc(v)}</option>' for v in opts)
            q.append(f'<div class="qline"><b>{i}.</b> {inline(r[0])}<select class="gap medium"><option value="">— choose —</option>{op}</select></div>')
        return ''.join(q)
    out=['<div class="tablewrap"><table class="clean-table">']
    for ri,r in enumerate(rr):
        out.append('<tr>')
        for c in r:
            tag='th' if ri==0 else 'td'; body=inline(c) if c else ('<input class="gap medium" type="text" autocomplete="off">' if ri else ''); out.append(f'<{tag}>{body}</{tag}>')
        out.append('</tr>')
    return ''.join(out)+'</table></div>'

def render(e,title=''):
    if e.name=='p':
        im=e.find_all('img'); parts=[]
        for x in im:
            src=x.get('src',''); alt=x.get('alt','')
            if src: parts.append(f'<figure class="fig"><img src="{esc(src)}" alt="{esc(alt)}"><figcaption>{esc(alt)}</figcaption></figure>')
        s=txt(e)
        if s: parts.append(f'<div class="textline">{inline(s)}</div>')
        return ''.join(parts)
    if e.name=='table': return table(e,title)
    if e.name in ('ul','ol'):
        tag=e.name; return f'<{tag} class="{"bullet-list" if tag=="ul" else "number-list"}">'+''.join(f'<li>{inline(txt(li))}</li>' for li in e.find_all('li',recursive=False))+f'</{tag}>'
    if e.name in ('h1','h2','h3','h4'): return f'<h4>{inline(txt(e))}</h4>'
    im=e.find_all('img') if hasattr(e,'find_all') else []
    if im:
        return ''.join(f'<figure class="fig"><img src="{esc(x.get("src",""))}" alt="{esc(x.get("alt",""))}"></figure>' for x in im if x.get('src'))
    s=txt(e); return f'<div class="textline">{inline(s)}</div>' if s else ''

def secmark(e):
    if e.name!='table':return None
    r=rows(e)
    if not r or len(r[0])<2:return None
    a,b=r[0][0],r[0][1]
    if re.fullmatch(r'\d+',a or '') and 'FOUNDATION 1' not in b.upper(): return (a,b)

def phase(e):
    s=txt(e).upper()
    if s.startswith('PART 1'):return 'p1'
    if s.startswith('PART 2'):return 'p2'
    if re.match(r'^E1\s+EXTENSION PRACTICE',s):return 'e1'
    if re.match(r'^E2\s+EXTENSION PRACTICE',s):return 'e2'
    if re.match(r'^H\s+HOMEWORK',s):return 'hw'

def tasktitle(e):
    s=txt(e)
    m=re.match(r'^((?:TASK|CHECKPOINT)\s+[A-Z0-9]+\s*·?\s*.*?)(?=\s+\d+\.\s|$)',s,re.I)
    return (m.group(1) if m else s) if re.match(r'^(TASK|CHECKPOINT)\s+[A-Z0-9]+',s,re.I) else None

def cleanlabel(s):
    s=re.sub(r'^\d+\s*','',s).strip(); s=re.sub(r'\s+',' ',s)
    return s.title() if s.isupper() else s

def build(n):
    soup=BeautifulSoup(pack(n),'html.parser'); ch=[x for x in soup.body.children if isinstance(x,Tag)]
    major=[{'id':'overview','label':'🌟 Overview','title':'Lesson Overview','subtabs':[]}]
    p1={'id':'part1','label':f'📘 Part 1 · Lesson {n*2-1}','title':'Part 1','subtabs':[]}; p2={'id':'part2','label':f'🧩 Part 2 · Lesson {n*2}','title':'Part 2','subtabs':[]}; hw={'id':'homework','label':'🏠 Homework','title':'Homework','subtabs':[],'html':''}
    cur='overview'; sec={'id':'overview','label':'Overview','title':'Overview','buf':[]}; sections={'overview':[sec],'p1':[],'p2':[],'e1':[],'e2':[]}; ti=0; task=None
    def close_task():
        nonlocal task
        if task:
            body=''.join(task['buf']); title=task.get('title','')
            if re.search(r'\b(write|paragraph|narrative|essay)\b',title,re.I) and 'longanswer' not in body:
                task['buf'].append('<div class="writingbox"><textarea class="longanswer" rows="7" placeholder="Type your answer here…"></textarea><div class="wordcount">0 words</div></div>')
            if re.search(r'\b(speaking|speak|talk|record)\b',title,re.I):
                task['buf'].append('<div class="recorder"><button class="record-btn" type="button">🎙 Start recording</button><span class="record-time">00:00</span><audio class="record-play" controls hidden></audio><span class="record-note">Record your answer directly in the browser.</span></div>')
            task['buf'].append('<div class="btnrow"><button class="b check" type="button">✓ Check</button><button class="b answer" type="button">💡 Answer & explanation</button><button class="b reset" type="button">↺ Reset</button><span class="score"></span></div><div class="ansbox" hidden></div></div>'); task=None
    def add(h):
        if task: task['buf'].append(h)
        else: sec['buf'].append(h)
    for e in ch:
        ph=phase(e)
        if ph:
            close_task(); cur=ph
            if ph=='hw': sec=None; continue
            sec={'id':ph+'-intro','label':'Overview' if ph in ('p1','p2') else '✨ Extra Practice','title':'Extra Practice' if ph.startswith('e') else 'Overview','buf':[]}; sections[ph].append(sec); continue
        if cur=='hw':
            if e.name in ('ul','ol'):
                hw['html'] += ''.join(f'<label class="qline"><input class="tickbox" type="checkbox"> {inline(txt(li))}</label>' for li in e.find_all('li',recursive=False))
            else: hw['html']+=render(e)
            continue
        sm=secmark(e)
        if sm and cur in ('p1','p2'):
            close_task(); sec={'id':f'{cur}-{sm[0]}','label':cleanlabel(sm[1]),'title':cleanlabel(sm[1]),'buf':[]}; sections[cur].append(sec); continue
        tt=tasktitle(e)
        if tt:
            close_task(); tid=ORDER[n][ti] if ti<len(ORDER[n]) else f'l{n}-auto-{ti+1}'; ti+=1
            task={'id':tid,'title':tt,'buf':[f'<div class="exercise" data-task-id="{tid}"><div class="ex-head"><span class="exno">{ti}</span><h4>{esc(tt)}</h4></div>']}; add(render(e,tt)); continue
        add(render(e, task['title'] if task else ''))
    close_task()
    def finish(a):
        out=[]
        for s in a:
            h=''.join(s.pop('buf',[]))
            if h.strip(): s['html']=h; out.append(s)
        return out
    ov=finish(sections['overview']); p1s=finish(sections['p1']); p2s=finish(sections['p2']); e1=finish(sections['e1']); e2=finish(sections['e2'])
    if ov: major[0]['html']=''.join(x['html'] for x in ov)
    if e1: p1s += [{'id':'extra1','label':'✨ Extra Practice','title':'Extra Practice','html':''.join(x['html'] for x in e1)}]
    if e2: p2s += [{'id':'extra2','label':'✨ Extra Practice','title':'Extra Practice','html':''.join(x['html'] for x in e2)}]
    p1['subtabs']=p1s; p2['subtabs']=p2s; major += [p1,p2,hw]
    d={'id':n,'title':META[n][0],'sub':META[n][1],'major':major}
    (OUT/f'lesson-{n}.js').write_text('window.IELTS_PRECOMPILED=window.IELTS_PRECOMPILED||{};window.IELTS_PRECOMPILED[%d]=%s;'%(n,json.dumps(d,ensure_ascii=False,separators=(',',':'))),encoding='utf8')
    print(n,ti,(OUT/f'lesson-{n}.js').stat().st_size)
for n in range(1,7): build(n)
idx=Path('index.html').read_text(encoding='utf8')
start=idx.find('<script src="exact-v3/l1.js"></script>'); end=idx.rfind('</body>')
if start<0 or end<0: raise RuntimeError('index.html script block not found')
gen=''.join(f'<script src="generated/lesson-{n}.js"></script>' for n in range(1,7))
idx=idx[:start]+'<script src="data-fixes.js"></script>'+gen+'<script src="interactive-v3.js"></script>'+idx[end:]
idx=idx.replace('PERSONALIZED IELTS PROGRAM · INTERACTIVE COURSE','PERSONALIZED IELTS PROGRAM · INTERACTIVE v7')
idx=idx.replace('Aim: <strong>6.0+</strong>','Aim: <strong>6.0+</strong><br><small>Version: Interactive v7</small>')
Path('index.html').write_text(idx,encoding='utf8')
print('Interactive v7 prebuild complete')
