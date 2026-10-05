"""Import user-supplied MUK without modifying the originals.

Run with the bundled Python runtime and the upload directory as argv[1].
Generated JSON stays server-side; binary source copies are delivered through an
authenticated endpoint, never through public/ or a client import.
"""
from pathlib import Path
from docx import Document
from docx.table import Table, _Cell
from docx.text.paragraph import Paragraph
from openpyxl import load_workbook
from openpyxl.utils.cell import range_boundaries, get_column_letter
from datetime import date, datetime
import base64, hashlib, json, re, subprocess, sys

root=Path(__file__).resolve().parents[1]
uploads=Path(sys.argv[1])
names=['14. FR.IA.05.A. Pertanyaan Tertulis Pilihan Ganda.docx','14. FR.IA.05.C. Lembar Jawaban Pilihan Ganda.docx','cover FRIA02 Demonstrasi.docx','yunitaDOKUMEN MUK -Okupasi Pelaksana pembukuan  AKL  2024 2025 (1) (1).docx','KUNCI RASA SAYANG OKE.xlsx']
def extract(path):
 d=Document(path); blocks=[]
 for child in d.element.body:
  if child.tag.endswith('}p'):
   text=Paragraph(child,d).text.strip()
   if text: blocks.append({'type':'paragraph','text':text})
  elif child.tag.endswith('}tbl'):
   t=Table(child,d)
   blocks.append({'type':'table','rows':[[_Cell(c,t).text.strip() for c in r.tc_lst] for r in t._tbl.tr_lst]})
 return blocks
docs=[extract(uploads/n) for n in names[:4]]
muk=docs[3]
assert len(muk)==192, 'Source changed: review block mapping before importing'
def text(block):
 return block['text'] if block['type']=='paragraph' else '\n'.join(' | '.join(r) for r in block['rows'])
def source(start,end): return '\n\n'.join(text(b) for b in muk[start:end])
def clean(s): return re.sub(r'\s+',' ',s).strip()
units=[{'code':r[1],'title':clean(r[2])} for r in muk[19]['rows'][1:] if len(r)>2 and r[1].startswith('M.')]
assert len(units)==5
units[3]['title']='Menyusun Laporan Keuangan Entitas Tunggal untuk Skala Usaha Mikro, Kecil, dan Menengah'
seed=json.loads((root/'data/seed.json').read_text())
base={t['code']:t for t in seed['templates']}
spans={'APL.01':(7,27),'APL.02':(27,35),'MAPA.01':(35,48),'MAPA.02':(48,61),'AK.01':(61,64),'AK.04':(64,66),'AK.07':(66,74),'IA.01':(74,92),'IA.02':(92,129),'IA.03':(129,137),'IA.05.B':(137,144),'IA.05.C':(144,150),'AK.02':(157,167),'AK.03':(167,171),'AK.05':(171,177),'AK.06':(177,183),'VA':(183,192)}
templates=[]
for code,(start,end) in spans.items():
 t=json.loads(json.dumps(base[code]));t.update(source=source(start,end),revision=1,active=True,sourceImport='pembukuan-2026-v1')
 for f in t['fields']:
  for old,new in zip(seed['units'],units): f['label']=f['label'].replace(old['code'],new['code']).replace(old['title'],new['title'])
 templates.append(t)
by={t['code']:t for t in templates}
def field(fid,label,role='asesor',kind='textarea',required=False,section='Isian formulir',options=None):
 return dict(id=fid,label=label,role=role,type=kind,required=required,section=section,options=options or [])
def identity():
 return [field('bb-tuk','TUK / tempat pelaksanaan',kind='text'),field('bb-tuk-type','Jenis TUK',kind='select',options=['Sewaktu','Tempat kerja','Mandiri']),field('bb-date','Tanggal asesmen',kind='date'),field('bb-reg','Nomor registrasi asesor',kind='text')]
labels={'f22':'Rapor SMK Akuntansi / Layanan Perbankan semester 1–4','f23':'Verifikasi: Rapor SMK Akuntansi / Layanan Perbankan semester 1–4','f24':'Sertifikat / surat keterangan PKL Pelaksana Pembukuan bidang Teknisi Akuntansi','f25':'Verifikasi: Sertifikat / surat keterangan PKL Pelaksana Pembukuan','f30':'Pas foto terbaru latar merah 3 × 4 (2 lembar)','f31':'Verifikasi: Pas foto terbaru latar merah 3 × 4'}
for f in by['APL.01']['fields']: f['label']=labels.get(f['id'],f['label'])

