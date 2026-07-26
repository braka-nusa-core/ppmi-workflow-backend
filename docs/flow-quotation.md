# Flow Quotation

Dokumentasi alur lengkap pembuatan quotation dari awal hingga polis terbit — mencakup relasi Client, Insurance Type, child entities, status engine, approval, dan history.

---

## 1. Relasi Data

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                                                                   │
│  ┌─────────────────────────┐      ┌────────────────────────────────────────────┐  │
│  │         CLIENT          │      │              INSURANCE TYPE                │  │
│  │  ─────────────────────  │      │  ────────────────────────────────────────  │  │
│  │  name (nama perusahaan)  │      │  code (HM / PI / CARGO / OEE / ...)       │  │
│  │  clientCode (CLT-...)   │      │  name (Hull & Machinery / ...)             │  │
│  │  phone, email, address  │      │  description                               │  │
│  │  contactPerson          │      │                                            │  │
│  └───────────┬─────────────┘      └──────────────────┬─────────────────────────┘  │
│              │                                       │                             │
│              └──────────────┬────────────────────────┘                             │
│                             │                                                      │
│                             ▼                                                      │
│              ┌──────────────────────────────────────────────┐                      │
│              │                 QUOTATION                    │                      │
│              │  ──────────────────────────────────────────  │                      │
│              │  quotationNumber : QTN-YYYYMMDD-XXX          │                      │
│              │  status          : lihat Status Engine       │                      │
│              │  insured, periodStart, periodEnd             │                      │
│              │  interest, rate, premium, deductible         │                      │
│              │  brokerage, templateVersion                  │                      │
│              │                                              │                      │
│              │  ┌──────────────┐  ┌─────────────────┐      │                      │
│              │  │   Objects    │  │   Coverages     │      │                      │
│              │  │ (objek       │  │ (cover nilai    │      │                      │
│              │  │  pertanggun- │  │  pertanggungan) │      │                      │
│              │  │  gan)        │  └─────────────────┘      │                      │
│              │  └──────────────┘                           │                      │
│              │  ┌──────────────┐  ┌─────────────────┐      │                      │
│              │  │    Terms     │  │   Warranties    │      │                      │
│              │  │ (syarat &    │  │ (jaminan/       │      │                      │
│              │  │  ketentuan)  │  │  klausula)      │      │                      │
│              │  └──────────────┘  └─────────────────┘      │                      │
│              │  ┌──────────────┐  ┌─────────────────┐      │                      │
│              │  │  Attachments │  │    History      │      │                      │
│              │  │ (lampiran    │  │ (riwayat status)│      │                      │
│              │  │  file)       │  └─────────────────┘      │                      │
│              │  └──────────────┘                           │                      │
│              │  ┌─────────────────┐                        │                      │
│              │  │   Approvals     │                        │                      │
│              │  │ (catatan approve│                        │                      │
│              │  │  / reject /     │                        │                      │
│              │  │  revision)      │                        │                      │
│              │  └─────────────────┘                        │                      │
│              └──────────────────────────────────────────────┘                      │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Alur Pembuatan Quotation

### 2.1 Ringkasan

```
                ┌── Pakai client yang sudah ada ──▶ clientId
Pilih Client ───┤
                └── Buat client baru bareng QS ──▶ client { name, address, ... }

Pilih Insurance Type ──────────────────────────────▶ insuranceTypeId

                       ▼
              Buat Quotation (DRAFT)
                       │
              ┌────────┴──────────┐
              │                   │
         Isi Child Data      Langsung Submit
              │              (jika data sudah
     ┌────────┴────────┐     siap)
     │                 │
  Objects, Coverages,  │
  Terms, Warranties,   │
  Attachments          │
     │                 │
     └────────┬────────┘
              │
              ▼
      Masuk Status Engine
```

### 2.2 Step-by-Step

**Step 1 — Pilih Client**

Quotation harus mengacu pada satu **Client**. Ada 2 cara:

| Opsi | Cara | Kapan dipakai |
|------|------|---------------|
| **A** | `clientId: "clx...abc"` (referensi client existing) | Client sudah terdaftar |
| **B** | `client: { name, address, phone, email, contactPerson }` (inline) | Client baru, buat bersamaan dengan quotation |

> Kedua opsi bersifat **mutual exclusive** — salah satu wajib, tidak boleh keduanya.

**Step 2 — Pilih Insurance Type**

Quotation harus mengacu pada satu **Insurance Type** yang sudah terdaftar. Dipilih berdasarkan `_id` dari `GET /insurance-types`.

**Step 3 — Buat Quotation**

```http
POST /quotations
Authorization: Bearer <token>
Content-Type: application/json

{
  "clientId": "clx...client1",
  "insuranceTypeId": "clx...hm",
  "insured": "PT Pelayaran Nusantara",
  "rate": 0.0025,
  "premium": 125000000
}
```

Atau dengan inline client:

```http
POST /quotations
Authorization: Bearer <token>
Content-Type: application/json

{
  "client": {
    "name": "PT Pelayaran Nusantara",
    "address": "Jl. Pelabuhan No. 1",
    "phone": "021-87654321",
    "email": "info@pelayaran.com",
    "contactPerson": "Agus Wijaya"
  },
  "insuranceTypeId": "clx...hm",
  "insured": "PT Pelayaran Nusantara",
  "rate": 0.0025,
  "premium": 125000000
}
```

Sistem otomatis:
- Generate `quotationNumber` → `QTN-YYYYMMDD-XXX`
- Set `status` → `DRAFT`
- Catat **QuotationHistory** → action `CREATE`
- Jika pakai inline client, client baru dibuat dalam 1 transaksi + dicatat di Log

---

## 3. Status Engine

### 3.1 Diagram Transisi

```
                        ┌─────────────────┐
                        │     DRAFT       │ ◀──────────────────┐
                        │ (status awal)   │                    │
                        └────────┬────────┘                    │
                                 │                             │
                        submit   │                    reject / │
                                 │              request-      │
                                 ▼              revision       │
                        ┌─────────────────┐                    │
                        │ WAITING_APPROVAL │────────────────────┘
                        └────────┬────────┘
                                 │
                        approve  │
                                 ▼
                        ┌─────────────────┐
                        │    APPROVED     │
                        └────────┬────────┘
                                 │
                        send-to- │
                        insurance│
                                 ▼
                        ┌─────────────────┐
                        │SENT_TO_INSURANCE │
                        └───────┬─────────┘
                           ┌────┴────┐
                           │         │
                           ▼         ▼
                  ┌────────────┐  ┌────────────┐
                  │ POLICY     │  │  REVISION  │
                  │ _ISSUED    │  └──────┬─────┘
                  │ (terminal) │         │
                  └────────────┘         │ send-to-insurance
                                         ▼
                                ┌─────────────────┐
                                │SENT_TO_INSURANCE │
                                └─────────────────┘
```

### 3.2 Tabel Transisi

| Dari | Aksi | Ke | Dilakukan oleh |
|------|------|----|----------------|
| `DRAFT` | submit | `WAITING_APPROVAL` | Staff |
| `WAITING_APPROVAL` | approve | `APPROVED` | Approver |
| `WAITING_APPROVAL` | reject | `DRAFT` | Approver |
| `WAITING_APPROVAL` | request-revision | `DRAFT` | Approver |
| `APPROVED` | send-to-insurance | `SENT_TO_INSURANCE` | Staff |
| `SENT_TO_INSURANCE` | insurance-approve | `POLICY_ISSUED` | Insurance |
| `SENT_TO_INSURANCE` | insurance-revision | `REVISION` | Insurance |
| `REVISION` | send-to-insurance | `SENT_TO_INSURANCE` | Staff |

### 3.3 Aturan Penting

