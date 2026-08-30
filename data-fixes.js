(function(){
  const all=window.IELTS_LESSONS||[];
  const l1=all.find(x=>x.id===1);
  if(!l1)return;
  const fix={
    'l1-t1':'<p><b>1 doesn’t drink · 2 do the banks close · 3 don’t use · 4 does Maria come · 5 do you do · 6 does this word mean · 7 doesn’t do · 8 takes / does it take.</b></p><p><b>Why:</b> after <i>does / doesn’t</i>, use the base form of the verb.</p>',
    'l1-t4':'<p><b>1 04.50 · 2 Beijing / China · 3 UAE1880 · 4 Lisbon / Portugal · 5 16.</b></p><p><b>Why:</b> listen for the exact time, place, flight number and terminal.</p>',
    'l1-t5':'<p><b>1 partying · 2 sharing · 3 having fun · 4 chatting.</b></p>',
    'l1-t6':'<p><b>PLAY:</b> chess, basketball, board games, tennis, cards, poker.<br><b>GO:</b> swimming, dancing, skiing, shopping, hiking.<br><b>DO:</b> sports, weightlifting, yoga, exercise, karate, puzzles, kick boxing.</p>',
    'l1-t7':'<p><b>1 d · 2 b · 3 d · 4 c.</b></p><p><b>Evidence for Q4:</b> Rory says there is a lake nearby and they often go sailing, water-skiing or windsurfing.</p>'
  };
  l1.tasks.forEach(t=>{if(fix[t.id])t.answer=fix[t.id]});
})();