# APL.02 preserves each source element and all of its KUK, not just one checkbox per unit.
elements=[];fields=[]
for i,bi in enumerate(range(29,34)):
 u=units[i];elems=[r[0] for r in muk[bi]['rows'] if r and 'Elemen' in r[0]]
 for j,e in enumerate(elems):
  label=clean(e);section=u['code']+' — '+u['title'];prefix=f'bb-apl2-u{i+1}-e{j+1}'
  fields.extend([field(prefix+'-level','Dapatkah saya? '+label,'asesi','select',True,section,['Kompeten','Belum kompeten']),field(prefix+'-evidence','Bukti relevan untuk elemen '+str(j+1),'asesi','textarea',False,section)])
  elements.append({'unit':u['code'],'text':label})
fields += [field('bb-apl2-rec','Rekomendasi kelanjutan asesmen',kind='select',required=True,section='Tinjauan asesor',options=['Dapat dilanjutkan','Tidak dapat dilanjutkan']),field('bb-apl2-method','Pendekatan asesmen',kind='text',section='Tinjauan asesor'),field('bb-apl2-note','Catatan asesor',section='Tinjauan asesor')]
by['APL.02']['fields']=fields

# Observations use the actual KUK rows, retaining combined cells as in the source.
fields=identity();observation=[]
for ui,blocks in enumerate([[79],[80],[82],[84,85],[87]]):
 element=''
 for bi in blocks:
  for row in muk[bi]['rows']:
   if len(row)<7 or not row[2].strip() or row[2]=='Kriteria Unjuk Kerja': continue
   if row[0].startswith('Unit') or row[1]=='Kode Unit': continue
   if row[1].strip(): element=clean(row[1])
   criterion=clean(row[2]);idx=len(observation)+1;section=units[ui]['code']+' — '+element
   observation.append({'unit':units[ui]['code'],'element':element,'criterion':criterion})
   fields += [field(f'bb-obs-{idx}',criterion,kind='select',required=True,section=section,options=['Ya','Tidak','Penilaian lanjut']),field(f'bb-obs-note-{idx}','Penilaian lanjut / bukti observasi',section=section)]
fields += [field('bb-obs-standard','Standar industri / tempat kerja'),field('bb-obs-result','Rekomendasi hasil observasi',kind='select',required=True,options=['Kompeten','Belum kompeten']),field('bb-obs-feedback','Umpan balik untuk asesi')]
by['IA.01']['fields']=fields

# Three attached demonstration covers supplement the MUK's integrated 420 minute scenario.
by['IA.02']['source']+='\n\nLAMPIRAN TUGAS DEMONSTRASI RASA SAYANG\n\n'+'\n\n'.join(text(b) for b in docs[2])
tasks=[('MA-RASAYANG/2526/LSP1/SMK11MRT','Mengelola Akun dalam Laporan Keuangan',90),('BB-RASAYANG/2526/LSP1/SMK11MRT','Memproses Buku Besar',90),('LK-RASAYANG/2526/LSP1/11MRT','Menyusun Laporan Keuangan',180)]
fields=identity()+[field('bb-practice-time','Waktu pelaksanaan yang ditetapkan asesor (menit)',kind='text',required=True),field('bb-practice-standard','Acuan pembanding yang ditetapkan asesor',kind='text',required=True)]
for i,(code,title,minutes) in enumerate(tasks):
 section=f'{code} — {title} ({minutes} menit pada lampiran)'
 fields += [field(f'bb-practice-report-{i}','Uraian hasil pekerjaan','asesi','textarea',True,section),field(f'bb-practice-file-{i}','Bukti hasil pekerjaan (PDF)','asesi','file',False,section),field(f'bb-practice-result-{i}','Pencapaian tugas',kind='select',required=True,section=section,options=['Tercapai','Belum tercapai']),field(f'bb-practice-note-{i}','Catatan penilaian asesor',section=section)]
by['IA.02']['fields']=fields
by['IA.02']['practiceNotice']='MUK menetapkan 420 menit untuk tugas terintegrasi. Lampiran Rasa Sayang memuat tugas 90, 90, dan 180 menit. Ikuti waktu dan acuan pembanding yang ditetapkan asesor; baca kedua sumber pada tab Acuan dokumen.'

fields=identity()
support=[]
for row in muk[133]['rows']:
 if len(row)>1 and re.match(r'^\d+\.',row[0]):
  q=clean(row[1]);n=len(support)+1;support.append(q)
  fields += [field(f'bb-pmo-response-{n}',q+' — Tanggapan asesi',required=True,section='Pertanyaan pendukung observasi'),field(f'bb-pmo-result-{n}','Pencapaian pertanyaan '+str(n),kind='select',required=True,section='Pertanyaan pendukung observasi',options=['Ya','Tidak'])]
