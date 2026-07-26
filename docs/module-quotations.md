# Quotations Module

Dokumentasi lengkap modul **Quotations** untuk frontend — manajemen quotation slip dari pembuatan hingga penerbitan polis, dengan status engine, approval flow, dan 5 child module terintegrasi.

---

## 1. Konsep

### 1.1 Quotation Number

Setiap quotation memiliki **nomor unik** yang digenerate otomatis dengan format:

```
QTN-YYYYMMDD-XXX
```

**Contoh:** `QTN-20260725-001`, `QTN-20260725-002`

- `QTN` — prefix tetap (QUOTATION)
- `YYYYMMDD` — tanggal pembuatan
- `XXX` — nomor urut 3 digit (reset setiap hari)

### 1.2 Relasi Utama

Quotation menghubungkan **Client** (nasabah) dengan **Insurance Type** (jenis asuransi):

```
Client (existing atau inline) ──┐
                                ├──→ Quotation ──→ Insurance Type
                                │
                                ├── Quotation Objects (objek pertanggungan)
                                ├── Quotation Coverages (cover yang diberikan)
                                ├── Quotation Terms (syarat & ketentuan)
                                ├── Quotation Warranties (warranties)
                                └── Quotation Attachments (lampiran)
```

Selain itu, quotation memiliki:

- **Quotation History** — riwayat perubahan status
- **Quotation Approval** — catatan approval/rejection

### 1.3 Status Engine

Quotation memiliki **6 status** dengan aturan transisi yang ketat:

```
                         submit
     ┌────────────────── DRAFT ───────────────────┐
     │                                            │
     │  reject / request-revision                 │
     │                                            ▼
     │                                   WAITING_APPROVAL
     │                                            │
     │                              approve       │
     │                                            ▼
     │                                       APPROVED
     │                                            │
     │                              send-to-insurance
     │                                            ▼
     │                                   SENT_TO_INSURANCE
     │                                      │         │
     │                          insurance-approve   insurance-revision
     │                                      │         │
     │                                      ▼         ▼
     │                               POLICY_ISSUED  REVISION
     │                                   (terminal)   │
     │                                                │
     └────────── send-to-insurance ───────────────────┘
```

**Matrix Transisi:**

| Current Status      | Can Transition To   | Action             | Creator   |
| ------------------- | ------------------- | ------------------ | --------- |
| `DRAFT`             | `WAITING_APPROVAL`  | Submit             | User      |
| `WAITING_APPROVAL`  | `APPROVED`          | Approve            | Approver  |
| `WAITING_APPROVAL`  | `DRAFT`             | Reject             | Approver  |
| `WAITING_APPROVAL`  | `DRAFT`             | Request Revision   | Approver  |
| `APPROVED`          | `SENT_TO_INSURANCE` | Send to Insurance  | User      |
| `SENT_TO_INSURANCE` | `POLICY_ISSUED`     | Insurance Approve  | Insurance |
| `SENT_TO_INSURANCE` | `REVISION`          | Insurance Revision | Insurance |
| `REVISION`          | `SENT_TO_INSURANCE` | Send to Insurance  | User      |
| `POLICY_ISSUED`     | _(terminal)_        | —                  | —         |

**Aturan Bisnis:**

- `UPDATE` hanya bisa dilakukan saat status `DRAFT` atau `REVISION`
- `DELETE` (soft delete) hanya bisa dilakukan saat status `DRAFT`
- `POLICY_ISSUED` adalah status terminal — tidak ada transisi keluar

### 1.4 Approval & History

Setiap perubahan status dicatat secara otomatis:

**QuotationHistory** — mencatat semua perubahan status:

- `fromStatus` — status sebelum perubahan (nullable untuk CREATE)
- `toStatus` — status setelah perubahan
- `action` — label aksi (`CREATE`, `SUBMIT`, `APPROVE`, `REJECT`, dll)
- `actorId` — user yang melakukan aksi
- `note` — catatan opsional

**QuotationApproval** — mencatat approval/rejection:

