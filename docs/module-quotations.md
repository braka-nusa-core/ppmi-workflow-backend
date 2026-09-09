# Quotations Module

Referensi API untuk Quotation Slip (QS). Aturan bisnis, state-machine diagram, dan urutan canonical workflow ada di `docs/flow-quotation.md`, dengan `flow-v2.md` sebagai baseline utama. Bila terdapat perbedaan, `flow-v2.md` berlaku.

## Scope Module

Module ini menangani QS dari pembuatan sampai keputusan review insurance dicatat sebagai `INSURANCE_APPROVED`. Penerbitan policy number, placement, Insurance Voucher, RFI, Finance, dan Shipment berada di module berikutnya.

## Permission

| Permission | Akses |
| --- | --- |
| `quotation:read` | Membaca QS, child data, approval, history, submission, dan review. |
| `quotation:create` | Membuat QS baru. |
| `quotation:update` | Mengubah root QS dan child data yang masih editable. |
| `quotation:submit` | Submit QS untuk approval Supervisor Teknik. |
| `quotation:approve` | Approve, reject, atau request revision internal. |
| `quotation:send-to-insurance` | Mengirim QS approved ke perusahaan asuransi. |
| `quotation:record-insurer-review` | Mencatat keputusan insurer. |
| `quotation:export` | Export QS approved. |

Selain permission, service memvalidasi ownership unit Teknik dan memastikan approval dilakukan oleh department Supervisor Teknik di bawah division Teknik.

## Main Endpoints

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `GET` | `/quotations` | `quotation:read` | List QS aktif. |
| `GET` | `/quotations/:id` | `quotation:read` | Detail QS beserta child data, approval, history, submission, dan review. |
| `POST` | `/quotations` | `quotation:create` | Membuat QS `DRAFT`. |
| `PATCH` | `/quotations/:id` | `quotation:update` | Mengubah QS `DRAFT` atau `REVISION`. |
| `DELETE` | `/quotations/:id` | `quotation:update` | Soft delete QS `DRAFT`. |
| `POST` | `/quotations/:id/submit` | `quotation:submit` | Submit atau resubmit untuk approval Supervisor Teknik. |
| `POST` | `/quotations/:id/approve` | `quotation:approve` | `WAITING_APPROVAL -> APPROVED`. |
| `POST` | `/quotations/:id/reject` | `quotation:approve` | `WAITING_APPROVAL -> DRAFT`. |
| `POST` | `/quotations/:id/request-revision` | `quotation:approve` | `WAITING_APPROVAL -> DRAFT`. |
| `POST` | `/quotations/:id/send-to-insurance` | `quotation:send-to-insurance` | `APPROVED -> SENT_TO_INSURANCE`. |
| `POST` | `/quotations/:id/insurance-approve` | `quotation:record-insurer-review` | `SENT_TO_INSURANCE -> INSURANCE_APPROVED`. |
| `POST` | `/quotations/:id/insurance-revision` | `quotation:record-insurer-review` | `SENT_TO_INSURANCE -> REVISION`. |
| `GET` | `/quotations/:id/approvals` | `quotation:read` | Riwayat keputusan Supervisor Teknik. |
| `GET` | `/quotations/:id/history` | `quotation:read` | Riwayat transition status QS. |
| `GET` | `/quotations/:id/export-pdf` | `quotation:export` | Export QS `APPROVED`; generator PDF masih placeholder. |

## Create QS

`POST /quotations` membuat QS `DRAFT` untuk department Teknik actor. Actor harus terdaftar pada department H&M, P&I, atau Cargo di bawah division Teknik.

```json
{
  "clientId": "clx...client",
  "insuranceTypeId": "clx...insurance-type",
  "insured": "PT Pelayaran Nusantara",
  "address": "Jl. Pelabuhan No. 1",
  "quotationDate": "2026-09-09",
  "periodStart": "2026-10-01",
  "periodEnd": "2027-09-30",
  "interest": "Hull & Machinery",
  "rate": 0.0025,
  "premium": 125000000,
  "deductible": 5000000,
  "brokerage": 0.01,
  "templateVersion": "v1"
}
```

