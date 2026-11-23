# PPMI Workflow Backend

Backend untuk alur kerja asuransi laut PT Pandi Proteksi Marine Indonesia (PPMI). Sistem ini mengelola Quotation Slip (QS) untuk P&I, H&M, dan Cargo, mulai dari pembuatan oleh tim Teknik, approval Supervisor Teknik, pengiriman ke perusahaan asuransi, sampai keputusan insurer. Selain itu ada master data kapal beserta dokumen dan surveynya, PIC, meeting, dan reminder jatuh tempo.

Alur bisnis lengkap ada di `markdown/flow-v2.md` dan kontrak teknis QS di [docs/flow-quotation.md](docs/flow-quotation.md). Dokumentasi per modul ada di [docs/](docs/README.md).

## Stack

- NestJS 10 dengan TypeScript
- Prisma 7 dan PostgreSQL (lewat `@prisma/adapter-pg`). Client Prisma dibuat ke `src/generated/prisma`.
- Validasi dengan Zod (`nestjs-zod`), dokumentasi API dengan Swagger di `/docs`
- JWT untuk login, bcrypt untuk password
- Penyimpanan file di S3 (atau yang kompatibel)
- Vitest untuk test
- Deploy ke Vercel (serverless). Ada juga `Dockerfile` berbasis Node 20.

## Menjalankan di lokal

Prasyarat: Node.js 20, PostgreSQL, dan bucket S3 (hanya diperlukan untuk upload dokumen dan lampiran).

```bash
npm install
```

`postinstall` menjalankan `prisma generate`. Salin `.env.example` menjadi `.env` lalu isi:

| Variable                                                     | Keterangan                                                                                                            |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                               | Koneksi PostgreSQL.                                                                                                   |
| `JWT_SECRET`                                                 | Kunci tanda tangan token login (berlaku 6 jam).                                                                       |
| `PORT`                                                       | Port server. Default 3000.                                                                                            |
| `MODE`                                                       | `production` mengubah pesan di `GET /`.                                                                               |
| `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` | Storage untuk dokumen kapal dan lampiran quotation. `S3_REGION` ada di contoh env tetapi tidak dipakai kode saat ini. |
| `CRON_SECRET`                                                | Rahasia untuk job reminder. Tanpa ini endpoint reminder menolak semua request.                                        |
| `REMINDER_DAYS_BEFORE`                                       | Berapa hari sebelum jatuh tempo reminder muncul (default 7). Bisa diubah per jenis dengan `REMINDER_DAYS_<JENIS>`.    |
| `TEST_DATABASE_URL`                                          | Database khusus test integrasi. Lihat bagian Test.                                                                    |

Siapkan database, lalu isi data awal:

```bash
npx prisma migrate deploy
bun prisma/seed.ts
```

Seed membuat unit organisasi (Teknik, Cargo, P&I, H&M, Supervisor Teknik, Finance), permission, dan user contoh. Seed bisa dijalankan berulang, tetapi **setiap kali dijalankan ia mengatur ulang password user contoh ke `password123`**. Jangan menjalankannya ke database produksi.

Jalankan server:

```bash
npm run dev
```

Swagger ada di `http://localhost:3000/docs`. Login lewat `POST /auth/login`, lalu pakai `accessToken` sebagai Bearer token.

## User contoh dari seed

Semua memakai password `password123`.

| Email                        | Peran                                                                   |
| ---------------------------- | ----------------------------------------------------------------------- |
| `admin@ppmi.com`             | SUPERADMIN, melewati semua pemeriksaan permission                       |
| `user@ppmi.com`              | Teknik, departemen Cargo                                                |
| `pi.user1@ppmi.com`          | Teknik, departemen P&I                                                  |
| `hm.user1@ppmi.com`          | Teknik, departemen H&M                                                  |
| `supervisor.teknik@ppmi.com` | Supervisor Teknik (satu-satunya selain SUPERADMIN yang bisa approve QS) |
| `finance.user1@ppmi.com`     | Finance                                                                 |

Mencoba alur QS dari awal:

1. Login sebagai `pi.user1@ppmi.com`, buat quotation, lalu `POST /quotations/:id/submit`.
2. Login sebagai `supervisor.teknik@ppmi.com`, lalu `POST /quotations/:id/approve`.
3. Login lagi sebagai `pi.user1@ppmi.com`, lalu `POST /quotations/:id/send-to-insurance`. Ini membutuhkan satu perusahaan asuransi di database, dan seed belum membuatnya.

