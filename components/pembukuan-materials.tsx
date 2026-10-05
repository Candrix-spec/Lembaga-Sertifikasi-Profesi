'use client';
import {useEffect,useState} from 'react';
import {Download,LockKeyhole} from 'lucide-react';
import {Table,TableHeader,TableHead,TableBody,TableRow,TableCell} from '@/components/ui/table';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';

export function PembukuanMaterials({role}:{role:string}){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[tables,setTables]=useState<any[]>([]),[selected,setSelected]=useState('0'),[busy,setBusy]=useState(false);
 const request=async(extra='')=>{const r=await fetch('/api/lsp?action=materials&schemeId=pembukuan'+extra,{cache:'no-store'});const d:any=await r.json();if(!r.ok)throw Error(d.error||'Materi belum tersedia.');return d;};
 useEffect(()=>{let live=true;setData(null);request().then(d=>{if(live)setData(d)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[role]);
 const openCase=async()=>{setBusy(true);setError('');try{setTables((await request('&case=1')).tables)}catch(e:any){setError(e.message)}finally{setBusy(false)}};
 const table=tables[Number(selected)];
 const value=(v:any)=>v===null?'':typeof v==='number'?v.toLocaleString('id-ID',{maximumFractionDigits:2}):String(v);
 return <section className="panel pembukuan-materials no-print">
  <h2>Materi Pelaksana Pembukuan</h2>
  <p className="muted">MUK, tugas demonstrasi, dan data kasus PT Rasa Sayang.</p>
  {error&&<p role="alert" className="notice">{error}</p>}
  {!data&&!error&&<p role="status">Memuat materi…</p>}
  {data&&<>
   <details><summary>Berkas pendukung ({data.files.length})</summary><ul className="material-files">{data.files.map((f:any)=><li key={f.id}><a href={'/api/lsp?action=materials&schemeId=pembukuan&file='+f.id} className="text-btn"><Download size={17}/>{f.name}</a>{f.restricted&&<span className="muted small"><LockKeyhole size={13}/> Khusus petugas</span>}</li>)}</ul></details>
   {role!=='asesi'&&<details><summary>Catatan sumber untuk ditinjau ({data.notes.length})</summary><ul>{data.notes.map((n:string,i:number)=><li key={i}>{n}</li>)}</ul><p className="muted">Excel asli memiliki {data.sheets.length} sheet, termasuk satu sheet kosong. File asli tetap utuh; angka sumber belum dianggap sebagai kunci yang sudah divalidasi.</p></details>}
   <details onToggle={e=>{if(e.currentTarget.open&&!tables.length&&!busy)void openCase()}}><summary>Data awal dan dokumen transaksi untuk demonstrasi</summary><p className="muted">Nilai tersimpan dari area data kasus workbook, tanpa rumus, jurnal jawaban, atau laporan yang sudah dikerjakan. Periode kasus mengikuti sumber, November–Desember 2024.</p>{busy&&<p role="status">Memuat data kasus…</p>}{table&&<>
    <label className="material-select">Pilih bagian data<Select value={selected} onValueChange={v=>setSelected(v??'0')}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{tables.map((t:any,i:number)=><SelectItem key={t.sheet} value={String(i)}>{t.title}</SelectItem>)}</SelectContent></Select></label>
    <p className="muted small">Sumber: {table.sheet}, rentang {table.range}. Huruf kolom dan nomor baris mengikuti Excel asli.</p>
    <div className="case-data-scroll" role="region" aria-label={table.title} tabIndex={0}><Table><TableHeader><TableRow><TableHead>Baris</TableHead>{table.columns.map((c:string)=><TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader><TableBody>{table.rows.map((r:any)=><TableRow key={r.row}><TableCell>{r.row}</TableCell>{r.values.map((v:any,i:number)=><TableCell key={i} className={typeof v==='number'?'case-number':''}>{value(v)}</TableCell>)}</TableRow>)}</TableBody></Table></div>
   </>}</details>
  </>}
 </section>;
}