- Dibuat ketika status berubah karena aksi approve/reject/revision
- `action`: `APPROVED`, `REJECTED`, atau `REVISION`
- `note`: catatan dari approver

---

## 2. Main Quotation Endpoints

Semua endpoint membutuhkan **autentikasi JWT** via header `Authorization: Bearer <token>`.

### 2.1 `GET /quotations` — List All Quotations

Mengembalikan daftar semua quotation aktif.

**Permission:** `quotation:read`

**Response 200 — Success:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "clx...qtn1",
      "quotationNumber": "QTN-20260725-001",
      "client": {
        "_id": "clx...client1",
        "name": "PT Pelayaran Nusantara",
        "clientCode": "CLT-20260725-001"
      },
      "insuranceType": {
        "_id": "clx...hm",
        "code": "HM",
        "name": "Hull & Machinery"
      },
      "status": "DRAFT",
      "createdAt": "2025-07-25T08:30:00.000Z",
      "updatedAt": "2025-07-25T08:30:00.000Z"
    }
  ]
}
```

**Response Fields (tiap item dalam `data[]`):**

| Field             | Type                | Description                                        |
| ----------------- | ------------------- | -------------------------------------------------- |
| `_id`             | `string`            | Unique identifier quotation (cuid)                 |
| `quotationNumber` | `string`            | Auto-generated number                              |
| `client`          | `object`            | Data client (_id, name, clientCode)                 |
| `insuranceType`   | `object`            | Data jenis asuransi (_id, code, name)               |
| `status`          | `string`            | Status saat ini (`DRAFT`, `WAITING_APPROVAL`, dll) |
| `createdAt`       | `string` (ISO 8601) | Timestamp dibuat                                   |
| `updatedAt`       | `string` (ISO 8601) | Timestamp terakhir diupdate                        |

---

### 2.2 `GET /quotations/:id` — Get Quotation Detail

Mengembalikan detail lengkap quotation termasuk seluruh child data.

**Permission:** `quotation:read`

**Path Parameters:**

| Parameter | Type     | Required | Description         |
| --------- | -------- | -------- | ------------------- |
| `id`      | `string` | ✅       | ID quotation (cuid) |

**Response 200 — Success:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...qtn1",
    "quotationNumber": "QTN-20260725-001",
    "client": { ... },
    "insuranceType": { ... },
    "insured": "PT Pelayaran Nusantara",
    "address": "Jl. Pelabuhan No. 1",
    "quotationDate": "2025-07-25T00:00:00.000Z",
    "periodStart": "2025-08-01T00:00:00.000Z",
    "periodEnd": "2026-07-31T00:00:00.000Z",
    "interest": "Hull & Machinery",
    "rate": 0.0025,
    "premium": 125000000,
    "deductible": 5000000,
    "brokerage": 0.01,
    "status": "DRAFT",
    "objects": [ ... ],
    "coverages": [ ... ],
    "terms": [ ... ],
    "warranties": [ ... ],
    "attachments": [ ... ],
    "approvals": [ ... ],
    "histories": [ ... ],
    "createdAt": "2025-07-25T08:30:00.000Z",
    "updatedAt": "2025-07-25T08:30:00.000Z"
  }
}
```

---

### 2.3 `POST /quotations` — Create Quotation

Membuat quotation baru dengan status **DRAFT**. `quotationNumber` digenerate otomatis.

**Permission:** `quotation:create`

**Request Body (JSON):**