fields.append(field('bb-pmo-feedback','Umpan balik asesor'));by['IA.03']['fields']=fields

questions=[]
for i,bi in enumerate([5,7,9,11,13]):
 for row in docs[0][bi]['rows']:
  for cell in row:
   parts=[clean(s) for s in cell.splitlines() if clean(s)]
   if len(parts)!=5: continue
   starred=[j for j,o in enumerate(parts[1:]) if '*' in o]
   assert len(starred)==1
   n=len(questions)+1
   questions.append({'id':f'bb-pg-{n}','text':parts[0],'unitCode':units[i]['code'],'options':[o.replace('*','').strip() for o in parts[1:]],'answer':'ABCD'[starred[0]],'review':True,'note':'Kunci awal berasal dari tanda * pada dokumen soal. Tinjau redaksi, pemetaan unit, dan kunci sebelum mengaktifkan ujian.'})
assert len(questions)==10
questions[5]['note']='Sumber menandai B (Saldo), sedangkan sisi kanan buku besar adalah Kredit (opsi C). Kunci sumber dipertahankan; admin harus menetapkan kunci yang benar dan menyelesaikan tinjauan.'
questions[6]['note']='Tinjau opsi D yang tertulis "Catatan arus kas laporan keuangan". Header sumber salah mencantumkan M.69PTA00.003.3; pemetaan digital mengikuti daftar APL.01 yaitu M.69PTA00.004.3.'
questions[7]['note']='Header sumber salah mencantumkan M.69PTA00.003.3; pemetaan digital mengikuti APL.01 yaitu M.69PTA00.004.3. Tinjau redaksi dan kunci.'
pgsource='FR.IA.05A. PERTANYAAN TERTULIS PILIHAN GANDA\nPELAKSANA PEMBUKUAN\n264 TAHUN 2023\n\n'+'\n\n'.join(str(i+1)+'. '+q['text']+'\n'+'\n'.join('ABCD'[j]+'. '+o for j,o in enumerate(q['options'])) for i,q in enumerate(questions))
pg=json.loads(json.dumps(base['IA.05']));pg.update(source=pgsource,active=True,revision=1,sourceImport='pembukuan-2026-v1',title='Pertanyaan tertulis pilihan ganda — Pelaksana Pembukuan')
templates.append(pg)
by['IA.05.B']['source']='CATATAN KUNCI PILIHAN GANDA\nKunci aktual dan tinjauan dikelola pada menu Bank soal. Tanda * pada file soal asli menjadi kunci awal, bukan validasi kebenaran.\n\n'+by['IA.05.B']['source']+'\n\nBagian berjudul IA.05.B pada MUK berisi 4 jawaban uraian yang berkaitan dengan IA.03, bukan kunci 10 soal pilihan ganda terlampir.'
by['IA.05.B']['restricted']=True
by['IA.05.C']['source']+='\n\nLampiran lembar jawaban asli menyediakan 38 nomor. Lembar jawaban digital menampilkan 10 soal yang tersedia, atau jumlah soal pada versi ujian yang dikerjakan.'
# Staff-only planning and internal validation retain source examples without treating them as decisions.
for code in ['MAPA.01','MAPA.02','VA','AK.05','AK.06']: by[code]['restricted']=True
notes=[
 'Kode unit mengikuti daftar APL.01: M.69PTA00.001.3, .002.1, .003.3, .004.3, dan .008.3. IA.01 mencantumkan .008.1; lampiran demonstrasi menyingkat .003 dan .004; header soal unit 4 menggunakan .003.3. Periksa dengan dokumen skema sebelum digunakan.',
 'Durasi MUK terintegrasi adalah 420 menit, sementara tiga cover demonstrasi menyebut 90 + 90 + 180 = 360 menit. Asesor wajib menetapkan waktu praktik pada IA.02.',
 'MUK menyebut SAK EP dan SAK EMKM pada bagian berbeda. Tetapkan acuan pembanding sesuai skema; isi sumber tidak diubah diam-diam.',
 'APL.01 meminta rapor semester 1–4, sedangkan skenario IA.02 menyebut semester 1–5. Label permohonan mengikuti APL.01; persyaratan perlu dikonfirmasi LSP.',
 'Ada 10 soal pilihan ganda A–D. Lembar jawaban pendukung memiliki 38 nomor; lembar digital mengikuti jumlah soal dalam versi ujian.',
 'Nomor 6 menandai Saldo sebagai kunci sisi kanan buku besar. Admin perlu meninjau kunci. Seluruh soal diimpor dengan status perlu ditinjau dan ujian belum aktif.',
 'IA.05.B dalam MUK berisi 4 jawaban uraian pendukung observasi, bukan kunci 10 soal PG. Kunci PG awal diambil dari tanda bintang pada file soal terpisah.',
 'Workbook Rasa Sayang dipertahankan asli. sales!G9 berisi angka 18 pada kolom piutang, dan sales!O33 menunjukkan selisih -18; lajur!D66 menyimpan selisih sekitar Rp17,995. Periksa sebelum menjadikannya acuan penilaian.',
 'Data kasus workbook bertanggal November–Desember 2024. aYAT-JP menyebut Desember 2022 pada beberapa instruksi dengan pembayaran Januari 2025. Tahun dan tarif dalam soal dipertahankan sebagai data kasus, bukan aturan periode berjalan.',
 'Angka ambang 80% adalah pengaturan awal aplikasi, bukan ketentuan yang ditemukan dalam lampiran; admin harus menetapkannya sebelum membuka ujian.',
]

