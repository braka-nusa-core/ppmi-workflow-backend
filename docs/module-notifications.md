# Notifications dan Reminder

Modul ini menyimpan notifikasi per user dan membuat reminder otomatis untuk tanggal jatuh tempo.

## 1. Notifikasi user

**Authentication:** Bearer token. Setiap user hanya melihat notifikasinya sendiri, jadi tidak ada permission resource tambahan.

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| `GET` | `/notifications` | Notifikasi saya. Query: `unread=true`, `page` (default `1`), `limit` (default `20`, maksimal `100`). |
| `GET` | `/notifications/unread-count` | Jumlah yang belum dibaca: `{ "count": 3 }`. |
| `PATCH` | `/notifications/:id/read` | Tandai satu notifikasi dibaca. Notifikasi milik user lain: `404 Not Found`. |
| `POST` | `/notifications/read-all` | Tandai semua dibaca: `{ "updated": 3 }`. |

Data notifikasi:

| Field | Keterangan |
| --- | --- |
| `_id`, `recipientId` | ID dan penerima. |
| `title`, `message` | Teks yang ditampilkan (Bahasa Indonesia). |
| `type` | Jenis reminder, lihat bagian 2. |
| `referenceType`, `referenceId` | Entitas terkait, untuk tautan di UI (`VESSEL`, `QUOTATION`, `MEETING`, `FOLLOW_UP`). |
| `dueDate` | Tanggal jatuh tempo yang diingatkan. |
| `isRead`, `readAt` | Status baca. |
| `dedupeKey` | Kunci unik pencegah duplikat (internal). |

## 2. Reminder otomatis

Job reminder membuat notifikasi untuk semua yang jatuh tempo dalam jendela waktu (hari ini sampai N hari ke depan, dalam UTC).

| Jenis | Sumber | Penerima |
| --- | --- | --- |
| `VESSEL_DOCUMENT_EXPIRING` | `VesselDocument.validUntil` | PIC internal kapal. Jika tidak ada: user dengan permission `vessel:update` dan `SUPERADMIN`. |
| `VESSEL_SURVEY_EXPIRING` | `VesselSurvey.validUntil` (bukan `CANCELLED`) | Sama dengan dokumen kapal. |
| `INSTALLMENT_DUE` | Installment P&I, H&M, dan Cargo (yang belum `PAID`) | PIC internal quotation. Jika tidak ada: pembuat quotation. |
| `FOLLOW_UP_DUE` | `FollowUp.dueDate` berstatus `OPEN` | Penanggung jawab follow-up. |

**Konfigurasi (sementara):** bisnis baru menyebut contoh "7 hari sebelum deadline". Default 7 hari untuk semua jenis. Ubah lewat environment variable:

| Variable | Keterangan |
| --- | --- |
| `REMINDER_DAYS_BEFORE` | Hari untuk semua jenis. |
| `REMINDER_DAYS_<JENIS>` | Hari untuk satu jenis, misalnya `REMINDER_DAYS_INSTALLMENT_DUE=14`. Menang atas `REMINDER_DAYS_BEFORE`. |

**Anti-duplikat:** setiap notifikasi punya `dedupeKey` unik berisi jenis, sumber, tanggal jatuh tempo, dan penerima. Job boleh dijalankan berapa kali pun dalam sehari tanpa membuat notifikasi ganda. Jika tanggal jatuh tempo diubah, reminder baru dibuat untuk tanggal baru.

**Ketahanan:** jika satu sumber gagal, sumber lain tetap diproses. Kegagalan dilaporkan di `errors` pada respons.

## 3. Menjalankan job (scheduler)

Aplikasi berjalan di Vercel (serverless), jadi tidak ada cron di dalam proses server. Job dipanggil dari luar:

| Method | Endpoint | Auth |
| --- | --- | --- |
| `GET` / `POST` | `/notifications/reminders/run` | `Authorization: Bearer <CRON_SECRET>` |

- `vercel.json` sudah memuat cron harian `0 1 * * *` (UTC) ke endpoint ini. Vercel mengirim `CRON_SECRET` otomatis jika variable itu diisi di project.
- Jika `CRON_SECRET` belum diisi, semua request ditolak.
- Respons: `{ "created": { "VESSEL_DOCUMENT_EXPIRING": 0, ... }, "total": 0, "errors": [] }`.
- Plan Hobby di Vercel hanya mengizinkan cron harian. Untuk frekuensi lain, panggil endpoint dari scheduler eksternal dengan header yang sama.

## 4. Catatan

- Belum ada pengiriman lewat email atau kanal eksternal. Notifikasi hanya tampil di aplikasi, jadi retry pengiriman belum relevan.
- Notifikasi lama (sebelum modul ini) tetap valid: kolom baru bernilai kosong.