| Field             | Type                      | Required                     | Description                      |
| ----------------- | ------------------------- | ---------------------------- | -------------------------------- |
| `clientId`        | `string`                  | ✅ (jika `client` tidak ada)  | ID client yang sudah ada         |
| `client`          | `object`                  | ✅ (jika `clientId` tidak ada)| Buat client baru secara inline   |
| `insuranceTypeId` | `string`                  | ✅                            | ID jenis asuransi                |
| `insured`         | `string`                  | ❌                            | Nama tertanggung                 |
| `address`         | `string`                  | ❌                            | Alamat objek pertanggungan       |
| `quotationDate`   | `string`                  | ❌                            | Tanggal quotation (ISO date)     |
| `periodStart`     | `string`                  | ❌                            | Awal periode pertanggungan       |
| `periodEnd`       | `string`                  | ❌                            | Akhir periode pertanggungan      |
| `interest`        | `string`                  | ❌                            | Interest / obyek pertanggungan   |
| `rate`            | `number`                  | ❌                            | Rate premi                       |
| `premium`         | `number`                  | ❌                            | Premi                            |
| `deductible`      | `number`                  | ❌                            | Deductible                       |
| `brokerage`       | `number`                  | ❌                            | Brokerage fee                    |
| `templateVersion` | `string`                  | ❌                            | Versi template                   |

**Field `client` (inline create):**

| Field           | Type     | Required | Description               |
| --------------- | -------- | -------- | ------------------------- |
| `name`          | `string` | ✅       | Nama perusahaan/nasabah   |
| `address`       | `string` | ❌       | Alamat                    |
| `phone`         | `string` | ❌       | Nomor telepon             |
| `email`         | `string` | ❌       | Email                     |
| `contactPerson` | `string` | ❌       | Personil kontak           |

**Contoh Request Body — dengan `clientId` (existing client):**

```json
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

**Contoh Request Body — dengan `client` inline (create client baru bareng quotation):**

```json
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

**Response 201 — Created:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...qtn1",
    "quotationNumber": "QTN-20260725-001",
    "status": "DRAFT"
  }
}
```

---

### 2.4 `PATCH /quotations/:id` — Update Quotation

Mengupdate data quotation. **Hanya bisa dilakukan saat status DRAFT atau REVISION.**

**Permission:** `quotation:update`

**Request Body:** Field optional sama seperti Create (kecuali `client` inline — hanya support `clientId` untuk update).

**Error Responses:**

| Status            | Description                      |
| ----------------- | -------------------------------- |
| `400 Bad Request` | Status bukan DRAFT atau REVISION |

---

### 2.5 `DELETE /quotations/:id` — Soft Delete

Menonaktifkan quotation. **Hanya bisa dilakukan saat status DRAFT.**

**Permission:** `quotation:update`

**Error Responses:**

| Status            | Description        |
| ----------------- | ------------------ |
| `400 Bad Request` | Status bukan DRAFT |

---

### 2.6 Status Transition Endpoints

Semua endpoint berikut menggunakan **Permission:** `quotation:update`.

| Endpoint                                  | From Status                | To Status           | Description              |
| ----------------------------------------- | -------------------------- | ------------------- | ------------------------ |
| `POST /quotations/:id/submit`             | `DRAFT`                    | `WAITING_APPROVAL`  | Kirim untuk approval     |
| `POST /quotations/:id/approve`            | `WAITING_APPROVAL`         | `APPROVED`          | Setujui quotation        |
| `POST /quotations/:id/reject`             | `WAITING_APPROVAL`         | `DRAFT`             | Tolak (kembali ke DRAFT) |
| `POST /quotations/:id/request-revision`   | `WAITING_APPROVAL`         | `DRAFT`             | Minta revisi             |
| `POST /quotations/:id/send-to-insurance`  | `APPROVED` atau `REVISION` | `SENT_TO_INSURANCE` | Kirim ke pihak asuransi  |
| `POST /quotations/:id/insurance-approve`  | `SENT_TO_INSURANCE`        | `POLICY_ISSUED`     | Asuransi menyetujui      |
| `POST /quotations/:id/insurance-revision` | `SENT_TO_INSURANCE`        | `REVISION`          | Asuransi minta revisi    |

Setiap endpoint menerima **request body opsional**:

```json
{
  "note": "Catatan untuk aksi ini"
}
```

**Response 200 — Success:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...qtn1",
    "quotationNumber": "QTN-20260725-001",
    "status": "WAITING_APPROVAL"
  }
}
```

**Catatan:**

