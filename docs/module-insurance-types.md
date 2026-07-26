# Insurance Types Module

Dokumentasi lengkap modul **Insurance Types** untuk frontend — manajemen master data jenis asuransi dengan soft delete dan audit log.

---

## 1. Konsep

Insurance Type adalah master data yang mendefinisikan **jenis-jenis asuransi** yang tersedia di sistem PPMI. Data ini digunakan sebagai referensi oleh modul **Quotations** dan modul lainnya.

### 1.1 Struktur Data

Setiap Insurance Type memiliki:
- **Code** — kode unik jenis asuransi (contoh: `HM` untuk Hull & Machinery, `PI` untuk Protection & Indemnity)
- **Name** — nama lengkap jenis asuransi
- **Description** — deskripsi opsional

### 1.2 Relasi dengan Modul Lain

```
Insurance Type
├── dipakai oleh Quotation (menentukan jenis cover yang diberikan)
└── dipakai oleh Policy (menentukan jenis polis)
```

### 1.3 Soft Delete

Sama seperti modul master data lainnya, Insurance Type tidak pernah dihapus permanen. Ketika di-delete, data hanya ditandai dengan `deletedAt` timestamp.

### 1.4 Audit Log

Setiap operasi CRUD otomatis dicatat ke tabel log dengan:
- `referenceType: "INSURANCE_TYPE"`
- `action`: `CREATE`, `UPDATE`, atau `DELETE`
- `actorId` dan `actorName` dari user yang melakukan operasi

---

## 2. Endpoint Reference

Semua endpoint membutuhkan **autentikasi JWT** via header `Authorization: Bearer <token>`.

### 2.1 `GET /insurance-types` — List All Insurance Types

Mengembalikan daftar semua jenis asuransi yang aktif.

**Permission:** `insurance-type:read`

