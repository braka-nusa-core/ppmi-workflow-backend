# Request for Invoice (RFI) Module

Teknik membuat RFI setelah placement polis selesai dan melengkapi dokumennya. Finance mereviu: disetujui (`READY_FOR_INVOICE`) atau dikembalikan ke Teknik untuk diperbaiki.

```
DRAFT -> RFI_SUBMITTED -> READY_FOR_INVOICE
              |
              +-> RETURNED_TO_TECHNICAL -> (perbaiki) -> RFI_SUBMITTED
```

**Kepemilikan unit Teknik:** aksi Teknik (buat, ubah, dokumen, submit, hapus) memeriksa `policy.quotation.technicalUnitId`. Bila kosong, siapa pun dengan permission boleh. Bila terisi, pengguna harus SUPERADMIN atau berada di unit yang sama, kalau tidak `403 Forbidden`. Aksi Finance (approve, return) tidak memeriksa unit.

---

## 1. Endpoint

**Authentication:** Bearer token. Permission mengikuti resource `request-invoice`.

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `POST` | `/policies/:policyId/request-invoices` | `request-invoice:create` | Membuat RFI `DRAFT`. |
| `GET` | `/request-invoices` | `request-invoice:read` | Daftar RFI. |
| `GET` | `/request-invoices/:id` | `request-invoice:read` | Detail, dokumen, review, checklist. |
| `PATCH` | `/request-invoices/:id` | `request-invoice:update` | Mengubah `notes`. |
| `POST` | `/request-invoices/:id/documents` | `request-invoice:update` | Upload dokumen (`multipart/form-data`). |
| `DELETE` | `/request-invoices/:id/documents/:documentId` | `request-invoice:update` | Soft delete dokumen. |
| `POST` | `/request-invoices/:id/submit` | `request-invoice:submit` | Mengajukan ke Finance. |
| `POST` | `/request-invoices/:id/approve` | `request-invoice:review` | Finance menyetujui. |
| `POST` | `/request-invoices/:id/return` | `request-invoice:review` | Finance mengembalikan ke Teknik. |
| `DELETE` | `/request-invoices/:id` | `request-invoice:update` | Soft delete, hanya `DRAFT`. |

## 2. Membuat dan membaca

**Body `POST /policies/:policyId/request-invoices`:**

```json
{ "notes": "Mohon diproses minggu ini" }
```

`notes` opsional. Aturan:
- Polis harus `PLACEMENT_COMPLETED`, kalau tidak `400 Bad Request`.
- Satu polis hanya boleh punya satu RFI aktif (belum dihapus): `400 Bad Request`.
- `requestNumber` berformat `RFI-YYYYMMDD-NNN`, urutan 3 digit per hari.

**Query `GET /request-invoices`:** `status`, `policyId`, `page` (default `1`), `limit` (default `50`, maksimal `200`).

**`GET /request-invoices/:id`** berisi RFI, `policy` (nomor polis, status, ringkasan quotation dengan `client` dan `insuranceType`), `documents`, `reviews` (terbaru dulu), dan `checklist`:

```json
{
  "checklist": [
    { "documentType": "POLICY_DOCUMENT", "required": true, "uploaded": true },
    { "documentType": "SIGNED_QS", "required": true, "uploaded": false },
    { "documentType": "CN_DN", "required": true, "uploaded": false },
    { "documentType": "RENEWAL_ATTACHMENT", "required": false, "uploaded": false },
    { "documentType": "OTHER", "required": false, "uploaded": false }
  ]
}
```

## 3. Dokumen

**Form `POST /request-invoices/:id/documents`:**

| Field | Wajib | Keterangan |
| --- | --- | --- |
| `file` | ya | PDF, gambar, atau dokumen Office, maksimal 50 MB. |
| `documentType` | ya | `POLICY_DOCUMENT`, `SIGNED_QS`, `CN_DN`, `RENEWAL_ATTACHMENT`, atau `OTHER`. |

File disimpan di S3 pada `request-invoices/{id}/{uuid}{ext}`. Yang tersimpan: `fileName`, `url`, `mimeType`, `fileSize`, `uploadedById`. Satu jenis dokumen boleh diunggah lebih dari sekali. Menghapus dokumen hanya soft delete, file di storage tidak dihapus.

Dokumen wajib untuk submit: `POLICY_DOCUMENT`, `SIGNED_QS`, `CN_DN` (konstanta `REQUIRED_DOCUMENT_TYPES` di `request-invoices.constants.ts`). `RENEWAL_ATTACHMENT` dan `OTHER` opsional.

## 4. Alur status

| Aksi | Dari | Ke | Catatan |
| --- | --- | --- | --- |
| Ubah, upload, hapus dokumen | `DRAFT`, `RETURNED_TO_TECHNICAL` | sama | Status lain: `400 Bad Request`. |
| `submit` | `DRAFT`, `RETURNED_TO_TECHNICAL` | `RFI_SUBMITTED` | Semua dokumen wajib harus ada. Mengisi `submittedById` dan `submittedAt`. |
| `approve` | `RFI_SUBMITTED` | `READY_FOR_INVOICE` | Body `{ "notes": "..." }` opsional. Review `APPROVED`. |
| `return` | `RFI_SUBMITTED` | `RETURNED_TO_TECHNICAL` | Body `{ "notes": "..." }` **wajib**. Review `RETURNED`. |
| `DELETE` | `DRAFT` | dihapus | Soft delete. |

Setiap perubahan status memakai `updateMany` yang dijaga status lama. Bila RFI berubah bersamaan, hasilnya `400 Bad Request` ("changed concurrently"). Dokumen wajib yang kurang menghasilkan `400` dengan daftar jenisnya, misalnya `Missing required documents: SIGNED_QS, CN_DN`.

## 5. Notifikasi

Dikirim setelah transaksi selesai. Kegagalan notifikasi dicatat di log aplikasi dan tidak membatalkan submit atau return.

| Kejadian | Penerima | `type` | `dedupeKey` |
| --- | --- | --- | --- |
| Submit | Semua pengguna dengan `request-invoice:review` (termasuk unit anak dan SUPERADMIN) | `RFI_SUBMITTED` | `RFI_SUBMITTED:{id}:{submittedAt ISO}:{recipientId}` |
| Return | Pengaju (`submittedById`) | `RFI_RETURNED` | `RFI_RETURNED:{id}:{reviewId}:{recipientId}` |

`referenceType = REQUEST_FOR_INVOICE`, `referenceId` = ID RFI. Submit ulang setelah return menghasilkan notifikasi baru karena `submittedAt` berbeda.

## 6. Log

Buat, ubah, upload atau hapus dokumen, submit, approve, return, dan hapus dicatat di tabel `log` dengan `referenceType = REQUEST_FOR_INVOICE`. RFI tidak ditemukan atau sudah dihapus: `404 Not Found`.