- `approve`, `reject`, dan `request-revision` juga membuat record **QuotationApproval**
- Semua transisi membuat record **QuotationHistory**

---

### 2.7 `GET /quotations/:id/approvals` — Get Approval History

Mengembalikan riwayat approval (approve/reject/revision) untuk quotation.

**Permission:** `quotation:read`

**Response 200 — Success:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "clx...appr1",
      "action": "APPROVED",
      "note": "Disetujui, lanjut ke underwriting",
      "createdAt": "2025-07-26T09:00:00.000Z"
    }
  ]
}
```

---

### 2.8 `GET /quotations/:id/history` — Get Status History

Mengembalikan seluruh riwayat perubahan status quotation.

**Permission:** `quotation:read`

**Response 200 — Success:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "clx...hist1",
      "fromStatus": null,
      "toStatus": "DRAFT",
      "action": "CREATE",
      "actorId": "clx...user1",
      "note": null,
      "createdAt": "2025-07-25T08:30:00.000Z"
    },
    {
      "_id": "clx...hist2",
      "fromStatus": "DRAFT",
      "toStatus": "WAITING_APPROVAL",
      "action": "SUBMIT",
      "actorId": "clx...user1",
      "note": "Mohon approval",
      "createdAt": "2025-07-26T08:00:00.000Z"
    }
  ]
}
```

---

### 2.9 `GET /quotations/:id/export-pdf` — Export PDF

**Placeholder** — belum diimplementasikan.

**Permission:** `quotation:read`

**Response 200:**

```json
{
  "success": true,
  "data": {
    "message": "PDF generation not yet implemented",
    "quotationId": "clx...qtn1",
    "quotationNumber": "QTN-20260725-001"
  }
}
```

---

## 3. Child Modules

Quotation memiliki **5 child module** yang diakses melalui nested route `quotations/:quotationId/<resource>`.

### 3.1 Quotation Objects

**Base path:** `quotations/:quotationId/objects`

Mengelola objek pertanggungan (data dinamis dalam format JSON).

| Method   | Endpoint                               | Permission         | Description   |
| -------- | -------------------------------------- | ------------------ | ------------- |
| `GET`    | `/quotations/:quotationId/objects`     | `quotation:read`   | List objects  |
| `GET`    | `/quotations/:quotationId/objects/:id` | `quotation:read`   | Get object    |
| `POST`   | `/quotations/:quotationId/objects`     | `quotation:update` | Create object |
| `PATCH`  | `/quotations/:quotationId/objects/:id` | `quotation:update` | Update object |
| `DELETE` | `/quotations/:quotationId/objects/:id` | `quotation:update` | Delete object |

**Request Body (Create/Update):**

| Field        | Type     | Required | Description                  |
| ------------ | -------- | -------- | ---------------------------- |
| `objectType` | `string` | ✅       | Tipe objek (min 1 karakter)  |
| `data`       | `any`    | ❌       | Data objek dalam format JSON |

### 3.2 Quotation Coverages

**Base path:** `quotations/:quotationId/coverages`

Mengelola daftar cover/pertanggungan.

| Method   | Endpoint                                 | Permission         | Description     |
| -------- | ---------------------------------------- | ------------------ | --------------- |
| `GET`    | `/quotations/:quotationId/coverages`     | `quotation:read`   | List coverages  |
| `GET`    | `/quotations/:quotationId/coverages/:id` | `quotation:read`   | Get coverage    |
| `POST`   | `/quotations/:quotationId/coverages`     | `quotation:update` | Create coverage |
| `PATCH`  | `/quotations/:quotationId/coverages/:id` | `quotation:update` | Update coverage |
| `DELETE` | `/quotations/:quotationId/coverages/:id` | `quotation:update` | Delete coverage |

**Request Body (Create/Update):**

| Field          | Type     | Required | Description         |
| -------------- | -------- | -------- | ------------------- |
| `coverageType` | `string` | ❌       | Tipe coverage       |
| `description`  | `string` | ❌       | Deskripsi coverage  |
| `value`        | `number` | ❌       | Nilai pertanggungan |

