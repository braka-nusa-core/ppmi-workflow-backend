# QS Templates

Templat Quotation Slip per jenis asuransi. Untuk P&I, templat dibuat per club dan boleh per jenis cover (`FULL` atau `LIMITED`), karena Conditions dan Survey Warranty mengikuti pilihan P&I Coverage.

Isi templat (`content`) disimpan sebagai JSON. Bentuknya ditentukan oleh frontend, backend tidak memeriksa isinya.

**Authentication:** Bearer token. Permission memakai resource `qs-template` (diberikan ke divisi Teknik lewat seed).

## Endpoint

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `GET` | `/qs-templates` | `qs-template:read` | Daftar tanpa `content`. Query: `templateDomain`, `clubId`, `coverType`, `page`, `limit`. |
| `GET` | `/qs-templates/:id` | `qs-template:read` | Detail beserta `content`. |
| `POST` | `/qs-templates` | `qs-template:create` | Buat templat. |
| `PATCH` | `/qs-templates/:id` | `qs-template:update` | Ubah nama, versi, club, cover, atau isi. |
| `DELETE` | `/qs-templates/:id` | `qs-template:delete` | Soft delete. |

Contoh `POST /qs-templates`:

```json
{
  "name": "MSIG - Limited Cover",
  "templateVersion": "2026-11",
  "templateDomain": "PNI",
  "clubId": "club-id",
  "coverType": "LIMITED",
  "content": {
    "conditions": ["..."],
    "surveyWarranty": "..."
  }
}
```

## Aturan

- `templateDomain`: `PNI`, `HULL_MACHINERY`, atau `CARGO`. Tidak bisa diubah setelah dibuat.
- Templat P&I wajib punya `clubId` yang masih aktif. `clubId` dan `coverType` hanya berlaku untuk P&I: `400` bila dikirim untuk H&M atau Cargo.
- `coverType` kosong berarti templat umum untuk club itu. Endpoint templat P&I (`GET /pni/clubs/:clubCode/template?coverType=`) mengembalikan templat yang cocok dengan cover yang dipilih, ditambah templat umum, dengan yang cocok di urutan pertama.
- `content: null` pada `PATCH` mengosongkan isi.
- Menghapus templat tidak mengubah quotation yang sudah dibuat darinya.
- Setiap perubahan dicatat di `log` dengan `referenceType = QS_TEMPLATE`.
