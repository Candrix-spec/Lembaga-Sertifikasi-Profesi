// Local integration checks against the real route handlers and an isolated SQLite database.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),sql=new DatabaseSync(':memory:');
for(const file of fs.readdirSync(path.join(root,'drizzle')).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(path.join(root,'drizzle',file),'utf8'));
class Statement{
 constructor(query,args=[]){this.query=query;this.args=args;}
 bind(...args){return new Statement(this.query,args)}
 async first(){return sql.prepare(this.query).get(...this.args)||null}
 async all(){return {results:sql.prepare(this.query).all(...this.args)}}
 async run(){const r=sql.prepare(this.query).run(...this.args);return {meta:{changes:Number(r.changes)}}}
}
const objects=new Map();
const env={DB:{prepare:q=>new Statement(q),batch:async ops=>{sql.exec('BEGIN');try{const out=[];for(const op of ops)out.push(await op.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}},BUCKET:{get:async k=>objects.has(k)?{body:objects.get(k)}:null,put:async(k,b)=>objects.set(k,b)}};
const cache={};
function load(file){
 const full=path.join(root,file);if(cache[full])return cache[full].exports;
 if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(full,'utf8'));
 const m={exports:{}};cache[full]=m;
 const js=ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',js)(id=>id==='cloudflare:workers'?{env}:id.startsWith('@/')?load(id.slice(2)+(path.extname(id)?'':'.ts')):require(id),m,m.exports);
 return m.exports;
}
(async()=>{
 const server=load('lib/lsp-server.ts'),route=load('app/api/lsp/route.ts'),content=load('data/pembukuan.json');
 await server.seedData();
 for(const [id,role,scheme] of [['admin','admin',null],['asesor','asesor',null],['asesi','asesi','pembukuan'],['other','asesi','jts']]){
  sql.prepare('INSERT INTO users (id,username,password,name,role,scheme_id,assessor_id,assessment_year,must_change,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,id,'test','Test '+id,role,scheme,'asesor','2026',0,'2026-09-15');
  sql.prepare('INSERT INTO sessions (id,user_id,expires,assessment_year) VALUES (?,?,?,?)').run(await server.hash(id),id,Date.now()+600000,'2026');
 }
 async function req(who,action,data={},method='GET'){
  const query=new URLSearchParams({action,schemeId:'pembukuan',...data});
  const headers={cookie:'lsp_session='+who,'content-type':'application/json'};
  const r=await route[method](new Request('https://local.test/api/lsp'+(method==='GET'?'?'+query:''),{method,headers,...(method==='POST'?{body:JSON.stringify({action,schemeId:'pembukuan',...data})}:{})}));
  return {status:r.status,body:r.headers.get('content-type')?.includes('application/json')?await r.json():new Uint8Array(await r.arrayBuffer())};
 }
 let r=await req('admin','state');assert.equal(r.status,200);assert.equal(r.body.schemes.find(s=>s.id==='pembukuan').units.length,5);
 r=await req('admin','assessmentYear',{year:'2025',label:'Tahun asesmen 2025',active:true},'POST');assert.equal(r.status,200);assert(r.body.assessmentYears.some(y=>y.year==='2025'));
 sql.prepare('INSERT INTO users (id,username,password,name,role,scheme_id,assessment_year,must_change,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run('old-asesi','old-asesi','test','Asesi Tahun 2025','asesi','pembukuan','2025',0,'2025-09-15');sql.prepare('INSERT INTO sessions (id,user_id,expires,assessment_year) VALUES (?,?,?,?)').run(await server.hash('admin-old'),'admin',Date.now()+600000,'2025');
 r=await req('admin-old','state');assert.equal(r.status,200);assert.equal(r.body.user.accessYear,'2025');assert(r.body.users.some(u=>u.id==='old-asesi'));assert(!r.body.users.some(u=>u.id==='asesi'));
 r=await req('admin','assessmentYearDelete',{year:'2025',confirmation:'SALAH',confirmed:true},'POST');assert.equal(r.status,403);r=await req('admin','assessmentYearDelete',{year:'2025',confirmation:'KONFIRMASI',confirmed:true},'POST');assert.equal(r.status,200);assert.equal(sql.prepare('SELECT count(*) n FROM users WHERE assessment_year=?').get('2025').n,0);assert(!r.body.assessmentYears.some(y=>y.year==='2025'));
 sql.prepare("UPDATE users SET assessor_code='TKJ-001' WHERE id='asesor'").run();
 r=await req('admin','users',{import:true,rows:[{username:'imported-asesi',password:'password-123',className:'XI TKJ 1',groupNumber:'TKJ-01',waktuUjian:'2026-10-02 08:00-12:00',penguji:'TKJ-001',role:'asesi',schemeId:'pembukuan'}]},'POST');assert.equal(r.status,200);assert.equal(r.body.linkedSchedules,1);
 assert.equal(sql.prepare('SELECT assessor_id,group_number FROM users WHERE username=?').get('imported-asesi').assessor_id,'asesor');
 assert.equal(sql.prepare('SELECT count(*) n FROM schedules WHERE group_number=? AND assessor_id=?').get('TKJ-01','asesor').n,1);
 const imported=sql.prepare('SELECT id FROM users WHERE username=?').get('imported-asesi');
 sql.prepare('INSERT INTO documents (id,user_id,scheme_id,code,body,revision,updated_at,assessment_year) VALUES (?,?,?,?,?,?,?,?)').run('retention-doc',imported.id,'pembukuan','APL.01',JSON.stringify({status:'Draf',signatures:{}}),1,'2026-09-18','2026');
 r=await req('admin','userArchive',{id:imported.id,archived:true},'POST');assert.equal(r.status,200);assert.equal(r.body.retentionYears,5);assert.equal(sql.prepare('SELECT active FROM users WHERE id=?').get(imported.id).active,0);assert.equal(sql.prepare('SELECT id FROM documents WHERE user_id=?').get(imported.id).id,'retention-doc');
 r=await req('admin','userArchive',{id:imported.id,archived:false},'POST');assert.equal(r.status,200);assert.equal(sql.prepare('SELECT active,archived_at FROM users WHERE id=?').get(imported.id).active,1);assert.equal(sql.prepare('SELECT archived_at FROM users WHERE id=?').get(imported.id).archived_at,null);
 const keyFiles=content.files.filter(f=>f.restricted);
 for(const file of keyFiles){assert.equal((await req('asesi','materials',{file:file.id})).status,403);assert.equal((await req('other','materials',{file:file.id})).status,403)}
 assert.equal((await req('anonymous','materials')).status,401);
 r=await req('asesi','materials');assert.equal(r.body.files.length,2);assert.equal(r.body.notes.length,0);
 r=await req('asesor','materials');assert.equal(r.body.files.length,5);assert(r.body.notes.length>0);
 const source=await req('asesor','materials',{file:'practice-key'});assert.equal(source.status,200);assert.equal(await crypto.subtle.digest('SHA-256',source.body).then(b=>Buffer.from(b).toString('hex')),keyFiles.find(f=>f.id==='practice-key').sha256);
 assert.equal((await req('asesi','materials',{file:'demonstration'})).status,200);
 r=await req('asesi','materials',{case:'1'});assert.equal(r.body.tables.length,5);assert.equal(r.body.tables.find(t=>t.sheet==='Bukti Transaksi').columns.at(-1),'J');
 r=await req('asesi','templates');assert.equal(r.status,200);assert(!r.body.templates.some(t=>t.restricted));assert(!JSON.stringify(r.body).includes('Dokumen sumber*'));assert(!JSON.stringify(r.body).includes('J.611000.'));
 r=await req('admin','templates');assert.equal(r.status,200);assert(r.body.templates.some(t=>t.code==='MAPA.01'));assert(r.body.templates.some(t=>t.code==='VA'));
 r=await req('admin','document',{code:'MAPA.01',userId:'asesi'});assert.equal(r.status,200);assert.equal(r.body.document.template.code,'MAPA.01');
 r=await req('admin','document',{code:'IA.03',userId:'asesi'});assert.equal(r.status,200);assert.equal(r.body.document.template.code,'IA.03');
 sql.prepare('INSERT INTO documents (id,user_id,scheme_id,code,body,revision,updated_at,assessment_year) VALUES (?,?,?,?,?,?,?,?)').run('mapa-doc','asesi','pembukuan','MAPA.01',JSON.stringify((await req('admin','document',{code:'MAPA.01',userId:'asesi'})).body.document),1,'2026-09-15','2026');
 r=await req('admin','state');assert(r.body.docs.every(d=>d.code));
 assert(r.body.docs.some(d=>d.code==='MAPA.01'),'Admin state must include MAPA documents');
 for(const t of content.templates){server.validateTemplate(t);assert(new Set(t.fields.map(f=>f.id)).size===t.fields.length);assert(!JSON.stringify(t.fields).includes('jaringan komputer'));}
 assert.equal(content.templates.find(t=>t.code==='APL.02').fields.filter(f=>f.id.endsWith('-level')).length,18);
 r=await req('asesi','startExam',{},'POST');assert.equal(r.status,400);assert.match(r.body.error,/belum diaktifkan/);
 const upload=new FormData();upload.set('userId','asesi');upload.set('file',new File(['%PDF-1.4\nLocal test'], 'hasil-demonstrasi.pdf',{type:'application/pdf'}));
 const uploaded=await route.POST(new Request('https://local.test/api/lsp?action=upload',{method:'POST',headers:{cookie:'lsp_session=asesi'},body:upload}));
 assert.equal(uploaded.status,200);const uploadedData=await uploaded.json();assert.equal(sql.prepare('SELECT user_id FROM files WHERE id=?').get(uploadedData.id).user_id,'asesi');assert(objects.has(uploadedData.id));
 r=await req('asesi','document',{code:'IA.05.B',userId:'asesi'});assert.equal(r.status,403);
 r=await req('asesi','saveDocument',{code:'APL.01',userId:'asesi',revision:0,values:{f1:'Peserta Test'},submit:false},'POST');assert.equal(r.status,200);const saved=r.body.document;
 r=await req('admin','saveDocument',{code:'APL.02',userId:'asesi',revision:0,values:{},submit:false},'POST');assert.equal(r.status,403);
 r=await req('admin','sign',{code:'MAPA.01',userId:'asesi',revision:0,image:'data:image/png;base64,AA=='},'POST');assert.equal(r.status,403);
 // One-time import preserves subsequent admin changes and existing signed snapshots.
 sql.prepare('UPDATE schemes SET name=? WHERE id=?').run('Nama disunting admin','pembukuan');
 sql.prepare('UPDATE templates SET body=? WHERE scheme_id=? AND code=?').run(JSON.stringify({...content.templates[0],title:'Edit admin'}),'pembukuan','APL.01');
 await req('admin','state');assert.equal(sql.prepare('SELECT name FROM schemes WHERE id=?').get('pembukuan').name,'Nama disunting admin');
 assert.equal(JSON.parse(sql.prepare('SELECT body FROM templates WHERE scheme_id=? AND code=?').get('pembukuan','APL.01').body).title,'Edit admin');
 assert.deepEqual(JSON.parse(sql.prepare('SELECT body FROM documents WHERE user_id=?').get('asesi').body),saved);
 // An administrator must review all items before opening the exam. No silent key correction.
 const exam=structuredClone(content.exam);exam.active=true;
 r=await req('admin','saveExam',{exam},'POST');assert.equal(r.status,400);
 exam.questions.forEach(q=>q.review=false);exam.questions[5].answer='C';
 assert.equal((await req('admin','saveExam',{exam},'POST')).status,200);
 r=await req('asesi','exam');assert.equal(r.body.exam.questions.length,10);assert(r.body.exam.questions.every(q=>!('answer' in q)&&!('note' in q)));
 assert.equal((await req('asesi','startExam',{},'POST')).status,200);
 r=await req('asesi','attempt',{userId:'asesi'});assert(r.body.attempt.questions.every(q=>!('answer' in q)));
 const answers=Object.fromEntries(exam.questions.map(q=>[q.id,q.answer]));
 r=await req('asesi','submitExam',{userId:'asesi',answers},'POST');assert.equal(r.status,200);assert.equal(r.body.score,100);
 r=await req('asesi','document',{code:'IA.05.C',userId:'asesi'});assert.equal(r.body.document.examSnapshot.questions.length,10);
 r=await req('admin','userArchive',{id:'asesor',archived:true},'POST');assert.equal(r.status,200);assert.equal(sql.prepare('SELECT active FROM users WHERE id=?').get('asesor').active,0);
 r=await req('admin','userArchive',{id:'asesor',archived:false},'POST');assert.equal(r.status,200);assert.equal(sql.prepare('SELECT active FROM users WHERE id=?').get('asesor').active,1);
 console.log('PASS: 5 units, 18 templates, 18 self-assessment elements, protected original files, 5 case data sections, one-time import, role restrictions, 10-question exam and answer snapshot.');
})().catch(e=>{console.error(e);process.exitCode=1});