### 3.3 Quotation Terms

**Base path:** `quotations/:quotationId/terms`

Mengelola syarat & ketentuan khusus untuk quotation.

| Method   | Endpoint                             | Permission         | Description |
| -------- | ------------------------------------ | ------------------ | ----------- |
| `GET`    | `/quotations/:quotationId/terms`     | `quotation:read`   | List terms  |
| `GET`    | `/quotations/:quotationId/terms/:id` | `quotation:read`   | Get term    |
| `POST`   | `/quotations/:quotationId/terms`     | `quotation:update` | Create term |
| `PATCH`  | `/quotations/:quotationId/terms/:id` | `quotation:update` | Update term |
| `DELETE` | `/quotations/:quotationId/terms/:id` | `quotation:update` | Delete term |

**Request Body (Create/Update):**

| Field              | Type     | Required | Description                                   |
| ------------------ | -------- | -------- | --------------------------------------------- |
| `termsConditionId` | `string` | ❌       | Referensi ke master TermsCondition (jika ada) |
| `description`      | `string` | ❌       | Deskripsi term                                |

### 3.4 Quotation Warranties

**Base path:** `quotations/:quotationId/warranties`

Mengelola daftar warranty untuk quotation.

| Method   | Endpoint                                  | Permission         | Description     |
| -------- | ----------------------------------------- | ------------------ | --------------- |
| `GET`    | `/quotations/:quotationId/warranties`     | `quotation:read`   | List warranties |
| `GET`    | `/quotations/:quotationId/warranties/:id` | `quotation:read`   | Get warranty    |
| `POST`   | `/quotations/:quotationId/warranties`     | `quotation:update` | Create warranty |
| `PATCH`  | `/quotations/:quotationId/warranties/:id` | `quotation:update` | Update warranty |
| `DELETE` | `/quotations/:quotationId/warranties/:id` | `quotation:update` | Delete warranty |

**Request Body (Create/Update):**

| Field         | Type     | Required | Description                             |
| ------------- | -------- | -------- | --------------------------------------- |
| `warrantyId`  | `string` | ❌       | Referensi ke master Warranty (jika ada) |
| `description` | `string` | ❌       | Deskripsi warranty                      |

### 3.5 Quotation Attachments

**Base path:** `quotations/:quotationId/attachments`

Mengelola lampiran untuk quotation. **Tidak ada endpoint PATCH** — hanya upload, read, dan delete.

| Method   | Endpoint                                   | Permission         | Description        |
| -------- | ------------------------------------------ | ------------------ | ------------------ |
| `GET`    | `/quotations/:quotationId/attachments`     | `quotation:read`   | List attachments   |
| `GET`    | `/quotations/:quotationId/attachments/:id` | `quotation:read`   | Get attachment     |
| `POST`   | `/quotations/:quotationId/attachments`     | `quotation:update` | Upload attachment  |
| `DELETE` | `/quotations/:quotationId/attachments/:id` | `quotation:update` | Delete attachment  |

**Upload — `POST` (multipart/form-data):**

Menerima file upload langsung. File akan diupload ke S3-compatible storage.

| Field    | Type   | Required | Description                      |
| -------- | ------ | -------- | -------------------------------- |
| `file`   | binary | ✅       | File attachment (max 50MB)       |

**Allowed MIME types:**
- `application/pdf`
- `image/*` (jpg, png, gif, dll)
- `application/vnd.openxmlformats-officedocument.*` (docx, xlsx, pptx)
- `application/vnd.ms-*` (doc, xls, ppt)

