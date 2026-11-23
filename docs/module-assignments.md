# Assignments (PIC)

Modul ini mencatat PIC pada kapal, quotation, policy, atau klien, lengkap dengan riwayatnya. PIC yang masih aktif juga menjadi penerima reminder.

## 1. Data assignment

| Field | Type | Keterangan |
| --- | --- | --- |
| `_id` | `string` | ID assignment. |
| `entityType` | `string` | `VESSEL`, `QUOTATION`, `POLICY`, atau `CLIENT`. |
| `entityId` | `string` | ID entitas. Harus ada dan belum dihapus. |
| `category` | `string` | `INTERNAL`, `EXTERNAL`, `INSURER` (penanggung), atau `INSURED` (tertanggung). |
| `userId` | `string \| null` | User PIC. Wajib untuk `INTERNAL`, tidak boleh untuk kategori lain. |
| `name`, `email`, `phone`, `organizationName` | `string \| null` | Kontak. `name` wajib untuk kategori selain `INTERNAL`. |
| `role` | `string \| null` | Peran dalam proses (teks bebas). |
| `note` | `string \| null` | Catatan. |
| `startDate` | `string (ISO)` | Mulai bertugas. Default saat dibuat. |
| `endDate` | `string (ISO) \| null` | Selesai bertugas. `null` berarti masih aktif. |
| `user` | `object \| null` | `{ id, fullname, email }` untuk `INTERNAL`. |

## 2. Endpoint

**Authentication:** Bearer token. Permission memakai resource baru `assignment`.

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `GET` | `/assignments` | `assignment:read` | Daftar. Query: `entityType`, `entityId`, `userId`, `category`, `includeEnded`, `page`, `limit`. |
| `GET` | `/assignments/:id` | `assignment:read` | Detail. |
| `POST` | `/assignments` | `assignment:create` | Tugaskan PIC. |
| `PATCH` | `/assignments/:id` | `assignment:update` | Ubah kontak, `role`, atau `note`. |
| `DELETE` | `/assignments/:id` | `assignment:delete` | Akhiri assignment (mengisi `endDate`). |

Contoh `POST /assignments`:

```json
{
  "entityType": "VESSEL",
  "entityId": "vessel-id",
  "category": "INTERNAL",
  "userId": "user-id",
  "role": "Underwriter"
}
```

## 3. Aturan

- Secara default `GET /assignments` hanya menampilkan yang masih aktif. Kirim `includeEnded=true` untuk melihat riwayat.
- `DELETE` tidak menghapus data: assignment diakhiri dan tetap ada di riwayat. Mengganti orang berarti mengakhiri assignment lama dan membuat yang baru, karena `userId` dan entitas tidak bisa diubah lewat `PATCH`.
- User yang sama dengan `role` yang sama tidak bisa ditugaskan dua kali pada entitas yang sama selagi aktif: `400 Bad Request`.
- Entitas atau user yang tidak ditemukan: `404` atau `400`.
- Semua perubahan dicatat di `log` dengan `referenceType = ASSIGNMENT`.

## 4. Permission baru

Resource `assignment` belum ada di tabel `permission`. Buat `assignment:read`, `assignment:create`, `assignment:update`, dan `assignment:delete` lalu berikan ke organization unit yang berhak. `SUPERADMIN` tidak memerlukannya.