| Aturan | Detail |
|--------|--------|
| **UPDATE** data | Hanya saat `DRAFT` atau `REVISION` |
| **DELETE** (soft) | Hanya saat `DRAFT` |
| **POLICY_ISSUED** | Terminal — tidak ada transisi keluar |
| **Child data** | Bisa diubah selama `DRAFT` atau `REVISION` |
| **History** | Setiap transisi mencatat 1 baris di `QuotationHistory` |
| **Approval** | approve / reject / request-revision juga catat 1 baris di `QuotationApproval` |

---

## 4. Alur Pengisian Child Data

### 4.1 Kapan bisa diisi?

```
Fase DRAFT ──┬── Buat/Edit Objects        ──▶ POST   /quotations/:id/objects
             ├── Buat/Edit Coverages      ──▶ POST   /quotations/:id/coverages
             ├── Buat/Edit Terms          ──▶ POST   /quotations/:id/terms
             ├── Buat/Edit Warranties     ──▶ POST   /quotations/:id/warranties
             ├── Upload Attachments       ──▶ POST   /quotations/:id/attachments (multipart)
             │
             └── Submit ──▶ WAITING_APPROVAL

Fase REVISION ──┬── Edit data yang perlu diperbaiki
                │
                └── Send To Insurance lagi ──▶ SENT_TO_INSURANCE
```

### 4.2 Upload Attachment

Attachment di-upload sebagai **file** (multipart/form-data), bukan JSON.

| Field | Type | Max | Keterangan |
|-------|------|-----|------------|
| `file` | binary | **50 MB** | format: PDF, gambar, DOCX, XLSX, PPTX, DOC, XLS, PPT |

Proses upload:
1. File diterima → validasi MIME + size → upload ke S3
2. Key S3: `quotations/{quotationId}/{uuid}.{ext}`
3. Record disimpan di DB: `fileName`, `url`, `mimeType`, `fileSize`

### 4.3 Contoh Skenario

```
Langkah   Aksi                          Status              Catatan
───────   ────────────────────────────  ─────────────────── ─────────────────────
   1      Buat quotation                DRAFT               clientId / inline client
   2      Tambah 1 object               DRAFT               POST .../objects
   3      Tambah 2 coverages            DRAFT               POST .../coverages
   4      Tambah 3 terms                DRAFT               POST .../terms
   5      Upload 1 attachment           DRAFT               POST .../attachments (file)
   6      Submit                        WAITING_APPROVAL
   7      Approver minta revisi         DRAFT
   8      Edit 1 term                   DRAFT
   9      Submit lagi                   WAITING_APPROVAL
  10      Approve                       APPROVED
  11      Send to insurance             SENT_TO_INSURANCE
  12      Insurance approve             POLICY_ISSUED       Selesai
```

---

## 5. Alur Approval

### 5.1 Diagram

```
  ┌─────────────────────────────────────────────────────────┐
  │                   WAITING_APPROVAL                       │
  └──────────────────────┬──────────────────────────────────┘
                         │
           ┌─────────────┼─────────────┐
           ▼             ▼             ▼
  ┌────────────────┐ ┌────────────┐ ┌────────────────┐
  │    APPROVE     │ │   REJECT   │ │ REQUEST        │
  │                │ │            │ │ REVISION       │
  ├────────────────┤ ├────────────┤ ├────────────────┤
  │ status         │ │ status     │ │ status         │
  │  → APPROVED    │ │  → DRAFT   │ │  → DRAFT       │
  │                │ │            │ │                │
  │ ✅ Quotation   │ │ ✅ Quot.   │ │ ✅ Quot.       │
  │    History     │ │    History │ │    History     │
  │    (APPROVE)   │ │    (REJECT)│ │    (REVISION   │
  │                │ │            │ │     _REQUEST)   │
  │ ✅ Quotation   │ │ ✅ Quot.   │ │ ✅ Quot.       │
  │    Approval    │ │    Approval│ │    Approval    │
  │    (APPROVED)  │ │    (REJEC- │ │    (REVISION)  │
  │                │ │    TED)    │ │                │
  │ ✅ approvedBy  │ │            │ │                │
  │ ✅ approvedAt  │ │            │ │                │
  └────────────────┘ └────────────┘ └────────────────┘
```

