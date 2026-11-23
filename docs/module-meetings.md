# Meetings dan Follow-up

Modul ini mencatat meeting dan tindak lanjutnya. Keduanya bisa ditautkan ke kapal, quotation, policy, atau klien. Ini data bisnis terstruktur, terpisah dari `log` yang hanya audit trail teknis.

## 1. Meeting

| Field | Type | Keterangan |
| --- | --- | --- |
| `_id` | `string` | ID meeting. |
| `title` | `string` | Judul. |
| `meetingDate` | `string (ISO)` | Tanggal meeting. |
| `location` | `string \| null` | Lokasi. |
| `participants` | `string \| null` | Peserta, teks bebas. |
| `agenda`, `outcome` | `string \| null` | Agenda dan hasil atau keputusan. |
| `entityType`, `entityId` | `string \| null` | Entitas terkait. Harus dikirim berpasangan. |
| `followUps` | `array` | Follow-up yang belum dihapus. |

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `GET` | `/meetings` | `meeting:read` | Daftar. Query: `entityType`, `entityId`, `from`, `to`, `page`, `limit`. |
| `GET` | `/meetings/:id` | `meeting:read` | Detail beserta follow-up. |
| `POST` | `/meetings` | `meeting:create` | Catat meeting, boleh sekaligus dengan follow-up. |
| `PATCH` | `/meetings/:id` | `meeting:update` | Ubah meeting. |
| `DELETE` | `/meetings/:id` | `meeting:delete` | Soft delete meeting beserta follow-up-nya. |

Contoh `POST /meetings`:

```json
{
  "title": "Review renewal KAIROS JAYA",
  "meetingDate": "2026-11-17",
  "participants": "Sari\nBudi (klien)",
  "agenda": "Renewal H&M",
  "outcome": "Klien minta penawaran ulang",
  "entityType": "VESSEL",
  "entityId": "vessel-id",
  "followUps": [
    { "title": "Kirim survey report", "assigneeId": "user-id", "dueDate": "2026-11-24" }
  ]
}
```

Follow-up yang dibuat bersama meeting otomatis menunjuk entitas yang sama.

## 2. Follow-up

| Field | Type | Keterangan |
| --- | --- | --- |
| `_id` | `string` | ID follow-up. |
| `meetingId` | `string \| null` | Meeting asal. Boleh kosong untuk tugas mandiri. |
| `entityType`, `entityId` | `string \| null` | Entitas terkait. |
| `title`, `description` | `string` | Tugas. |
| `assigneeId` | `string \| null` | Penanggung jawab. |
| `dueDate` | `string (ISO) \| null` | Tenggat. |
| `status` | `string` | `OPEN` (default), `DONE`, atau `CANCELLED`. |
| `completedAt` | `string (ISO) \| null` | Diisi saat status menjadi `DONE`, dikosongkan jika dibuka lagi. |

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `GET` | `/follow-ups` | `meeting:read` | Daftar. Query: `meetingId`, `entityType`, `entityId`, `assigneeId`, `status`, `dueBefore`, `page`, `limit`. |
| `GET` | `/follow-ups/:id` | `meeting:read` | Detail. |
| `POST` | `/follow-ups` | `meeting:create` | Buat follow-up. |
| `PATCH` | `/follow-ups/:id` | `meeting:update` | Ubah atau ganti status. |
| `DELETE` | `/follow-ups/:id` | `meeting:delete` | Soft delete. |

Follow-up `OPEN` yang tenggatnya mendekat masuk reminder untuk penanggung jawabnya (lihat [Notifications](module-notifications.md)).

## 3. Aturan

- Entitas, meeting, dan penanggung jawab harus ada dan aktif.
- Perubahan dicatat di `log` dengan `referenceType = MEETING` atau `FOLLOW_UP`.

## 4. Permission baru

Resource `meeting` belum ada di tabel `permission`. Buat `meeting:read`, `meeting:create`, `meeting:update`, dan `meeting:delete`, dan berikan ke organization unit yang berhak. Meeting dan follow-up memakai resource yang sama.