**Response 200 — Success:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "clx...hm",
      "code": "HM",
      "name": "Hull & Machinery",
      "description": "Asuransi lambung dan mesin kapal",
      "createdAt": "2025-01-15T08:30:00.000Z",
      "updatedAt": "2025-03-01T14:20:00.000Z"
    },
    {
      "_id": "clx...pi",
      "code": "PI",
      "name": "Protection & Indemnity",
      "description": null,
      "createdAt": "2025-01-15T08:31:00.000Z",
      "updatedAt": "2025-03-01T14:20:00.000Z"
    }
  ]
}
```

**Response Fields (tiap item dalam `data[]`):**

| Field | Type | Description |
|-------|------|-------------|
| `_id` | `string` | Unique identifier (cuid) |
| `code` | `string` | Kode unik jenis asuransi |
| `name` | `string` | Nama jenis asuransi |
| `description` | `string \| null` | Deskripsi opsional |
| `createdAt` | `string` (ISO 8601) | Timestamp dibuat |
| `updatedAt` | `string` (ISO 8601) | Timestamp terakhir diupdate |

**Catatan:**
- Urutan berdasarkan `createdAt` descending (terbaru di atas)
- Data yang sudah di-soft-delete tidak muncul

---

### 2.2 `GET /insurance-types/:id` — Get Detail

Mengembalikan detail satu jenis asuransi berdasarkan ID.

**Permission:** `insurance-type:read`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | ✅ | ID insurance type (cuid) |

**Response 200 — Success:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...hm",
    "code": "HM",
    "name": "Hull & Machinery",
    "description": "Asuransi lambung dan mesin kapal",
    "createdAt": "2025-01-15T08:30:00.000Z",
    "updatedAt": "2025-03-01T14:20:00.000Z"
  }
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| `401 Unauthorized` | Token tidak ada atau invalid |
| `403 Forbidden` | User tidak punya permission `insurance-type:read` |
| `404 Not Found` | Insurance type tidak ditemukan atau sudah dihapus |

---

### 2.3 `POST /insurance-types` — Create

Membuat jenis asuransi baru.

**Permission:** `insurance-type:create`

**Request Body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | `string` | ✅ | Kode unik (min 1 karakter) |
| `name` | `string` | ✅ | Nama jenis asuransi (min 1 karakter) |
| `description` | `string` | ❌ | Deskripsi |

**Contoh Request Body:**

```json
{
  "code": "CARGO",
  "name": "Cargo",
  "description": "Asuransi pengangkutan barang"
}
```

**Response 201 — Created:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...cargo",
    "code": "CARGO",
    "name": "Cargo"
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `_id` | `string` | ID yang baru dibuat |
| `code` | `string` | Kode jenis asuransi |
| `name` | `string` | Nama jenis asuransi |

**Error Responses:**

| Status | Description |
|--------|-------------|
| `400 Bad Request` | Validasi gagal (code atau name kosong, duplicate code) |
| `401 Unauthorized` | Token tidak ada atau invalid |
| `403 Forbidden` | User tidak punya permission `insurance-type:create` |

---

### 2.4 `PATCH /insurance-types/:id` — Update

Mengupdate data jenis asuransi. Semua field opsional — partial update.

**Permission:** `insurance-type:update`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | ✅ | ID insurance type (cuid) |

**Request Body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | `string` | ❌ | Kode baru (min 1 karakter) |
| `name` | `string` | ❌ | Nama baru (min 1 karakter) |
| `description` | `string` | ❌ | Deskripsi baru |

> Kirim hanya field yang ingin diubah.

**Response 200 — Success:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...cargo",
    "code": "CARGO",
    "name": "Cargo & Logistics"
  }
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| `400 Bad Request` | Validasi gagal (duplicate code, dll) |
| `401 Unauthorized` | Token tidak ada atau invalid |
| `403 Forbidden` | User tidak punya permission `insurance-type:update` |
| `404 Not Found` | Insurance type tidak ditemukan atau sudah dihapus |

---

### 2.5 `DELETE /insurance-types/:id` — Soft Delete

Menonaktifkan jenis asuransi. Data tetap di database tetapi tidak muncul di list.

**Permission:** `insurance-type:delete`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | ✅ | ID insurance type (cuid) |

**Response 200 — Success:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...cargo"
  }
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| `401 Unauthorized` | Token tidak ada atau invalid |
| `403 Forbidden` | User tidak punya permission `insurance-type:delete` |
| `404 Not Found` | Insurance type tidak ditemukan atau sudah dihapus |

---

## 3. Flow End-to-End

### Skenario: Admin mengelola master jenis asuransi

**Step 1: Buat jenis asuransi baru**

```http
POST /insurance-types
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "code": "HM",
  "name": "Hull & Machinery",
  "description": "Asuransi lambung dan mesin kapal"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "_id": "clx...hm",
    "code": "HM",
    "name": "Hull & Machinery"
  }
}
```

---

**Step 2: Tambah jenis asuransi lainnya**

```http
POST /insurance-types
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "code": "PI",
  "name": "Protection & Indemnity"
}
```

---

**Step 3: List semua jenis asuransi**

```http
GET /insurance-types
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Response: Array berisi semua jenis asuransi yang aktif.

---

**Step 4: Update deskripsi**

```http
PATCH /insurance-types/clx...hm
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "description": "Hull & Machinery - Updated description"
}
```

---

**Step 5: Nonaktifkan jenis asuransi**

```http
DELETE /insurance-types/clx...hm
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Setelah ini, `GET /insurance-types` tidak lagi menampilkan "Hull & Machinery".

---

## 4. Authorization & Permissions

### 4.1 Matrix Endpoint vs Permission

| Endpoint | Permission Required |
|----------|---------------------|
| `GET /insurance-types` | `insurance-type:read` |
| `GET /insurance-types/:id` | `insurance-type:read` |
| `POST /insurance-types` | `insurance-type:create` |
| `PATCH /insurance-types/:id` | `insurance-type:update` |
| `DELETE /insurance-types/:id` | `insurance-type:delete` |

---

## 5. Error Response Codes

| Status | Kondisi |
|--------|---------|
| `200 OK` | GET list, GET detail, PATCH update, DELETE sukses |
| `201 Created` | POST create sukses |
| `400 Bad Request` | Validasi gagal (field kosong, duplicate code) |
| `401 Unauthorized` | Token tidak ada, invalid, atau expired |
| `403 Forbidden` | Token valid tapi tidak punya permission yang sesuai |
| `404 Not Found` | Insurance type dengan ID tertentu tidak ditemukan |