### 5.2 Catatan Approval

Setiap aksi approval (approve/reject/request-revision) menghasilkan:

```json
{
  "_id": "clx...appr1",
  "action": "APPROVED",       // APPROVED | REJECTED | REVISION
  "note": "Disetujui, lanjut ke underwriting",
  "createdAt": "2025-07-25T11:00:00.000Z"
}
```

---

## 6. Alur Lengkap End-to-End

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                              │
│  TIMELINE                                                                                    │
│  ────────                                                                                    │
│                                                                                              │
│  STAFF                              APPROVER                          INSURANCE               │
│  ─────                              ───────                          ─────────               │
│                                                                                              │
│  ┌─ Pilih Client ──────────────────────────────┐                                             │
│  │  ● existing → clientId                      │                                             │
│  │  ● baru     → client { name, ... }          │                                             │
│  └──────────────────────────────────────────────┘                                             │
│         │                                                                                    │
│  ┌──────▼───────┐                                                                           │
│  │  QUOTATION   │  quotationNumber: QTN-..., status: DRAFT                                  │
│  │  DIBUAT      │  History: CREATE                                                          │
│  └──────┬───────┘                                                                           │
│         │                                                                                    │
│  ┌──────▼───────┐                                                                           │
│  │  ISI CHILD   │  Objects / Coverages / Terms / Warranties / Attachments                   │
│  │  DATA        │                                                                           │
│  └──────┬───────┘                                                                           │
│         │                                                                                    │
│         ▼  SUBMIT (note: "...")                                                             │
│  ┌──────────────┐                                                                            │
│  │WAITING       │────────────────────────────────────────────────▶                          │
│  │_APPROVAL     │                                                                           │
│  └──────────────┘                                                                            │
│                                                                        ┌──────────────────┐  │
│                                                      ◀────────────────│  APPROVE /       │  │
│                                                                       │  REJECT /        │  │
│                                                                       │  REQUEST REVISION│  │
│                                                                       └──────────────────┘  │
│         │                                                                                    │
│         │  Jika REJECT / REVISION:                                                           │
│         ▼  Edit data → SUBMIT lagi ──────────────────────────────▶                         │
│                                                                                             │
│                                                ┌──────────────┐                            │
│                                                │  APPROVED    │                            │
│                                                └──────────────┘                            │
│         │                                                                                    │
│         ▼  SEND TO INSURANCE (note: "...")                                                  │
│  ┌──────────────────┐                                                                       │
│  │ SENT_TO_INSURANCE│────────────────────────────────────────────────────────────────────▶  │
│  └──────────────────┘                                                                       │
│                                                                                             │
│                                                                        ┌──────────────────┐  │
│                                                                        │  INSURANCE       │  │
│                                                                        │  APPROVE /       │  │
│                                                                        │  REVISION        │  │
│                                                                        └──────────────────┘  │
│                                                                                             │
│         │  Jika REVISION:                                                                    │
│         ▼  Edit data → SEND TO INSURANCE lagi ─────────────────────▶                       │
│                                                                                             │
│                                                                        ┌──────────────────┐  │
│                                                                        │  POLICY_ISSUED   │  │
│                                                                        │  ★ SELESAI ★     │  │
│                                                                        └──────────────────┘  │
│                                                                                             │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. History & Audit Trail

Setiap perubahan pada quotation tercatat otomatis.

### 7.1 Contoh History Lengkap (11 event)

