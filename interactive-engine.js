(function(){
  'use strict';

  const STORE_PREFIX='ielts-hao-direct-v1';
  const OPEN_WORDS=/\b(write|describe|explain|plan|paragraph|sentences?|response|answer|log|self-assessment|priorities|retell|rewrite)\b/i;
  const SPEAK_WORDS=/\b(speak|speaking|record|pronunciation|repeat|read aloud|part 2|part 3|topic talk|response)\b/i;
  const CHOICE_WORDS=/\b(choose|circle|agree or disagree|odd one out|multiple-choice|correct option)\b/i;
  const MATCH_WORDS=/\b(match|classify|group|sort|order|reorder|put .* order|chronology)\b/i;
  const FIXED_FALSE=/answers? vary|no single answer|no fixed answer|possible:|self-check|use text evidence only|complete the linked|attempt .* before|check against the teacher|sample structure|suggested structure|model structure/i;

  function norm(s){
    return String(s||'').toLowerCase().replace(/<[^>]*>/g,' ').replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').replace(/[.!,;:]+$/g,'').trim();
  }

  function plain(html, doc){
    const d=(doc||document).createElement('div');d.innerHTML=html||'';return d.textContent.replace(/\s+/g,' ').trim();
  }

  function expectedTokens(task, doc){
    if(!task || !task.answer || FIXED_FALSE.test(plain(task.answer,doc))) return [];
    const holder=doc.createElement('div');holder.innerHTML=task.answer;
    const lis=[...holder.querySelectorAll('li')].map(li=>li.textContent.trim()).filter(Boolean);
    let parts=[];
    if(lis.length){
      lis.forEach(x=>{const noLead=x.replace(/^\s*\d+[.)]?\s*/,'').trim();parts.push(...noLead.split(/\s*[;·]\s*/).filter(Boolean));});
    } else {
      let text=holder.textContent.replace(/^\s*(?:Past forms|Source answers?|Past tense|Answers?|Check|Key source details include)\s*:\s*/i,'').trim();
      parts=text.split(/\s*[·;]\s*/).filter(Boolean);
      if(parts.length===1 && /\s\/\s|\//.test(parts[0]) && parts[0].length<120)parts=parts[0].split(/\s*\/\s*/).filter(Boolean);
    }
    return parts.map(x=>x.replace(/^\s*\d+[.)]?\s*/,'').replace(/^\s*[a-z]\s*[→-]\s*/i,'').replace(/<[^>]*>/g,'').replace(/\s*\([^)]*\)\s*$/,'').trim()).filter(x=>x && x.length<120 && !/^(why|use|focus|listen|look|check|start|sample|model|reminder)\b/i.test(x));
  }

  function taskType(task){
    const text=((task?.title||'')+' '+(task?.body||'')).replace(/<[^>]*>/g,' ');
    if(SPEAK_WORDS.test(text)) return 'speaking';
    if(MATCH_WORDS.test(text)) return 'matching';
    if(CHOICE_WORDS.test(text)) return 'choice';
    if(OPEN_WORDS.test(text)) return 'writing';
    return 'short';
  }

  function storeKey(lessonId,taskId,field){return `${STORE_PREFIX}-${lessonId}-${taskId}-${field}`}
  function loadVal(key){try{return localStorage.getItem(key)||''}catch(e){return ''}}
  function saveVal(key,val){try{localStorage.setItem(key,val)}catch(e){}}
  function clearTask(lessonId,taskId){try{const prefix=`${STORE_PREFIX}-${lessonId}-${taskId}-`;Object.keys(localStorage).filter(k=>k.startsWith(prefix)).forEach(k=>localStorage.removeItem(k));}catch(e){}}

  function bindSave(el,key){
    if(el.type==='radio'||el.type==='checkbox'){
      const v=loadVal(key);if(el.type==='checkbox') el.checked=v==='1';else el.checked=v===el.value;
      el.addEventListener('change',()=>saveVal(key,el.type==='checkbox'?(el.checked?'1':'0'):el.value));
    }else{el.value=loadVal(key);el.addEventListener('input',()=>saveVal(key,el.value));el.addEventListener('change',()=>saveVal(key,el.value));}
  }

  function styleDocument(doc){
    if(doc.getElementById('direct-interactive-style')) return;
    const style=doc.createElement('style');style.id='direct-interactive-style';style.textContent=`
      html{scroll-behavior:smooth}.site-tools,.site-answer,.site-note{display:none!important}
      .direct-input,.direct-textarea,.direct-select{font:11.5pt/1.45 Tahoma,Arial,sans-serif!important;color:#17324d;background:#fff!important;border:1.5px solid #8ecfd4!important;border-radius:8px!important;outline:none!important;box-shadow:0 1px 0 rgba(0,0,0,.02)!important;transition:.15s ease!important}
      .direct-input{min-width:92px;max-width:230px;padding:5px 8px;margin:1px 4px;vertical-align:baseline}.direct-textarea{display:block;width:100%;min-height:110px;padding:10px 12px;resize:vertical;margin-top:8px}
      .direct-input:focus,.direct-textarea:focus,.direct-select:focus{border-color:#168f97!important;box-shadow:0 0 0 3px rgba(37,163,170,.13)!important}.direct-input.correct{border-color:#3b9c56!important;background:#f1fff4!important}.direct-input.wrong{border-color:#d45b5b!important;background:#fff5f5!important}
      .interactive-card{margin:10px 0 16px;padding:12px 13px;border:1px solid #b9dfe3;border-left:5px solid #20a0a8;border-radius:12px;background:linear-gradient(180deg,#fbffff,#f4fcfd);font:11pt/1.5 Tahoma,Arial,sans-serif;color:#17324d;break-inside:avoid}.interactive-card.compact{padding:9px 11px}
      .interactive-title{display:flex;align-items:center;gap:7px;font-weight:800;color:#0e7077;margin-bottom:7px}.interactive-hint{font-size:9.5pt;color:#6b7c8d;margin-bottom:7px}.interactive-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px;align-items:center}
      .direct-btn{border:1px solid #9fcfd4;background:#fff;color:#135e64;border-radius:9px;padding:6px 10px;font:700 9.5pt Tahoma,Arial,sans-serif;cursor:pointer}.direct-btn.primary{background:#167f87;color:#fff;border-color:#167f87}.direct-btn.answer{background:#fff3be;border-color:#e1c45b;color:#6b5300}.direct-btn.danger{color:#a23d3d;border-color:#efb5b5;background:#fff9f9}.direct-btn:hover{filter:brightness(.98);transform:translateY(-1px)}
      .direct-feedback{display:none;margin-top:9px;padding:8px 10px;border-radius:9px;background:#eef9fb;border:1px solid #c4e5e8;font-weight:700}.direct-feedback.open{display:block}.direct-feedback.good{background:#effbf2;border-color:#b8dfc1;color:#27713b}.direct-feedback.warn{background:#fff8e3;border-color:#ead791;color:#725c14}
      .direct-answer{display:none;margin-top:9px;padding:10px 12px;border-radius:9px;background:#f2fff5;border:1px solid #b8dec0;border-left:4px solid #43a65c;color:#183f25}.direct-answer.open{display:block}.direct-answer:before{content:'✓ Answer & explanation';display:block;font-weight:900;color:#2c743e;margin-bottom:5px}
      .slot-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:7px}.slot{display:flex;align-items:center;gap:6px}.slot b{font-size:9pt;color:#5f7486;min-width:22px}.slot .direct-input{width:100%;max-width:none;margin:0}
      .choice-row{display:flex;gap:8px;align-items:flex-start;padding:7px 9px;border:1px solid #d8e9eb;border-radius:9px;margin:5px 0;background:#fff;cursor:pointer}.choice-row:hover{background:#f5fcfd}.choice-row input{margin-top:3px;transform:scale(1.15)}.check-row{display:flex;gap:8px;align-items:flex-start;margin:5px 0}.check-row input{margin-top:3px;transform:scale(1.15)}
      .record-box{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px}.record-status{font-size:9.5pt;color:#667987}.record-audio{width:min(420px,100%);margin-top:7px}.direct-progress{position:fixed;right:14px;bottom:14px;z-index:9999;background:rgba(23,59,87,.94);color:white;border-radius:14px;padding:8px 11px;font:700 9.5pt Tahoma,Arial,sans-serif;box-shadow:0 8px 25px rgba(0,0,0,.2)}
      @media(max-width:650px){.direct-progress{display:none}.direct-input{min-width:78px}.interactive-card{padding:10px}.slot-grid{grid-template-columns:1fr}}
    `;doc.head.appendChild(style);
  }

  function regionNodes(h,next){const out=[];let n=h.nextElementSibling;while(n && n!==next){out.push(n);n=n.nextElementSibling}return out;}

  function replaceBlanks(root,doc,lessonId,taskId,counter){
    const walker=doc.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){const p=node.parentElement;if(!p||/^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION)$/.test(p.tagName))return NodeFilter.FILTER_REJECT;return /_{3,}|\.{6,}|…{3,}/.test(node.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;}});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{const text=node.nodeValue,re=/(_{3,}|\.{6,}|…{3,})/g;let m,last=0;const frag=doc.createDocumentFragment();while((m=re.exec(text))){frag.appendChild(doc.createTextNode(text.slice(last,m.index)));const input=doc.createElement('input');input.type='text';input.className='direct-input';input.setAttribute('aria-label','Answer');const idx=counter.value++;input.dataset.field=String(idx);bindSave(input,storeKey(lessonId,taskId,idx));frag.appendChild(input);last=m.index+m[0].length;}frag.appendChild(doc.createTextNode(text.slice(last)));node.parentNode.replaceChild(frag,node);});
  }

  function upgradeCheckboxes(root,doc,lessonId,taskId,counter){
    const walker=doc.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){return /[☐□]/.test(node.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}});const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{const chunks=node.nodeValue.split(/([☐□])/),frag=doc.createDocumentFragment();chunks.forEach(ch=>{if(/[☐□]/.test(ch)){const c=doc.createElement('input');c.type='checkbox';c.className='direct-check';const idx=counter.value++;bindSave(c,storeKey(lessonId,taskId,idx));frag.appendChild(c)}else frag.appendChild(doc.createTextNode(ch))});node.parentNode.replaceChild(frag,node);});
  }

  function upgradeChoiceParagraphs(nodes,doc,lessonId,taskId,counter,task){
    if(!CHOICE_WORDS.test(((task?.title||'')+' '+(task?.body||'')).replace(/<[^>]*>/g,' ')))return 0;let made=0,group=0,lastPrefix='';
    nodes.forEach(root=>{[...(root.querySelectorAll?.('p,li,td')||[])].forEach(el=>{if(el.querySelector('input,textarea,select'))return;const txt=el.textContent.replace(/\s+/g,' ').trim(),mm=txt.match(/^([A-D])\s*[.)\-:]\s+(.+)/i);if(!mm)return;const prefix=mm[1].toUpperCase();if(prefix==='A'||prefix<=lastPrefix)group++;lastPrefix=prefix;const radio=doc.createElement('input');radio.type='radio';radio.name=`${taskId}-choice-${group}`;radio.value=txt;radio.dataset.field=String(counter.value++);bindSave(radio,storeKey(lessonId,taskId,`choice-${group}`));const lab=doc.createElement('label');lab.className='choice-row';el.parentNode.insertBefore(lab,el);lab.appendChild(radio);const span=doc.createElement('span');span.innerHTML=el.innerHTML;lab.appendChild(span);el.remove();made++;});});return made;
  }

  function createSlots(doc,lessonId,taskId,count,counter,labels){const grid=doc.createElement('div');grid.className='slot-grid';for(let i=0;i<count;i++){const slot=doc.createElement('div');slot.className='slot',b=doc.createElement('b');b.textContent=(labels&&labels[i])||String(i+1)+'.';const input=doc.createElement('input');input.type='text';input.className='direct-input';input.placeholder='Type your answer';const idx=counter.value++;input.dataset.field=String(idx);bindSave(input,storeKey(lessonId,taskId,idx));slot.append(b,input);grid.appendChild(slot);}return grid;}

  function addRecorder(doc,container){const box=doc.createElement('div');box.className='record-box';const start=doc.createElement('button');start.className='direct-btn primary';start.type='button';start.textContent='🎙 Start recording';const stop=doc.createElement('button');stop.className='direct-btn';stop.type='button';stop.textContent='■ Stop';stop.disabled=true;const status=doc.createElement('span');status.className='record-status';status.textContent='Record your response directly in the lesson.';const audio=doc.createElement('audio');audio.className='record-audio';audio.controls=true;audio.style.display='none';box.append(start,stop,status);container.append(box,audio);let rec,chunks=[],stream;start.onclick=async()=>{if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){status.textContent='Recording is not supported in this browser. Use the text box above.';return}try{stream=await navigator.mediaDevices.getUserMedia({audio:true});chunks=[];rec=new MediaRecorder(stream);rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};rec.onstop=()=>{const blob=new Blob(chunks,{type:rec.mimeType||'audio/webm'});audio.src=URL.createObjectURL(blob);audio.style.display='block';status.textContent='Recording ready. Play it back and self-check.';stream?.getTracks().forEach(t=>t.stop())};rec.start();start.disabled=true;stop.disabled=false;status.textContent='Recording…'}catch(e){status.textContent='Microphone permission was not granted.'}};stop.onclick=()=>{if(rec&&rec.state!=='inactive')rec.stop();start.disabled=false;stop.disabled=true};}

  function makeWorkspace(doc,lessonId,taskId,task,counter,directCount){
    const type=taskType(task),expected=expectedTokens(task,doc),fixed=expected.length>0,card=doc.createElement('div');card.className='interactive-card'+(directCount?' compact':'');card.dataset.task=taskId;
    const title=doc.createElement('div');title.className='interactive-title';title.textContent=directCount?'✍️ Complete the fields above':'✍️ Your answer';card.appendChild(title);const hint=doc.createElement('div');hint.className='interactive-hint';hint.textContent=fixed?'Your work is saved automatically. Press Check when you finish.':'Your work is saved automatically. Use the worksheet instructions above.';card.appendChild(hint);
    if(!directCount){if(type==='speaking'||type==='writing'){const ta=doc.createElement('textarea');ta.className='direct-textarea';ta.placeholder=type==='speaking'?'Plan keywords or write a short speaking outline here…':'Type your answer here…';const idx=counter.value++;ta.dataset.field=String(idx);bindSave(ta,storeKey(lessonId,taskId,idx));card.appendChild(ta);if(type==='speaking')addRecorder(doc,card);}else{let n=fixed?Math.min(Math.max(expected.length,1),20):1;if(type==='matching'&&n===1)n=6;card.appendChild(createSlots(doc,lessonId,taskId,n,counter));}}else if(type==='speaking')addRecorder(doc,card);
    const actions=doc.createElement('div');actions.className='interactive-actions';const check=doc.createElement('button');check.type='button';check.className='direct-btn primary';check.textContent='✓ Check';const show=doc.createElement('button');show.type='button';show.className='direct-btn answer';show.textContent='💡 Answer & explanation';const reset=doc.createElement('button');reset.type='button';reset.className='direct-btn danger';reset.textContent='↺ Reset';const feedback=doc.createElement('div');feedback.className='direct-feedback';const ans=doc.createElement('div');ans.className='direct-answer';ans.innerHTML=task?.answer||'<p>Check the task instructions and teacher feedback.</p>';actions.append(check,show,reset);card.append(actions,feedback,ans);
    check.onclick=()=>{const taskWrap=card.closest('[data-task-id]')||card,fields=[...taskWrap.querySelectorAll('.direct-input,.direct-textarea,input[type="radio"],input[type="checkbox"]')],textFields=fields.filter(x=>x.matches('.direct-input,.direct-textarea'));textFields.forEach(x=>x.classList.remove('correct','wrong'));if(fixed&&textFields.length&&expected.length>=textFields.length){let ok=0;textFields.forEach((f,i)=>{const yes=norm(f.value)===norm(expected[i]);f.classList.add(yes?'correct':'wrong');if(yes)ok++});feedback.textContent=`${ok}/${textFields.length} correct. Review the highlighted fields, then open the explanation if needed.`;feedback.className='direct-feedback open '+(ok===textFields.length?'good':'warn');}else{const attempted=fields.some(f=>f.type==='radio'||f.type==='checkbox'?f.checked:String(f.value||'').trim());feedback.textContent=attempted?'Response saved. This task needs teacher/self-check against the task criteria.':'Complete your response first.';feedback.className='direct-feedback open warn';}updateProgress(doc);};
    show.onclick=()=>{ans.classList.toggle('open');show.textContent=ans.classList.contains('open')?'🙈 Hide answer':'💡 Answer & explanation'};reset.onclick=()=>{clearTask(lessonId,taskId);const taskWrap=card.closest('[data-task-id]')||card;taskWrap.querySelectorAll('input,textarea,select').forEach(el=>{if(el.type==='radio'||el.type==='checkbox')el.checked=false;else el.value='';el.classList.remove('correct','wrong')});feedback.className='direct-feedback';feedback.textContent='';ans.classList.remove('open');show.textContent='💡 Answer & explanation';updateProgress(doc)};return card;
  }

  function updateProgress(doc){let badge=doc.getElementById('direct-progress');if(!badge){badge=doc.createElement('div');badge.id='direct-progress';badge.className='direct-progress';doc.body.appendChild(badge)}const tasks=[...doc.querySelectorAll('[data-task-id]')];let done=0;tasks.forEach(t=>{const fields=[...t.querySelectorAll('input,textarea,select')];if(fields.some(f=>f.type==='radio'||f.type==='checkbox'?f.checked:String(f.value||'').trim()))done++});badge.textContent=`Progress: ${done}/${tasks.length} tasks attempted`;}

  function addInteractionV2(doc,lessonId){
    styleDocument(doc);doc.querySelectorAll('a').forEach(a=>{a.target='_blank';a.rel='noopener'});
    const heads=typeof taskHeadings==='function'?taskHeadings(doc):[...doc.querySelectorAll('p')].filter(p=>/^Task\s+/i.test(p.textContent.trim())),order=(window.ORDER&&window.ORDER[lessonId])||[],map=typeof taskMap==='function'?taskMap(lessonId):{};
    heads.forEach((h,i)=>{const taskId=order[i];if(!taskId)return;const task=map[taskId]||window.CUSTOM?.[taskId];if(!task)return;const next=heads[i+1],nodes=regionNodes(h,next),counter={value:0},wrap=doc.createElement('div');wrap.dataset.taskId=taskId;wrap.style.display='contents';h.parentNode.insertBefore(wrap,h);wrap.appendChild(h);nodes.forEach(n=>wrap.appendChild(n));[...wrap.children].forEach(root=>{replaceBlanks(root,doc,lessonId,taskId,counter);upgradeCheckboxes(root,doc,lessonId,taskId,counter)});upgradeChoiceParagraphs([...wrap.children],doc,lessonId,taskId,counter,task);const directCount=wrap.querySelectorAll('.direct-input,input[type="radio"],input[type="checkbox"]').length,card=makeWorkspace(doc,lessonId,taskId,task,counter,directCount);wrap.appendChild(card);});
    updateProgress(doc);
  }

  window.addInteraction=addInteractionV2;
})();