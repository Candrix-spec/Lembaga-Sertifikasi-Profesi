import {db,bucket,fail,now} from '@/lib/lsp-server';
import content from '@/data/pembukuan.json';

const IMPORT_ID='pembukuan-muk-2026-v1';
export async function ensurePembukuanSchema(){
 if(await db().prepare('SELECT id FROM content_imports WHERE id=?').bind(IMPORT_ID).first())return;
 // Batch is atomic. Only the original unconfigured scheme and empty placeholders
 // are populated; existing admin edits, documents, signatures and attempts remain intact.
 const ops=[db().prepare(`INSERT INTO schemes (id,name,number,units,active,ready)
 VALUES (?,?,?,?,1,1) ON CONFLICT(id) DO UPDATE SET
 name=excluded.name,number=CASE WHEN schemes.number='' THEN excluded.number ELSE schemes.number END,
 units=excluded.units,ready=1
 WHERE schemes.ready=0 AND json_array_length(schemes.units)=0`)
 .bind('pembukuan',content.name,content.number,JSON.stringify(content.units))];
 for(const template of content.templates)ops.push(db().prepare(`INSERT INTO templates (id,scheme_id,code,body) VALUES (?,?,?,?)
 ON CONFLICT(scheme_id,code) DO UPDATE SET body=excluded.body
 WHERE json_array_length(templates.body,'$.fields')=0 AND json_extract(templates.body,'$.active')=0`)
 .bind('pembukuan:'+template.code,'pembukuan',template.code,JSON.stringify(template)));
 ops.push(db().prepare('INSERT OR IGNORE INTO exams (scheme_id,body) VALUES (?,?)').bind('pembukuan',JSON.stringify(content.exam)));
 ops.push(db().prepare('INSERT OR IGNORE INTO content_imports (id,created_at) VALUES (?,?)').bind(IMPORT_ID,now()));
 await db().batch(ops);
}

export function canReadPembukuanMaterial(me:any,restricted=false){
 if(!me||!['admin','asesor','asesi'].includes(me.role))return false;
 if(me.role==='asesi')return me.scheme_id==='pembukuan'&&!restricted;
 return true;
}

export async function pembukuanMaterialResponse(me:any,params:any){
 if(!canReadPembukuanMaterial(me))fail('Anda tidak berhak mengakses materi skema ini.',403);
 if(params.file){
  const file=content.files.find(f=>f.id===params.file);
  if(!file)fail('Berkas pendukung tidak ditemukan.',404);
  if(!canReadPembukuanMaterial(me,file.restricted))fail('Kunci dan sumber bertanda jawaban hanya untuk Admin atau Asesor.',403);
  const key='muk/pembukuan/'+file.sha256;
  let object=await bucket().get(key);
  if(!object){
   // This JSON is only dynamically imported on the server, after authorization.
   const {default:originals}=await import('@/data/pembukuan-files.json');
   const original=originals.find(f=>f.id===file.id)!;
   const bytes=Uint8Array.from(atob(original.base64),c=>c.charCodeAt(0));
   await bucket().put(key,bytes,{httpMetadata:{contentType:file.mime}});
   object=await bucket().get(key);
  }
  if(!object)fail('Berkas belum tersedia. Silakan coba lagi.',503);
  return new Response(object.body,{headers:{'Content-Type':file.mime,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(params.case==='1')return Response.json({tables:content.caseTables},{headers:{'Cache-Control':'private, no-store'}});
 return Response.json({
  files:content.files.filter(f=>canReadPembukuanMaterial(me,f.restricted)),
  notes:me.role==='asesi'?[]:content.notes,
  sheets:me.role==='asesi'?[]:content.sheets,
  caseAvailable:true,
 },{headers:{'Cache-Control':'private, no-store'}});
}