```
┌──────┬─────────────────────┬─────────────────────┬───────────────────┬────────────────────┐
│  #   │  Waktu              │  Aksi               │  Dari             │  Ke                │
├──────┼─────────────────────┼─────────────────────┼───────────────────┼────────────────────┤
│  1   │  2025-07-25 08:30   │  CREATE             │  -                │  DRAFT             │
│  2   │  2025-07-25 09:00   │  UPDATE             │  DRAFT            │  DRAFT             │
│  3   │  2025-07-25 09:15   │  CREATE_OBJECT      │  DRAFT            │  DRAFT             │
│  4   │  2025-07-25 09:20   │  CREATE_COVERAGE    │  DRAFT            │  DRAFT             │
│  5   │  2025-07-25 10:00   │  SUBMIT             │  DRAFT            │  WAITING_APPROVAL  │
│  6   │  2025-07-25 11:00   │  APPROVE            │  WAITING_APPROVAL │  APPROVED          │
│  7   │  2025-07-25 11:30   │  SEND_TO_INSURANCE  │  APPROVED         │  SENT_TO_INSURANCE │
│  8   │  2025-07-25 14:00   │  INSURANCE_REVISION │  SENT_TO_INSURANCE│  REVISION          │
│  9   │  2025-07-26 08:00   │  UPDATE             │  REVISION         │  REVISION          │
│ 10   │  2025-07-26 08:30   │  SEND_TO_INSURANCE  │  REVISION         │  SENT_TO_INSURANCE │
│ 11   │  2025-07-26 10:00   │  INSURANCE_APPROVE  │  SENT_TO_INSURANCE│  POLICY_ISSUED     │
└──────┴─────────────────────┴─────────────────────┴───────────────────┴────────────────────┘
```

### 7.2 Approval Records

| Event # | Action | Note |
|---------|--------|------|
| 6 | `APPROVED` | Disetujui, lanjut ke underwriting |
| 8 | `REVISION` | Data kurang lengkap, mohon revisi |
| 11 | `APPROVED` | Polis diterbitkan |

---

## 8. Contoh HTTP Request

### Buat Quotation — dengan client existing

```http
POST /quotations
Authorization: Bearer <token>
Content-Type: application/json

{
  "clientId": "clx...client1",
  "insuranceTypeId": "clx...hm",
  "insured": "PT Pelayaran Nusantara",
  "address": "Jl. Pelabuhan No. 1",
  "quotationDate": "2025-07-25",
  "periodStart": "2025-08-01",
  "periodEnd": "2026-07-31",
  "interest": "Hull & Machinery",
  "rate": 0.0025,
  "premium": 125000000,
  "deductible": 5000000,
  "brokerage": 0.01
}
```

### Buat Quotation — dengan inline client

```http
POST /quotations
Authorization: Bearer <token>
Content-Type: application/json

{
  "client": {
    "name": "PT Pelayaran Nusantara",
    "address": "Jl. Pelabuhan No. 1",
    "phone": "021-87654321",
    "email": "info@pelayaran.com",
    "contactPerson": "Agus Wijaya"
  },
  "insuranceTypeId": "clx...hm",
  "insured": "PT Pelayaran Nusantara",
  "rate": 0.0025,
  "premium": 125000000
}
```

### Upload Attachment

```http
POST /quotations/clx...qtn1/attachments
Authorization: Bearer <token>
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="file"; filename="polis-capai.pdf"
Content-Type: application/pdf

<binary data>
--boundary--
```

### Tambah Object

```http
POST /quotations/clx...qtn1/objects
Authorization: Bearer <token>
Content-Type: application/json

{
  "objectType": "Vessel",
  "data": {
    "name": "MV Nusantara",
    "type": "Cargo Ship",
    "year": 2020,
    "gt": 5000,
    "flag": "Indonesia"
  }
}
```

### Tambah Coverage

```http
POST /quotations/clx...qtn1/coverages
Authorization: Bearer <token>
Content-Type: application/json

{
  "coverageType": "Hull",
  "description": "Hull & Machinery including machinery damage",
  "value": 50000000000
}
```

