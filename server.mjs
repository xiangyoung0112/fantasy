import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=dirname(fileURLToPath(import.meta.url));
const dataDir=process.env.FANTASY_DATA_DIR || join(root,'data');
mkdirSync(join(dataDir,'backups'),{recursive:true});
const db=new DatabaseSync(join(dataDir,'fantasy.sqlite'));
db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS documents(id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL);
`);
const initial={version:1,leagues:[['a','十一項聯盟',12,true],['b','九項聯盟 · 8 隊',8,false],['c','九項聯盟 · 10 隊',10,false]].map(([id,name,count,extended])=>({id,name,extended,season:'2026–27',myTeam:id+'-1',teams:Array.from({length:count},(_,i)=>({id:id+'-'+(i+1),name:i===0?'我的球隊':'球隊 '+(i+1)})),weeks:[]}))};
if(!db.prepare('SELECT id FROM documents WHERE id=1').get()) db.prepare('INSERT INTO documents VALUES(1,?)').run(JSON.stringify(initial));
const keys=['fg','ft','threes','pts','reb','ast','stl','blk','to','threePct','pf','fgm','fga','ftm','fta','tpm','tpa'];
export function validate(data){
 if(!data || data.version!==1 || !Array.isArray(data.leagues) || data.leagues.length!==3) throw Error('備份格式不正確：需要三個聯盟。');
 const ids=new Set();
 for(const l of data.leagues){
  if(typeof l.id!=='string'||ids.has(l.id)||typeof l.name!=='string'||!l.name.trim()||l.name.length>80||typeof l.extended!=='boolean'||typeof l.season!=='string'||l.season.length>40) throw Error('聯盟設定格式不正確。');ids.add(l.id);
  if(!Array.isArray(l.teams)||![8,10,12].includes(l.teams.length)||!Array.isArray(l.weeks)||l.weeks.length>1000) throw Error('球隊或週次格式不正確。');
  const tids=new Set();for(const t of l.teams){if(typeof t.id!=='string'||tids.has(t.id)||typeof t.name!=='string'||!t.name.trim()||t.name.length>80)throw Error('隊名不可空白，隊伍 ID 不可重複。');tids.add(t.id);}
  if(!tids.has(l.myTeam))throw Error('請選擇你的球隊。');
  const wids=new Set();for(const w of l.weeks){
   if(!Number.isInteger(w.number)||w.number<1||w.number>1000||wids.has(w.number)||typeof w.final!=='boolean'||!w.stats||typeof w.stats!=='object'||Array.isArray(w.stats))throw Error('週次格式不正確。');wids.add(w.number);
   if(typeof w.start!=='string'||typeof w.end!=='string'||(w.start&&!/^\d{4}-\d{2}-\d{2}$/.test(w.start))||(w.end&&!/^\d{4}-\d{2}-\d{2}$/.test(w.end))||(w.start&&w.end&&w.start>w.end))throw Error('週次日期不正確。');
   for(const [tid,s] of Object.entries(w.stats)){if(!tids.has(tid)||!s||typeof s!=='object'||Array.isArray(s))throw Error('球隊數據格式不正確。');for(const [k,v]of Object.entries(s)){if(!keys.includes(k)||v===null)throw Error('包含未知數據欄位。');if(typeof v!=='number'||!Number.isFinite(v)||v<0||(['fg','ft','threePct'].includes(k)?v>1:!Number.isInteger(v))||v>1000000)throw Error('數據必須為有效非負數；命中率須介於 0 與 1。');}
    for(const [m,a]of [['fgm','fga'],['ftm','fta'],['tpm','tpa']])if(s[m]!==undefined&&s[a]!==undefined&&s[m]>s[a])throw Error('命中數不可大於出手數。');
   }
  }
 }
 return data;
}
const token=randomBytes(24).toString('hex');
function backup(){const payload=db.prepare('SELECT payload FROM documents WHERE id=1').get().payload;const name=new Date().toISOString().replaceAll(':','-')+'-'+randomBytes(3).toString('hex')+'.json';writeFileSync(join(dataDir,'backups',name),payload);const list=readdirSync(join(dataDir,'backups')).filter(x=>x.endsWith('.json')).sort();for(const old of list.slice(0,-100))unlinkSync(join(dataDir,'backups',old));}
const port=Number(process.env.PORT||47831);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
function syncDataJson(data){try{writeFileSync(join(root,'public','data.json'),JSON.stringify(data,null,2));}catch(e){}}
try{const cur=JSON.parse(db.prepare('SELECT payload FROM documents WHERE id=1').get().payload);syncDataJson(cur);}catch(e){}
const server=http.createServer(async(req,res)=>{
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const expected='127.0.0.1:'+port;
 if(req.headers.host!==expected && req.headers.host!=='localhost:'+port)return send(403,{error:'只允許本機連線。'});
 try{
  if(req.url==='/api/state'&&req.method==='GET')return send(200,{data:JSON.parse(db.prepare('SELECT payload FROM documents WHERE id=1').get().payload),token});
  if(req.url==='/api/state'&&req.method==='PUT'){
   if(req.headers['x-local-token']!==token)return send(403,{error:'請重新整理頁面後再儲存。'});
   let body='';for await(const chunk of req){body+=chunk;if(body.length>10_000_000)return send(413,{error:'資料過大。'});}
   const data=validate(JSON.parse(body));backup();db.prepare('UPDATE documents SET payload=? WHERE id=1').run(JSON.stringify(data));syncDataJson(data);return send(200,{ok:true});
  }
  if(req.method!=='GET')return send(405,{error:'不支援此操作。'});
  const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/logic.js':'logic.js','/data.json':'data.json'};
  const file=files[req.url?.split('?')[0]];if(!file)return send(404,{error:'找不到頁面。'});
  const ext='.'+file.split('.').pop();res.writeHead(200,{'Content-Type':mime[ext],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self' 'unsafe-inline' data: blob:; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' data: blob:; img-src 'self' data: blob:; object-src 'none'; frame-ancestors 'none'"});res.end(readFileSync(join(root,'public',file)));
 }catch(e){send(400,{error:e.message||'操作失敗'});}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'連接埠已使用；請開啟 http://127.0.0.1:'+port:e.message);process.exit(1);});
if(process.env.FANTASY_NO_LISTEN!=='1')server.listen(port,'127.0.0.1',()=>console.log('對戰研究室已啟動：http://127.0.0.1:'+port));