**Response 201 — Created:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...att1",
    "fileName": "polis-capai.pdf",
    "url": "https://s3.nevaobjects.id/braka/quotations/clx...qtn1/uuid-polis-capai.pdf",
    "mimeType": "application/pdf",
    "fileSize": 2457600
  }
}
```

---

## 4. Flow End-to-End

### Skenario: Dari pembuatan quotation hingga polis terbit

**Step 1: Buat quotation (DRAFT)**

Client bisa ditentukan dengan 2 cara:

**Opsi A — Gunakan client yang sudah ada:**
```http
POST /quotations
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "clientId": "clx...client1",
  "insuranceTypeId": "clx...hm",
  "insured": "PT Pelayaran Nusantara",
  "rate": 0.0025,
  "premium": 125000000
}
```

**Opsi B — Buat client baru inline (bersamaan dengan quotation):**
```http
POST /quotations
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
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

Response (kedua opsi): Status `DRAFT`.

---

**Step 2: Tambah child data**

```http
POST /quotations/clx...qtn1/objects
Content-Type: application/json

{
  "objectType": "Vessel",
  "data": { "name": "MV Nusantara", "year": 2020, "gt": 5000 }
}
```

```http
POST /quotations/clx...qtn1/coverages
Content-Type: application/json

{
  "coverageType": "Hull",
  "description": "Hull & Machinery coverage",
  "value": 50000000000
}
```

---

**Step 3: Submit untuk approval**

```http
POST /quotations/clx...qtn1/submit
Content-Type: application/json

{
  "note": "Quotation sudah lengkap, mohon approval"
}
```

Status berubah: `DRAFT` → `WAITING_APPROVAL`.

---

**Step 4: Approve quotation**

```http
POST /quotations/clx...qtn1/approve
Content-Type: application/json

{
  "note": "Disetujui"
}
```

Status berubah: `WAITING_APPROVAL` → `APPROVED`.

---

**Step 5: Kirim ke asuransi**

```http
POST /quotations/clx...qtn1/send-to-insurance
Content-Type: application/json

{
  "note": "Dikirim ke underwriting"
}
```

Status berubah: `APPROVED` → `SENT_TO_INSURANCE`.

---

**Step 6: Asuransi setujui / minta revisi**

Jika disetujui:

```http
POST /quotations/clx...qtn1/insurance-approve
```

Status: `SENT_TO_INSURANCE` → `POLICY_ISSUED` (terminal).

Jika direvisi:

```http
POST /quotations/clx...qtn1/insurance-revision
```

Status: `SENT_TO_INSURANCE` → `REVISION`. User bisa edit lalu kirim ulang ke asuransi.

---

**Step 7: Cek histori**

```http
GET /quotations/clx...qtn1/history
```

Response: Seluruh riwayat perubahan status, dari CREATE hingga status terakhir.

---

## 5. Authorization & Permissions

### 5.1 Matrix Endpoint vs Permission

| Endpoint                                    | Permission         |
| ------------------------------------------- | ------------------ |
| `GET /quotations`                           | `quotation:read`   |
| `GET /quotations/:id`                       | `quotation:read`   |
| `GET /quotations/:id/approvals`             | `quotation:read`   |
| `GET /quotations/:id/history`               | `quotation:read`   |
| `GET /quotations/:id/export-pdf`            | `quotation:read`   |
| `POST /quotations`                          | `quotation:create` |
| `PATCH /quotations/:id`                     | `quotation:update` |
| `DELETE /quotations/:id`                    | `quotation:update` |
| `POST /quotations/:id/{submit,approve,...}` | `quotation:update` |
| Child GET endpoints                         | `quotation:read`   |
| Child POST/PATCH/DELETE endpoints           | `quotation:update` |

**Catatan:** Delete quotation menggunakan permission `update`, bukan `delete`.

---

## 6. Error Response Codes

| Status             | Kondisi                                                                              |
| ------------------ | ------------------------------------------------------------------------------------ |
| `200 OK`           | GET, PATCH, DELETE, dan semua status transition sukses                               |
| `201 Created`      | POST create sukses                                                                   |
| `400 Bad Request`  | Validasi gagal, transisi status tidak valid, update saat status bukan DRAFT/REVISION |
| `401 Unauthorized` | Token tidak ada, invalid, atau expired                                               |
| `403 Forbidden`    | Token valid tapi tidak punya permission yang sesuai                                  |
| `404 Not Found`    | Quotation dengan ID tertentu tidak ditemukan                                         |