### Tambah Term

```http
POST /quotations/clx...qtn1/terms
Authorization: Bearer <token>
Content-Type: application/json

{
  "description": "War risk excluded"
}
```

### Tambah Warranty

```http
POST /quotations/clx...qtn1/warranties
Authorization: Bearer <token>
Content-Type: application/json

{
  "description": "ISPS Code compliance warranty"
}
```

### Submit

```http
POST /quotations/clx...qtn1/submit
Authorization: Bearer <token>
Content-Type: application/json

{
  "note": "Data sudah lengkap, mohon approval"
}
```

### Approve

```http
POST /quotations/clx...qtn1/approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "note": "Disetujui"
}
```

### Reject

```http
POST /quotations/clx...qtn1/reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "note": "Premium terlalu tinggi, minta negosiasi ulang"
}
```

### Request Revision

```http
POST /quotations/clx...qtn1/request-revision
Authorization: Bearer <token>
Content-Type: application/json

{
  "note": "Data objek kurang lengkap"
}
```

### Send to Insurance

```http
POST /quotations/clx...qtn1/send-to-insurance
Authorization: Bearer <token>
Content-Type: application/json

{
  "note": "Dikirim ke underwriting PT Asuransi ABC"
}
```

### Insurance Approve

```http
POST /quotations/clx...qtn1/insurance-approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "note": "Polis diterbitkan"
}
```

### Insurance Revision

```http
POST /quotations/clx...qtn1/insurance-revision
Authorization: Bearer <token>
Content-Type: application/json

{
  "note": "Mohon tambah data survey"
}
```

### Cek Histori

```http
GET /quotations/clx...qtn1/history
Authorization: Bearer <token>
```

### Cek Approval

```http
GET /quotations/clx...qtn1/approvals
Authorization: Bearer <token>
```

---

## 9. Ringkasan Endpoint

### Main Quotation (16)

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| `GET` | `/quotations` | List semua |
| `GET` | `/quotations/:id` | Detail |
| `POST` | `/quotations` | Buat baru |
| `PATCH` | `/quotations/:id` | Edit (DRAFT/REVISION) |
| `DELETE` | `/quotations/:id` | Soft delete (DRAFT) |
| `POST` | `/quotations/:id/submit` | DRAFT → WAITING_APPROVAL |
| `POST` | `/quotations/:id/approve` | WAITING_APPROVAL → APPROVED |
| `POST` | `/quotations/:id/reject` | WAITING_APPROVAL → DRAFT |
| `POST` | `/quotations/:id/request-revision` | WAITING_APPROVAL → DRAFT |
| `POST` | `/quotations/:id/send-to-insurance` | APPROVED/REVISION → SENT_TO_INSURANCE |
| `POST` | `/quotations/:id/insurance-approve` | SENT_TO_INSURANCE → POLICY_ISSUED |
| `POST` | `/quotations/:id/insurance-revision` | SENT_TO_INSURANCE → REVISION |
| `GET` | `/quotations/:id/approvals` | History approval |
| `GET` | `/quotations/:id/history` | History status |
| `GET` | `/quotations/:id/export-pdf` | Export PDF (placeholder) |

### Child Quotation (24)

| Resource | Endpoints | Method |
|----------|-----------|--------|
| Objects | `/quotations/:id/objects` | GET list, GET:id, POST, PATCH, DELETE |
| Coverages | `/quotations/:id/coverages` | GET list, GET:id, POST, PATCH, DELETE |
| Terms | `/quotations/:id/terms` | GET list, GET:id, POST, PATCH, DELETE |
| Warranties | `/quotations/:id/warranties` | GET list, GET:id, POST, PATCH, DELETE |
| Attachments | `/quotations/:id/attachments` | GET list, GET:id, POST (file), DELETE |

---

**Total: 40 endpoint** untuk seluruh modul Quotation.