## Modul

| Kelompok               | Modul                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Master data            | users, organizations, clients, clubs, insurance-types, insurance-companies, banks, vessels (beserta dokumen, foto, survey, dan checklist dokumen), vessel-policies |
| Quotation slip         | quotations (workflow, objek, coverage, terms, warranties, lampiran, versi terms), pni (termasuk input QSheet), hm, cargo, qs-options                               |
| Policy sampai shipment | policies (placement leader/member, penerbitan polis), request-invoices, invoices (terbilang, nomor otomatis), payments (masuk dan keluar), shipments (resi)        |
| Operasional            | assignments (PIC), meetings dan follow-ups, notifications dan reminder                                                                                             |

Rincian endpoint dan aturan tiap modul ada di [docs/](docs/README.md). Koleksi Postman ada di `PPMI-Workflow-API.postman_collection.json`.

Alur setelah quotation disetujui insurer: Teknik mengisi placement dan menerbitkan polis, lalu membuat Request for Invoice. Finance memeriksa RFI, menerbitkan invoice, mencatat pembayaran dari klien dan ke penanggung, lalu mencatat pengiriman dokumen. Rencana dan default yang dipakai ada di `markdown/plan-policy-sampai-shipment.md`. Insurance Voucher, voucher internal Finance, dan PSRE belum dibangun.

## Konvensi

- **Soft delete.** Data dihapus dengan mengisi `deletedAt`. Setiap query harus menyaring `deletedAt: null`.
- **Audit.** Perubahan penting ditulis ke tabel `Log` dengan `referenceType` dan `referenceId`.
- **Permission.** Setiap endpoint memakai `@RequirePermission('resource', 'action')`. Permission dibuat lewat `prisma/seed.ts` dan diberikan ke unit organisasi. Permission unit induk berlaku juga untuk unit anak.
- **Controller.** `@UseGuards(AuthGuard, PermissionGuard)`, validasi body dengan `ZodValidationPipe`, logika di service.
- **Response.** Dibungkus `{ success, message?, data? }`. Primary key dikembalikan sebagai `_id`. Lihat [docs/api-response.md](docs/api-response.md).
- **Snapshot.** Quotation menyimpan salinan data kapal sendiri. Mengubah master kapal tidak mengubah quotation yang sudah ada.
- **Nilai yang belum disepakati** (kategori dokumen, status survey, trading area) dibuat sebagai teks bebas, dan aturan sementara ditandai provisional di kode.
- **Commit.** Format `type(scope): ringkasan` dengan butir `- ...` di badan, misalnya `feat(vessel): add master fields, documents, and surveys`.

## Test

```bash
npm test               # test unit (memakai mock, tidak butuh database)
npm run test:int       # test integrasi, butuh database khusus test
npm run test:e2e       # konfigurasi e2e terpisah
```

Test integrasi (`test/integration`) membuat data sungguhan dan tidak membersihkannya. Karena itu ia dijaga: dilewati bila `TEST_DATABASE_URL` tidak diisi, menolak berjalan bila nilainya sama dengan `DATABASE_URL`, dan menolak database yang namanya tidak mengandung kata `test`. Siapkan database kosong, terapkan migration ke sana, lalu:

```bash
TEST_DATABASE_URL="postgresql://user:pass@host:5432/ppmi_test" npm run test:int
```

## Deploy

- **Vercel.** `vercel.json` mengarahkan semua request ke `src/main.ts` dan memuat cron harian `0 1 * * *` ke `/notifications/reminders/run`. Isi `CRON_SECRET` di environment project agar Vercel mengirim header yang benar.
- **Migration.** Jalankan `npx prisma migrate deploy` terhadap database tujuan sebelum aplikasi baru dipakai.
- **Docker.** `Dockerfile` membangun image Node 20 dengan `npm ci`.

## Yang masih terbuka

Daftar pekerjaan, pertanyaan untuk PPMI, dan rencana yang kami rekomendasikan ada di folder `markdown/`:

- `plan.md`: pekerjaan yang tersisa
- `pertanyaan-ketua.md`: pertanyaan yang perlu dijawab PPMI
- `recommend-plan-23-11-2026.md`: rencana untuk topik yang menunggu keputusan
- `audit-23-11-2026.md`: kondisi backend per tanggal tersebut