Sebagai alternatif `clientId`, request dapat menyediakan `client` untuk membuat client inline:

```json
{
  "client": {
    "name": "PT Pelayaran Nusantara",
    "address": "Jl. Pelabuhan No. 1",
    "phone": "021-87654321",
    "email": "info@pelayaran.com",
    "contactPerson": "Agus Wijaya"
  },
  "insuranceTypeId": "clx...insurance-type"
}
```

`clientId` dan `client` saling eksklusif. Client dan insurance type yang soft-deleted ditolak.

## Workflow Request Bodies

Seluruh action selain send menerima note opsional:

```json
{
  "note": "Catatan proses"
}
```

Pengiriman ke insurer wajib menyertakan perusahaan penerima:

```json
{
  "insuranceCompanyId": "clx...insurance-company",
  "note": "Dikirim ke underwriting"
}
```

Endpoint send membuat `QuotationSubmission` dengan snapshot QS immutable dan mengembalikan `submissionId` selain ID dan status QS.

Endpoint insurance approval dan revision mencatat `InsuranceReview` pada submission pending terakhir. Insurance approval tidak menerbitkan Policy dan tidak mengubah QS ke `POLICY_ISSUED`.

## Child Endpoints

| Resource | Base Path | Mutasi |
| --- | --- | --- |
| Objects | `/quotations/:quotationId/objects` | `GET`, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id` |
| Coverages | `/quotations/:quotationId/coverages` | `GET`, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id` |
| Terms | `/quotations/:quotationId/terms` | `GET`, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id` |
| Warranties | `/quotations/:quotationId/warranties` | `GET`, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id` |
| Attachments | `/quotations/:quotationId/attachments` | `GET`, `GET /:id`, `POST`, `DELETE /:id` |

Semua child mutation membutuhkan `quotation:update`, hanya diperbolehkan pada QS `DRAFT` atau `REVISION`, dan hanya untuk unit Teknik pemilik QS. Mutasi attachment menggunakan `multipart/form-data` dengan field `file`.

## Status dan Data Rules

- `DRAFT` dan `REVISION` adalah satu-satunya status yang editable.
- QS `APPROVED`, `SENT_TO_INSURANCE`, dan `INSURANCE_APPROVED` tidak dapat diubah melalui root maupun child endpoint.
- Revisi insurer harus memiliki perubahan QS sebelum `POST /submit` dapat dipanggil.
- Revisi insurer sementara ini wajib approval ulang Supervisor Teknik sebelum dikirim ulang.
- `INSURANCE_APPROVED` menunggu handoff module Policy untuk menerbitkan policy number dan policy document.
- Detail transition dan diagram tersedia di `docs/flow-quotation.md`.

## Audit Response

`GET /quotations/:id` mengembalikan relasi berikut selain data utama QS:

- `approvals` dengan approver Supervisor Teknik.
- `histories` dengan actor transition.
- `submissions` dengan perusahaan asuransi, pengirim, waktu kirim, dan daftar `reviews`.

Snapshot internal pada `QuotationSubmission` tidak diekspos melalui detail QS. Snapshot tersebut dipakai untuk membuktikan isi QS yang dikirim ke insurer.

## Error Umum

| Status | Kondisi |
| --- | --- |
| `400` | Request tidak valid, status transition tidak valid, QS belum diedit setelah insurer revision, master data tidak aktif, atau request kalah oleh perubahan paralel. |
| `403` | Permission tidak ada, actor bukan Supervisor Teknik untuk approval, atau unit actor bukan pemilik QS. |
| `404` | QS atau child resource tidak ditemukan. |

Perubahan paralel saat ini memakai exception validation. Standardisasi ke `409 Conflict` dapat dilakukan bersama kontrak API global.
