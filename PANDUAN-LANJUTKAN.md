# Source Code Portal LSP P1 SMK 11 Maret Jakarta

Paket ini berisi source code lengkap portal LSP yang sedang dipublikasikan di:

https://lsp-smk-11-maret.apiancandra.chatgpt.site

## Teknologi

Portal ini dibuat dengan Next.js/Vinext, React, TypeScript, Drizzle ORM, Cloudflare D1 dan R2. Jadi source code ini dilanjutkan menggunakan VS Code atau editor JavaScript/TypeScript. Jika yang dimaksud “VB” adalah Visual Basic, source ini perlu ditulis ulang ke Visual Basic/.NET karena bukan proyek VB.

## Menjalankan lokal

Persyaratan:

- Node.js minimal 22.13
- pnpm 11
- Akun Cloudflare/Sites jika ingin deploy ke portal produksi

Perintah dasar:

```bash
pnpm install
cp .env.example .env
pnpm build
pnpm start
```

Untuk pengembangan:

```bash
pnpm dev
```

`INITIAL_ADMIN_PASSWORD` hanya digunakan saat database belum memiliki akun. Jangan memasukkan password produksi ke repository atau membagikannya.

## Struktur penting

- `app/page.tsx` — antarmuka login, Admin, Asesi, dan Asesor.
- `app/api/lsp/route.ts` — API autentikasi, dokumen, tanda tangan, impor, jadwal, tahun asesmen, dan verifikasi.
- `lib/lsp-server.ts` — autentikasi, session, akses database, hash password, dan aturan akses.
- `db/schema.ts` — schema database.
- `drizzle/` — migrasi database.
- `data/seed.json` — skema Junior Technical Support dan template instrumen utama.
- `data/pembukuan.json`, `data/office.ts` — data skema tambahan dan materi asesmen.
- `public/` — logo, background, topologi, dan berkas publik.
- `.openai/hosting.json` — binding D1/R2 dan konfigurasi Site.

## Fitur yang sudah ada

- Login Admin, Asesi, dan Asesor.
- APL 01, APL 02, MAPA, FR AK, FR IA, bank soal, ujian, dan tanda tangan digital sederhana.
- Verifikasi sesuai peran, impor Asesi Excel, kelas, kelompok, waktu ujian, dan penguji/No MET.
- Jadwal asesmen dan penugasan kelompok ke Asesor.
- Filter kelompok pada daftar Asesi dan Dokumen asesmen.
- Pemisahan data berdasarkan tahun asesmen secara logis.
- Retensi data minimal lima tahun serta penghapusan tahun dengan konfirmasi dua tahap.

## Pemeriksaan sebelum deploy

```bash
git diff --check
pnpm build
node scripts/check-pembukuan.cjs
```

Jangan memasukkan file `.env`, token deploy, password, atau kredensial Cloudflare ke dalam source code.