wb=load_workbook(uploads/names[4],data_only=True)
wf=load_workbook(uploads/names[4],data_only=False)
def scalar(v):
 if isinstance(v,(date,datetime)): return v.strftime('%d/%m/%Y')
 return v
def table(sheet,area,title):
 s=wb[sheet];a,b,c,d=range_boundaries(area);rows=[]
 for row in s.iter_rows(min_row=b,max_row=d,min_col=a,max_col=c):
  vals=[scalar(x.value) for x in row]
  if any(x is not None for x in vals): rows.append({'row':row[0].row,'values':vals})
 return {'sheet':sheet,'range':area,'title':title,'columns':[get_column_letter(i) for i in range(a,c+1)],'rows':rows}
# Explicit allowlist excludes journal keys, completed reports, and side-column solutions.
caseTables=[table('Neraca Sldo','A1:D64','Neraca saldo awal 30 November 2024'),table('rincian','B1:H50','Rincian data awal'),table('Bukti Transaksi','B1:J546','Dokumen transaksi Desember 2024'),table('ASET TETAP','B1:H26','Data awal aset tetap'),table('aYAT-JP','A1:D47','Dokumen penyesuaian')]
sheetSummary=[{'name':s.title,'rows':s.max_row,'columns':s.max_column,'formulaCount':sum(c.data_type=='f' for r in s for c in r)} for s in wf]
files=[]
for i,n in enumerate(names):
 content=(uploads/n).read_bytes();mime='application/vnd.openxmlformats-officedocument.'+('spreadsheetml.sheet' if n.endswith('.xlsx') else 'wordprocessingml.document')
 files.append({'id':['questions-original','answers-original','demonstration','muk-original','practice-key'][i],'name':n,'mime':mime,'restricted':i in [0,3,4],'size':len(content),'sha256':hashlib.sha256(content).hexdigest(),'base64':base64.b64encode(content).decode()})
data={'name':'Pelaksana Pembukuan','number':'264 TAHUN 2023','units':units,'templates':templates,'exam':{'questions':questions,'active':False,'threshold':80,'revision':1},'notes':notes,'caseTables':caseTables,'sheets':sheetSummary,'files':[{k:v for k,v in f.items() if k!='base64'} for f in files]}
for name,obj in [('pembukuan.json',data),('pembukuan-files.json',files)]:
 path=root/'data'/name
 body=json.dumps(obj,ensure_ascii=False,indent=2)+'\n'
 if path.exists():
  old=path.read_text();patch='*** Begin Patch\n*** Update File: '+str(path)+'\n@@\n'+''.join('-'+x+'\n' for x in old.splitlines())+''.join('+'+x+'\n' for x in body.splitlines())+'*** End Patch\n'
 else: patch='*** Begin Patch\n*** Add File: '+str(path)+'\n'+''.join('+'+x+'\n' for x in body.splitlines())+'*** End Patch\n'
 subprocess.run(['apply_patch'],input=patch,text=True,check=True)
print(json.dumps({'units':len(units),'templates':[(t['code'],len(t['fields'])) for t in templates],'apl02Elements':len(elements),'observationRows':len(observation),'questions':len(questions),'files':len(files),'caseTables':len(caseTables),'workbookSheets':len(sheetSummary)}))
