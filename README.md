# LSP SMK 11 Maret Jakarta

Portal sertifikasi dengan akun username/password Admin, Asesi, dan Asesor.

## Lingkup dokumen

Sumber: `DOKUMEN MUK - OKUPASI TKJ 2025 2026 Fix(1).docx`.

- 18 instrumen berisi lengkap pada sumber dimasukkan sebagai template aktif: APL.01–02, MAPA.01–02, AK.01–07, IA.01–03, IA.05 beserta B/C, dan VA.
- 13 elemen asesmen mandiri dan 40 kriteria observasi dari 5 unit Junior Technical Support.
- 10 soal, kunci sumber, ambang pengetahuan 80, skenario praktik 120 menit dan gambar topologi asli.
- IA.04A/B dan IA.06–11 hanya disebut di daftar periksa. Placeholder tidak aktif; Admin harus melengkapinya.
- Pelaksana Pembukuan dan Pelaksana Pembukuan Terkomputerisasi terdaftar, tetapi unit serta instrumennya belum disediakan oleh pengguna. Template awalnya tidak aktif.
- Kunci sumber soal 6 menyatakan A/30 untuk subnet /26. Soal wajib ditinjau sebelum aktivasi. Kunci tidak diubah secara diam-diam.
- Teks sumber tetap tersedia terpisah dari isian transaksi. Nama dan tanggal historis pada sumber bukan tanda tangan transaksi.
- Dokumen digital mengadaptasi tata letak sumber menjadi kolom per peran. Cetak melalui dialog cetak browser; tidak mereproduksi pagination DOCX secara identik.
- MAPA, laporan, dan validasi pada versi ini disimpan dalam berkas masing-masing asesi. Tanda tangan elektronik sederhana per peran, bukan tanda tangan tersertifikasi PSrE atau alur persetujuan multi-validator.

## Operasional

1. Pemilik masuk sebagai `admin` menggunakan password awal yang disediakan secara privat. Secret `INITIAL_ADMIN_PASSWORD` dipakai hanya ketika belum ada pengguna. Semua akun wajib mengganti password awal.
2. Admin menambah akun asesor serta mengimpor asesi melalui Excel `.xlsx`. Header: `username`, `password`, `kelas` (opsional). Batas per impor: 200 akun, 2 MB. Password 8–128 karakter. Username duplikat menolak seluruh transaksi.
3. Admin memilih skema dan menugaskan asesor untuk tiap asesi.
4. Asesi mengisi APL.01, mengunggah bukti PDF/JPG/PNG maksimal 10 MB, mengisi APL.02 dan menandatangani isian sendiri.
5. Asesor hanya melihat asesi yang ditugaskan kepadanya. Admin dapat mengedit semua isian; siapa pun hanya menandatangani sebagai akun sendiri.
6. Dokumen menyimpan snapshot template, skema, nilai, dan tanda tangan. Perubahan isi membatalkan tanda tangan; konflik revisi ditolak. Pembaruan template tidak diam-diam mengubah dokumen lama.
7. Ujian memakai snapshot soal saat dimulai. Penilaian pengetahuan dilakukan di server; kunci tidak dikirim ke asesi. Rekaman jawaban ditautkan ke IA.05/C setelah ujian dikumpulkan. Keputusan akhir tetap oleh asesor.
8. Tautan Sites awal tetap owner-private. Akun aplikasi tidak mengubah pembatasan akses Sites; pemilik perlu mengizinkan perubahan audience sebelum siswa/asesor mengakses dari luar akun pemilik.

## Penyimpanan dan keamanan

D1: akun, session, skema, template, dokumen, metadata berkas, bank soal, hasil ujian, audit. R2: bukti unggahan. Tidak ada data produk yang hanya disimpan di localStorage.

Password di-hash PBKDF2 SHA-256 dengan salt acak, 100.000 iterasi. Session acak di-hash di database, cookie HttpOnly/Secure/SameSite None + Partitioned, kedaluwarsa 8 jam. API memeriksa hak akses dan kolom di server, origin mutasi, throttling login, kepemilikan berkas, serta revisi dokumen. Audit tidak merekam password atau isi dokumen.

## Validasi

`node tests/security.mjs` menjalankan handler API asli dengan SQLite in-memory sebagai adaptor D1. Mencakup isolasi peran, snapshot, tanda tangan, konflik revisi, impor akun atomik, koreksi bank soal, perlindungan kunci, penilaian dan CSRF. `tsc --noEmit` dan build Sites memeriksa kompilasi.

Pengujian browser dan registrasi WebMCP tidak dijalankan: lingkungan ini hanya mengizinkan browser QA ketika diminta. WebMCP dideteksi opsional dan hanya membuka halaman kerja; tidak menandatangani atau mengirim isian.