---

## 7. Endpoint Summary

### Main Quotation (16 endpoints)

| Method   | Endpoint                             | Description                           |
| -------- | ------------------------------------ | ------------------------------------- |
| `GET`    | `/quotations`                        | List all                              |
| `GET`    | `/quotations/:id`                    | Get detail                            |
| `POST`   | `/quotations`                        | Create                                |
| `PATCH`  | `/quotations/:id`                    | Update                                |
| `DELETE` | `/quotations/:id`                    | Soft delete                           |
| `POST`   | `/quotations/:id/submit`             | DRAFT → WAITING_APPROVAL              |
| `POST`   | `/quotations/:id/approve`            | WAITING_APPROVAL → APPROVED           |
| `POST`   | `/quotations/:id/reject`             | WAITING_APPROVAL → DRAFT              |
| `POST`   | `/quotations/:id/request-revision`   | WAITING_APPROVAL → DRAFT              |
| `POST`   | `/quotations/:id/send-to-insurance`  | APPROVED/REVISION → SENT_TO_INSURANCE |
| `POST`   | `/quotations/:id/insurance-approve`  | SENT_TO_INSURANCE → POLICY_ISSUED     |
| `POST`   | `/quotations/:id/insurance-revision` | SENT_TO_INSURANCE → REVISION          |
| `GET`    | `/quotations/:id/approvals`          | Approval history                      |
| `GET`    | `/quotations/:id/history`            | Status history                        |
| `GET`    | `/quotations/:id/export-pdf`         | Export PDF (placeholder)              |

### Child Quotation Objects (5 endpoints)

| Method   | Endpoint                               |
| -------- | -------------------------------------- |
| `GET`    | `/quotations/:quotationId/objects`     |
| `GET`    | `/quotations/:quotationId/objects/:id` |
| `POST`   | `/quotations/:quotationId/objects`     |
| `PATCH`  | `/quotations/:quotationId/objects/:id` |
| `DELETE` | `/quotations/:quotationId/objects/:id` |

### Child Quotation Coverages (5 endpoints)

| Method   | Endpoint                                 |
| -------- | ---------------------------------------- |
| `GET`    | `/quotations/:quotationId/coverages`     |
| `GET`    | `/quotations/:quotationId/coverages/:id` |
| `POST`   | `/quotations/:quotationId/coverages`     |
| `PATCH`  | `/quotations/:quotationId/coverages/:id` |
| `DELETE` | `/quotations/:quotationId/coverages/:id` |

### Child Quotation Terms (5 endpoints)

| Method   | Endpoint                             |
| -------- | ------------------------------------ |
| `GET`    | `/quotations/:quotationId/terms`     |
| `GET`    | `/quotations/:quotationId/terms/:id` |
| `POST`   | `/quotations/:quotationId/terms`     |
| `PATCH`  | `/quotations/:quotationId/terms/:id` |
| `DELETE` | `/quotations/:quotationId/terms/:id` |

### Child Quotation Warranties (5 endpoints)

| Method   | Endpoint                                  |
| -------- | ----------------------------------------- |
| `GET`    | `/quotations/:quotationId/warranties`     |
| `GET`    | `/quotations/:quotationId/warranties/:id` |
| `POST`   | `/quotations/:quotationId/warranties`     |
| `PATCH`  | `/quotations/:quotationId/warranties/:id` |
| `DELETE` | `/quotations/:quotationId/warranties/:id` |

### Child Quotation Attachments (4 endpoints — no PATCH)

| Method   | Endpoint                                   |
| -------- | ------------------------------------------ |
| `GET`    | `/quotations/:quotationId/attachments`     |
| `GET`    | `/quotations/:quotationId/attachments/:id` |
| `POST`   | `/quotations/:quotationId/attachments`     |
| `DELETE` | `/quotations/:quotationId/attachments/:id` |

**Total: 40 endpoints** untuk seluruh modul Quotation.
