import {categories,cats,value,compare,matchup,fmt,aggregate,rank} from './logic.js';
const $=s=>document.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={chart:'M4 19V12h3v7m4 0V8h3v11m4 0V4h3v15',table:'M4 4h16v16H4zM4 9h16M9 9v11',history:'M3 11a9 9 0 1 1 2 7M3 4v7h7m2-4v6l4 2',settings:'M4 7h16M4 17h16M8 4v6m8 4v6',plus:'M12 5v14M5 12h14',db:'M4 6c0-4 16-4 16 0s-16 4-16 0m0 0v12c0 4 16 4 16 0V6M4 12c0 4 16 4 16 0'};
const icon=n=>`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[n]||icons.chart}"/></svg>`;
const logo='<svg viewBox="0 0 50 50" fill="none" stroke="currentColor" stroke-width="2"><circle cx="25" cy="25" r="22"/><path d="M3 25h44M25 3v44M10 9c19 9 19 23 0 32M40 9C21 18 21 32 40 41"/></svg>';
let state,token,leagueId='a',page='analysis',weekNo=1,viewTeam='',opponent='',draft=null,dirty=false,saving=false,rangeFrom=1,rangeTo=30,includeOpen=false,showAttempts=false,isStatic=false;
const league=()=>state.leagues.find(l=>l.id===leagueId);
const week=()=>league().weeks.find(w=>w.number===weekNo);
const cs=()=>categories(league());
const teamName=id=>league().teams.find(t=>t.id===id)?.name||'未知球隊';
const options=(items,selected)=>items.map(([v,t])=>`<option value="${esc(v)}" ${String(v)===String(selected)?'selected':''}>${esc(t)}</option>`).join('');
const teamOptions=selected=>options(league().teams.map(t=>[t.id,t.name+(t.id===league().myTeam?' (我的球隊)':'')]),selected);
function toast(msg,error=false){const el=$('#toast');el.textContent=msg;el.style.background=error?'#982944':'#153f2d';el.style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.style.display='none',4500);}
function canLeave(){if(!dirty)return true;if(!confirm('目前有尚未儲存的修改。確定捨棄修改？'))return false;dirty=false;draft=null;return true;}
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
async function persist(next){
 if(saving)return false;saving=true;document.body.classList.add('saving');
 try{
  if(!isStatic){
   const r=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json','X-Local-Token':token},body:JSON.stringify(next)});
   const j=await r.json();if(!r.ok)throw Error(j.error);
   state=next;dirty=false;draft=null;toast('已儲存至本機資料庫，並保留備份');return true;
  }else{
   localStorage.setItem('fantasy_state',JSON.stringify(next));
   state=next;dirty=false;draft=null;toast('已儲存至瀏覽器快取（靜態模式）');return true;
  }
 }catch(e){toast('儲存失敗：'+e.message,true);return false;}finally{saving=false;document.body.classList.remove('saving');}
}
function setWeekDefault(){
 const l=league();
 weekNo=l.weeks.length?Math.max(...l.weeks.map(w=>w.number)):1;
 rangeFrom=l.weeks.length?Math.min(...l.weeks.map(w=>w.number)):1;
 rangeTo=weekNo;
 viewTeam=l.myTeam;
 opponent=l.teams.find(t=>t.id!==viewTeam)?.id||'';
}
function shell(content){
 const l=league();
 const storageNotice=isStatic?`<strong>靜態／分享模式</strong>瀏覽器本機儲存<br>可離線使用 · 支援匯出入<br><br>v1.1 · ${l.teams.length} 隊 / ${cs().length} 項`:`<strong>資料儲存在你的電腦</strong>SQLite 本機資料庫<br>不會上傳 · 可離線使用<br><br>v1.1 · ${l.teams.length} 隊 / ${cs().length} 項`;
 $('#app').innerHTML=`<div class="shell"><aside class="sidebar"><div class="brand">${logo}<div><b>MATCHUP</b><span>對戰研究室</span></div></div><label class="small" for="leagueSelect">目前聯盟</label><select id="leagueSelect" class="league-switch">${options(state.leagues.map(x=>[x.id,x.name]),leagueId)}</select><nav class="nav" aria-label="主要功能">${[['analysis','chart','對戰分析'],['entry','table','每週數據'],['history','history','長期強弱'],['settings','settings','聯盟設定']].map(([id,i,t])=>`<button data-page="${id}" class="${page===id?'active':''}">${icon(i)}${t}</button>`).join('')}</nav><div class="storage">${icon('db')}${storageNotice}</div></aside><main class="main">${content}</main></div>`;
 $('#leagueSelect').onchange=e=>{const v=e.target.value;if(canLeave()){leagueId=v;setWeekDefault();render();}else e.target.value=leagueId;};
 document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>navigate(b.dataset.page));
}
function navigate(p){if(!canLeave())return;page=p;render();}
function header(title,subtitle,actions=''){return `<header class="top"><div><h1>${title}</h1><p class="muted small">${esc(subtitle)}</p></div><div class="actions">${actions}</div></header>`;}
function weekSelect(){const ws=league().weeks.slice().sort((a,b)=>b.number-a.number);return `<label class="field">比較週次<select id="weekSelect" class="week-control">${options(ws.map(w=>[w.number,`第 ${w.number} 週${w.final?' · 已結算':' · 進行中'}`]),weekNo)}</select></label>`;}
function empty(title,text,button='輸入第一週數據'){return `<section class="panel empty">${icon('table')}<h2>${title}</h2><p>${text}</p><button class="primary" data-page="entry">${icon('plus')} ${button}</button></section>`;}
function analysis(){
 const l=league(),w=week();
 if(!w){shell(header('對戰分析',`${l.name} · ${l.season}`)+empty('從第一週開始，認識球隊優勢','每週填入所有球隊的成績，就能模擬任兩隊的對決結果，找出各項數據差距。'));return;}
 if(!viewTeam||!l.teams.some(t=>t.id===viewTeam))viewTeam=l.myTeam;
 if(opponent===viewTeam||!l.teams.some(t=>t.id===opponent))opponent=l.teams.find(t=>t.id!==viewTeam)?.id||'';
 const m=matchup(w.stats[viewTeam],w.stats[opponent],cs());
 const wins=m.results.filter(x=>x.result===1),losses=m.results.filter(x=>x.result===-1);
 const insight=arr=>arr.length?arr.map(x=>`${x.c.label} ${x.c.low?'較少':'領先'} ${x.c.pct?(Math.abs(x.a-x.b)*100).toFixed(2)+' 個百分點':Math.abs(x.a-x.b)}`).map(s=>`<p>• ${esc(s)}</p>`).join(''):'<p class="muted">目前沒有可判定的項目。</p>';
 const partial=m.missing>0;
 const rows=m.results.map(x=>{
  const r=rank(w,viewTeam,x.c,l.teams);
  const denom=Math.max(Math.abs(x.a||0),Math.abs(x.b||0),.001);
  const bar=Math.min(48,Math.abs((x.a||0)-(x.b||0))/denom*90);
  return `<tr><td class="stat">${x.c.label}<span class="sub">${x.c.name}${x.c.low?' ↓':''}</span></td><td class="num">${fmt(x.a,x.c)}</td><td class="bar-cell"><div class="bar">${x.result!==null&&x.result!==0?`<span class="${x.result===-1?'loss':''}" style="width:${bar}%;${x.result===1?'right':'left'}:50%"></span>`:''}</div></td><td class="num">${fmt(x.b,x.c)}</td><td class="center ${x.result===1?'win':x.result===-1?'loss':''}">${x.result===null?'待補':x.result===1?'勝':x.result===-1?'敗':'平'}</td><td class="num">${r?`${r.rank} / ${r.n}`:'—'}</td></tr>`;
 }).join('');
 const opponents=l.teams.filter(t=>t.id!==viewTeam).map(t=>({t,m:matchup(w.stats[viewTeam],w.stats[t.id],cs())})).sort((a,b)=>(b.m.w-b.m.l)-(a.m.w-a.m.l));
 shell(header('對戰分析',`${l.name} · ${l.season}${w.start?' · '+w.start+' — '+w.end:''}`,weekSelect()+`<button class="primary" data-page="entry">${icon('plus')} 輸入數據</button>`)+`<div class="analysis-grid"><div><div class="selectors"><label class="field">主隊視角<select id="myView">${teamOptions(viewTeam)}</select></label><div class="vs">VS</div><label class="field">客隊／對手<select id="opponent">${options(l.teams.filter(t=>t.id!==viewTeam).map(t=>[t.id,t.name+(t.id===l.myTeam?' (我的球隊)':'')]),opponent)}</select></label></div>${!w.final?'<div class="notice">本週尚未結算，結果會隨數據更新。</div>':''}<section class="panel score-panel"><div class="score-side"><h2>${partial?'已填項目比較':'本週模擬對戰結果'}</h2><div class="score"><span class="win">${m.w}</span><span class="dash">–</span><span class="loss">${m.l}</span></div><div class="chips">${m.results.map(x=>`<span class="chip ${x.result===1?'win':x.result===-1?'loss':''}">${x.c.label} ${x.result===null?'—':x.result===1?'✓':x.result===-1?'×':'＝'}</span>`).join('')}</div><p class="score-note">${m.t} 項平手${partial?` · ${m.missing} 項資料不足，尚非完整比分`:''} · 以 ${esc(teamName(viewTeam))} 為視角</p></div><div class="insights"><div><h3 class="win">${esc(teamName(viewTeam))} 優勢</h3>${insight(wins)}</div><div><h3 class="loss">${esc(teamName(viewTeam))} 劣勢</h3>${insight(losses)}</div></div></section><section class="panel"><div class="panel-heading"><h2>${cs().length===9?'九':'十一'}項數據對比</h2><span class="muted small">TO${l.extended?'、PF':''} 越少越好</span></div><div class="scroll"><table class="table compare-table"><thead><tr><th>項目</th><th class="num">${esc(teamName(viewTeam))}</th><th class="bar-cell"></th><th class="num">${esc(teamName(opponent))}</th><th class="center">結果</th><th class="num">${esc(teamName(viewTeam))} 排名</th></tr></thead><tbody>${rows}</tbody></table></div><p class="muted small" style="margin:15px 0 0">排名採並列名次；分母為該項已有數據的球隊數。</p></section></div><aside class="panel opponents"><h2>對上全聯盟</h2><p class="muted small">${esc(teamName(viewTeam))} 的模擬勝–敗–平</p>${opponents.map(({t,m})=>`<button data-opponent="${esc(t.id)}" class="${t.id===opponent?'selected':''}"><span class="teamname">${esc(t.name)}</span><span class="record">${m.w}–${m.l}–${m.t}${m.missing?' *':''}</span></button>`).join('')}<p class="small muted" style="margin:16px 0 0">* 尚有未填項目<br>此列表為模擬結果，並非實際戰績。</p></aside></div>`);
 $('#weekSelect').onchange=e=>{weekNo=Number(e.target.value);render();};
 $('#myView').onchange=e=>{viewTeam=e.target.value;if(opponent===viewTeam)opponent=l.teams.find(t=>t.id!==viewTeam)?.id;render();};
 $('#opponent').onchange=e=>{opponent=e.target.value;render();};
 document.querySelectorAll('[data-opponent]').forEach(b=>b.onclick=()=>{opponent=b.dataset.opponent;render();});
}
function blankWeek(number){return {number,final:false,start:'',end:'',stats:{}};}
function draftValue(s,c){const v=c.pct?value(s,c):s?.[c.key];return v===null||v===undefined?'':c.pct?+(v*100).toFixed(5):v;}
function entry(){
 const l=league();if(!draft)draft=structuredClone(week()||blankWeek(weekNo));const d=draft;
 const optional=showAttempts?cs().filter(c=>c.pair).flatMap(c=>c.pair.map((key,i)=>({key,label:{fgm:'FGM',fga:'FGA',ftm:'FTM',fta:'FTA',tpm:'3PTM*',tpa:'3PTA'}[key],name:i?'出手數':'命中數'}))):[];
 const fields=[...cs(),...optional];
 shell(header('每週數據',`${l.name} · ${l.teams.length} 支球隊 · ${cs().length} 個計分項目`,`<button id="newWeek">${icon('plus')} 新增週次</button>`)+`<section class="panel"><div class="form-row"><label class="field">週次<select id="entryWeek">${options([...new Set([...l.weeks.map(w=>w.number),d.number])].sort((a,b)=>a-b).map(n=>[n,`第 ${n} 週`]),d.number)}</select></label><label class="field">開始日期<input type="date" id="startDate" value="${esc(d.start)}"></label><label class="field">結束日期<input type="date" id="endDate" value="${esc(d.end)}"></label><label class="toggle"><input type="checkbox" id="finalWeek" ${d.final?'checked':''}>本週已結算</label><label class="toggle"><input type="checkbox" id="attempts" ${showAttempts?'checked':''}>命中／出手數</label></div><div class="notice">百分比以 0–100 輸入，例如 48.2 代表 48.2%。空白表示未填，0 表示實際為零。可用 Tab 逐格輸入。${showAttempts?' 同時填命中與出手數時，命中率以兩者計算；3PTM* 應與三分球命中數相同。':''}</div><div class="table-wrap"><table class="table entry-table"><thead><tr><th>球隊</th>${fields.map(c=>`<th title="${c.name}">${c.label}${c.low?' ↓':''}${c.pct?' (%)':''}</th>`).join('')}</tr></thead><tbody>${l.teams.map(t=>`<tr><td class="stat" title="${esc(t.name)}">${esc(t.name)}${t.id===l.myTeam?' <span class="rank-pill">我</span>':''}</td>${fields.map(c=>`<td class="${c.pct?'pct':''}"><input type="number" inputmode="decimal" min="0" ${c.pct?'max="100" step="any"':'step="1" max="1000000"'} aria-label="${esc(t.name)} ${c.label}" data-team="${esc(t.id)}" data-stat="${c.key}" value="${draftValue(d.stats[t.id],c)}" placeholder="—"></td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="entry-footer"><span id="saveStatus" class="muted small">${dirty?'有尚未儲存的修改':(isStatic?'修改儲存於瀏覽器':'資料僅儲存在本機')} · 留白不會計入比較</span><div class="actions"><button id="deleteWeek" class="danger" ${week()?'':'disabled'}>刪除此週</button><button id="saveWeek" class="primary">儲存本週數據</button></div></div><details><summary>如何輸入命中率與出手數？</summary><p>只填百分比也能進行單週比較。跨週分析若所有有效週次都有命中及出手數，使用加權命中率；否則顯示「週命中率平均」，不冒充加權結果。填 0 次出手時，該週命中率不計入比較。</p></details></section>`);
 const mark=()=>{dirty=true;$('#saveStatus').textContent='有尚未儲存的修改';};
 document.querySelectorAll('[data-stat]').forEach(el=>el.oninput=()=>{const s=d.stats[el.dataset.team]??={};const c=fields.find(c=>c.key===el.dataset.stat);if(el.value==='')delete s[c.key];else s[c.key]=Number(el.value)/(c.pct?100:1);mark();});
 $('#startDate').onchange=e=>{d.start=e.target.value;mark();};$('#endDate').onchange=e=>{d.end=e.target.value;mark();};$('#finalWeek').onchange=e=>{d.final=e.target.checked;mark();};
 $('#attempts').onchange=e=>{showAttempts=e.target.checked;render();};
 $('#entryWeek').onchange=e=>{const n=Number(e.target.value);if(canLeave()){weekNo=n;render();}else e.target.value=d.number;};
 $('#newWeek').onclick=()=>{const answer=prompt('新增第幾週？',String(Math.max(0,...l.weeks.map(w=>w.number))+1));if(answer===null)return;const n=Number(answer);if(!Number.isInteger(n)||n<1||n>1000){toast('週次須為 1–1000 的整數',true);return;}if(l.weeks.some(w=>w.number===n)){toast('此週次已存在，請從下拉選單切換',true);return;}if(canLeave()){weekNo=n;draft=blankWeek(n);dirty=true;render();}};
 $('#saveWeek').onclick=async()=>{const invalid=[...document.querySelectorAll('[data-stat]')].find(x=>!x.checkValidity());if(invalid){invalid.reportValidity();return;}for(const s of Object.values(d.stats)){if(s.tpm!==undefined&&s.threes!==undefined&&s.tpm!==s.threes){toast('3PTM* 與三分球命中數必須一致',true);return;}}
  const next=structuredClone(state),nl=next.leagues.find(x=>x.id===leagueId);nl.weeks=nl.weeks.filter(w=>w.number!==d.number);nl.weeks.push(structuredClone(d));if(await persist(next))render();};
 $('#deleteWeek').onclick=async()=>{if(!confirm(`確定刪除第 ${weekNo} 週的所有球隊數據？儲存前備份會保留。`))return;const next=structuredClone(state),nl=next.leagues.find(x=>x.id===leagueId);nl.weeks=nl.weeks.filter(w=>w.number!==weekNo);if(await persist(next)){setWeekDefault();render();}};
}
function history(){
 const l=league();if(!l.weeks.length){shell(header('長期強弱',`${l.name} · ${l.season}`)+empty('累積每週數據，看見穩定的強項','保存多週成績後，可比較各項平均表現、每週波動，以及對同一對手的歷史勝出頻率。'));return;}
 if(!viewTeam||!l.teams.some(t=>t.id===viewTeam))viewTeam=l.myTeam;
 if(opponent===viewTeam||!l.teams.some(t=>t.id===opponent))opponent=l.teams.find(t=>t.id!==viewTeam)?.id||'';
 const weeks=l.weeks.filter(w=>w.number>=rangeFrom&&w.number<=rangeTo&&(includeOpen||w.final)).sort((a,b)=>a.number-b.number);
 const filters=`<section class="panel"><div class="filters"><label class="field">快速選擇<select id="preset">${options([['custom','自訂範圍'],['3','最近 3 個已結算週次'],['5','最近 5 個已結算週次'],['all','所有週次']],'custom')}</select></label><label class="field">起始週<input type="number" min="1" max="1000" id="rangeFrom" value="${rangeFrom}"></label><label class="field">結束週<input type="number" min="1" max="1000" id="rangeTo" value="${rangeTo}"></label><label class="field">主隊視角<select id="historyView">${teamOptions(viewTeam)}</select></label><label class="field">對手球隊<select id="historyOpponent">${options(l.teams.filter(t=>t.id!==viewTeam).map(t=>[t.id,t.name+(t.id===l.myTeam?' (我的球隊)':'')]),opponent)}</select></label><label class="toggle"><input type="checkbox" id="includeOpen" ${includeOpen?'checked':''}>包含未結算週次</label></div></section>`;
 let body='';
 if(!weeks.length)body=empty('此範圍沒有可分析的週次','請調整週次範圍，或到每週數據勾選「本週已結算」。','編輯每週數據');
 else {
  const records=cs().map(c=>{
   const a=aggregate(weeks,viewTeam,c),b=aggregate(weeks,opponent,c);
   const pairs=weeks.map(w=>compare(value(w.stats[viewTeam],c),value(w.stats[opponent],c),c)).filter(x=>x!==null);
   const win=pairs.filter(x=>x===1).length,loss=pairs.filter(x=>x===-1).length,tie=pairs.filter(x=>x===0).length;
   const all=l.teams.map(t=>aggregate(weeks,t.id,c).value).filter(v=>v!==null);
   return {c,a,b,win,loss,tie,n:pairs.length,rank:a.value===null?null:1+all.filter(v=>compare(v,a.value,c)===1).length,total:all.length};
  });
  const strengths=records.filter(r=>r.n>=2&&r.win/r.n>=.6).map(r=>r.c.label),weaknesses=records.filter(r=>r.n>=2&&r.loss/r.n>=.6).map(r=>r.c.label);
  body=`<div class="notice">採用 ${weeks.length} 個週次：${weeks.map(w=>'W'+w.number+(w.final?'':'（未結算）')).join('、')}。各項僅比較雙方同週都有數據的紀錄；歷史頻率不代表未來勝率。</div><section class="panel"><div class="panel-heading"><h2>對 ${esc(teamName(opponent))} 的歷史表現</h2><span class="muted small">主隊：${esc(teamName(viewTeam))}</span></div><div class="insights" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:22px 0"><div><h3 class="win">較常勝出的項目</h3><p>${strengths.length?strengths.join('、'):'尚無足夠紀錄符合條件'}</p></div><div><h3 class="loss" style="margin-top:4px">較常落後的項目</h3><p>${weaknesses.length?weaknesses.join('、'):'尚無足夠紀錄符合條件'}</p></div></div><p class="muted small">至少 2 次有效比較，且勝出或落後達 60% 才列入上方摘要。</p><div class="scroll"><table class="table long-table"><thead><tr><th>項目</th><th class="num">${esc(teamName(viewTeam))} 表現</th><th class="num">${esc(teamName(opponent))} 表現</th><th class="num">${esc(teamName(viewTeam))} 排名</th><th class="num">歷史勝–敗–平</th><th class="num">勝出頻率</th><th class="num">${esc(teamName(viewTeam))} 波動 σ</th></tr></thead><tbody>${records.map(r=>`<tr><td class="stat">${r.c.label}<span class="sub">${r.c.low?'越少越好':''}</span></td><td class="num">${fmt(r.a.value,r.c)}<span class="sub">${r.a.method} · ${r.a.n} 週</span></td><td class="num">${fmt(r.b.value,r.c)}<span class="sub">${r.b.method} · ${r.b.n} 週</span></td><td class="num">${r.rank===null?'—':`${r.rank} / ${r.total}`}</td><td class="num">${r.win}–${r.loss}–${r.tie}<span class="sub">有效 ${r.n} 週</span></td><td class="num ${r.n&&r.win/r.n>=.6?'win':r.n&&r.loss/r.n>=.6?'loss':''}">${r.n?(r.win/r.n*100).toFixed(0)+'%':'—'}</td><td class="num">${r.a.n>=2?fmt(r.a.sd,r.c):'—'}</td></tr>`).join('')}</tbody></table></div><p class="muted small" style="margin-top:16px">波動 σ 為有效週數據的母體標準差，越大表示週與週間差異越大；百分比波動單位為百分點。排名依各隊可用週次的彙總數值計算，週數不同時需留意。</p></section><section class="panel"><h2>${esc(teamName(viewTeam))} 對全聯盟的逐週模擬結果</h2><div class="scroll"><table class="table"><thead><tr><th>對手</th><th class="num">整場勝–敗–平</th><th class="num">有效週數</th><th class="num">整場勝出頻率</th><th>各項勝出次數 / 有效週數</th></tr></thead><tbody>${l.teams.filter(t=>t.id!==viewTeam).map(t=>{const ms=weeks.map(w=>matchup(w.stats[viewTeam],w.stats[t.id],cs()));const full=ms.filter(m=>!m.missing);const wins=full.filter(m=>m.w>m.l).length,loss=full.filter(m=>m.w<m.l).length,tie=full.filter(m=>m.w===m.l).length;return `<tr><td class="stat">${esc(t.name)}</td><td class="num">${wins}–${loss}–${tie}</td><td class="num">${full.length}</td><td class="num">${full.length?(wins/full.length*100).toFixed(0)+'%':'—'}</td><td><div class="chips">${cs().map((c,i)=>{const valid=ms.map(m=>m.results[i].result).filter(v=>v!==null);return `<span class="chip">${c.label} ${valid.filter(x=>x===1).length}/${valid.length}</span>`;}).join('')}</div></td></tr>`;}).join('')}</tbody></table></div><p class="muted small" style="margin-top:15px">整場結果只採雙方所有計分項目齊全的週次；各項頻率可採部分完整的週次。</p></section>`;
 }
 shell(header('長期強弱',`${l.name} · ${l.season}`)+filters+body);
 $('#rangeFrom').onchange=e=>{rangeFrom=Math.max(1,Math.min(1000,Number(e.target.value)||1));if(rangeFrom>rangeTo)rangeTo=rangeFrom;render();};
 $('#rangeTo').onchange=e=>{rangeTo=Math.max(rangeFrom,Math.min(1000,Number(e.target.value)||rangeFrom));render();};
 $('#includeOpen').onchange=e=>{includeOpen=e.target.checked;render();};
 $('#historyView').onchange=e=>{viewTeam=e.target.value;if(opponent===viewTeam)opponent=l.teams.find(t=>t.id!==viewTeam)?.id;render();};
 $('#historyOpponent').onchange=e=>{opponent=e.target.value;render();};
 $('#preset').onchange=e=>{if(e.target.value==='custom')return;const ws=l.weeks.filter(w=>w.final||e.target.value==='all').sort((a,b)=>a.number-b.number);if(!ws.length){toast('目前沒有已結算週次');return;}const selected=e.target.value==='all'?ws:ws.slice(-Number(e.target.value));rangeFrom=selected[0].number;rangeTo=selected.at(-1).number;if(e.target.value!=='all')includeOpen=false;render();};
}
async function downloadStandaloneHtml(){
 try{
  toast('正在打包單檔分享網頁…');
  let css='';
  const styleEl=document.querySelector('style#bundle-style')||document.querySelector('style');
  if(styleEl&&styleEl.textContent.trim().length>100){css=styleEl.textContent;}
  else{css=await fetch('./style.css').then(r=>r.text());}

  let bundleJs='';
  const scriptEl=document.querySelector('script#bundle-script');
  if(scriptEl&&scriptEl.textContent.trim().length>100){
   bundleJs=scriptEl.textContent;
  }else{
   const [l,a]=await Promise.all([fetch('./logic.js').then(r=>r.text()),fetch('./app.js').then(r=>r.text())]);
   const cleanLogic=l.replace(/export /g,'');
   const cleanApp=a.replace(/^import .*?;\r?\n/,'');
   bundleJs=cleanLogic+'\n'+cleanApp;
  }
  const sOpen='<'+'script>', sClose='<'+'/script>', sBundle='<'+'script id="bundle-script">';
  const payload=JSON.stringify(state);
  const html=`<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>對戰研究室 · NBA Fantasy</title>
  <style id="bundle-style">${css}</style>
</head>
<body>
  <div id="app"><p class="loading">正在開啟對戰研究室…</p></div>
  <div id="toast" role="status" aria-live="polite"></div>
  ${sOpen}
    window.__INITIAL_DATA__ = ${payload};
  ${sClose}
  ${sBundle}
    ${bundleJs}
  ${sClose}
</body>
</html>`;
  const blob=new Blob([html],{type:'text/html;charset=utf-8'});
  const a=document.createElement('a');
  const safeName=(league().name||'NBA-Fantasy').replace(/[\\/:*?"<>|]/g,'_');
  a.href=URL.createObjectURL(blob);
  a.download=`${safeName}-對戰研究室-分享版-${new Date().toLocaleDateString('sv-SE')}.html`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast('已匯出單檔分享網頁！直接傳此檔案給朋友即可操作。');
 }catch(e){toast('打包失敗：'+e.message,true);}
}
function settings(){
 const l=league();
 const hasLocalChanges=isStatic&&!!localStorage.getItem('fantasy_state');
 shell(header('聯盟設定',`${l.name} · ${l.teams.length} 隊 / ${cs().length} 項`)+`<div class="settings-grid"><section class="panel"><h2>基本設定</h2><form id="settingsForm"><label class="field">聯盟名稱<input id="leagueName" maxlength="80" value="${esc(l.name)}" required></label><label class="field" style="margin-top:15px">賽季標籤<input id="season" maxlength="40" value="${esc(l.season)}" required></label><label class="field" style="margin-top:15px">我的球隊<select id="myTeam">${teamOptions(l.myTeam)}</select></label><div class="notice">${cs().map(c=>c.label+(c.low?' ↓':'')).join(' · ')}<br>↓ 表示越少越好。賽季標籤僅供辨識；切換新賽季請先匯出備份，再使用新的程式資料夾。</div><h3>球隊名稱</h3><div class="team-list">${l.teams.map((t,i)=>`<label class="field">球隊 ${i+1}<input data-team-name="${esc(t.id)}" value="${esc(t.name)}" maxlength="80" required></label>`).join('')}</div><button type="submit" class="primary" style="margin-top:22px">儲存聯盟設定</button></form></section><div><section class="panel"><h2>分享與備份</h2><p class="muted">可一鍵匯出單檔獨立網頁傳給朋友直接打開操作，或匯出完整 JSON 備份。</p><div class="backup-actions"><button id="exportHtml" class="primary" type="button">匯出分享網頁 (.html)</button><button id="exportBackup" class="dark" type="button">匯出備份 (JSON)</button><button id="importBackup" type="button">匯入備份 (JSON)</button><input type="file" id="backupFile" accept=".json" hidden></div>${hasLocalChanges?'<div style="margin-top:12px"><button id="resetLocal" class="danger" type="button">重設回原始預設數據</button></div>':''}<p class="small muted" style="margin:16px 0 0">• <b>分享網頁 (.html)</b>：單一檔案，朋友用手機或電腦點開即可操作，無須安裝軟體。<br>• <b>備份檔案 (.json)</b>：包含三個聯盟的所有設定與數據，建議定期存至其他磁碟。<br>• 自動備份位於程式資料夾 data/backups，保留最近 100 份。</p></section><section class="panel"><h2>目前資料</h2><table class="table"><thead><tr><th>聯盟</th><th class="num">已儲存週數</th></tr></thead><tbody>${state.leagues.map(x=>`<tr><td>${esc(x.name)}</td><td class="num">${x.weeks.length}</td></tr>`).join('')}</tbody></table></section></div></div>`);
 $('#settingsForm').oninput=()=>dirty=true;
 $('#settingsForm').onsubmit=async e=>{e.preventDefault();const next=structuredClone(state),nl=next.leagues.find(x=>x.id===leagueId);nl.name=$('#leagueName').value.trim();nl.season=$('#season').value.trim();nl.myTeam=$('#myTeam').value;document.querySelectorAll('[data-team-name]').forEach(el=>{nl.teams.find(t=>t.id===el.dataset.teamName).name=el.value.trim();});if(new Set(nl.teams.map(t=>t.name)).size!==nl.teams.length){toast('同一聯盟請使用不同隊名，方便辨識',true);return;}if(await persist(next)){viewTeam=nl.myTeam;if(opponent===viewTeam)opponent=league().teams.find(t=>t.id!==viewTeam).id;render();}};
 $('#exportHtml').onclick=()=>downloadStandaloneHtml();
 $('#exportBackup').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.href=url;a.download='fantasy-backup-'+new Date().toLocaleDateString('sv-SE')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已匯出完整備份 (JSON)');};
 $('#importBackup').onclick=()=>{if(canLeave())$('#backupFile').click();};
 $('#backupFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>10_000_000)throw Error('備份檔過大');const data=JSON.parse(await f.text());if(!data.leagues||data.version!==1)throw Error('不是有效的備份檔');if(!confirm('匯入將取代三個聯盟目前的所有資料。匯入前會自動備份。確定繼續？'))return;if(await persist(data)){leagueId=state.leagues[0].id;setWeekDefault();render();}}catch(err){toast('匯入失敗：'+err.message,true);}finally{e.target.value='';}};
 if(hasLocalChanges){$('#resetLocal').onclick=()=>{if(confirm('確定清除瀏覽器快取中的修改，還原至預設數據？')){localStorage.removeItem('fantasy_state');location.reload();}};}
}
function render(){if(page==='entry')entry();else if(page==='history')history();else if(page==='settings')settings();else analysis();}
async function init(){
 if(window.__INITIAL_DATA__){
  isStatic=true;
  const local=localStorage.getItem('fantasy_state');
  if(local){try{state=JSON.parse(local);}catch(e){state=window.__INITIAL_DATA__;}}
  else{state=window.__INITIAL_DATA__;}
  leagueId=state.leagues[0].id;setWeekDefault();render();return;
 }
 try{
  const r=await fetch('/api/state');
  if(r.ok){
   const j=await r.json();state=j.data;token=j.token;isStatic=false;leagueId=state.leagues[0].id;setWeekDefault();render();return;
  }
 }catch(e){}
 try{
  isStatic=true;
  const local=localStorage.getItem('fantasy_state');
  if(local){try{state=JSON.parse(local);}catch(e){}}
  if(!state){
   const r=await fetch('./data.json');
   if(!r.ok)throw new Error('無法載入 data.json');
   state=await r.json();
  }
  leagueId=state.leagues[0].id;setWeekDefault();render();
 }catch(err){
  $('#app').innerHTML=`<section class="panel connection-error"><h1>無法載入對戰研究室資料</h1><p>若在本機使用，請確認「啟動對戰研究室.cmd」正在執行；若部署在 GitHub Pages，請確認包含 data.json 或已執行 build。</p><p class="error">${esc(err.message)}</p></section>`;
 }
}
init();
