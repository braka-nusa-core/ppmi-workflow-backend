# Clients Module

Dokumentasi lengkap modul **Clients** untuk frontend — manajemen data nasabah/klien dengan soft delete, audit log, dan auto-generated client code.

---

## 1. Konsep

### 1.1 Client Code

Setiap client memiliki **kode unik** yang digenerate otomatis oleh sistem dengan format:

```
CLT-YYYYMMDD-XXX
```

**Contoh:** `CLT-20260725-001`, `CLT-20260725-002`

- `CLT` — prefix tetap (CLIENT)
- `YYYYMMDD` — tanggal pembuatan
- `XXX` — nomor urut 3 digit (reset setiap hari)

Kode client bersifat **immutable** — tidak bisa diubah setelah dibuat.

### 1.2 Soft Delete

Client tidak pernah dihapus permanen dari database. Ketika di-delete, data hanya ditandai dengan `deletedAt` timestamp. Client yang sudah di-delete:
- Tidak muncul di list
- Bisa di-restore jika diperlukan (via database langsung)
- Data tetap utuh untuk referensi histori

### 1.3 Audit Log

Setiap operasi CRUD pada client otomatis dicatat ke tabel log dengan:
- `referenceType: "QUOTATION_SLIP"`
- `action`: `CREATE`, `UPDATE`, atau `DELETE`
- `actorId` dan `actorName` dari user yang melakukan operasi

---

## 2. Endpoint Reference

Semua endpoint membutuhkan **autentikasi JWT** via header `Authorization: Bearer <token>`.

### 2.1 `GET /clients` — List All Clients

Mengembalikan daftar semua client aktif (belum di-soft-delete).

**Permission:** `client:read`

**Response 200 — Success:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "clx...abc",
      "clientCode": "CLT-20260725-001",
      "name": "PT Asuransi ABC",
      "address": "Jl. Sudirman No. 123",
      "phone": "021-12345678",
      "email": "info@abc.com",
      "contactPerson": "Budi Santoso",
      "createdAt": "2025-01-15T08:30:00.000Z",
      "updatedAt": "2025-03-01T14:20:00.000Z"
    }
  ]
}
```

**Response Fields (tiap item dalam `data[]`):**

| Field | Type | Description |
|-------|------|-------------|
| `_id` | `string` | Unique identifier client (cuid) |
| `clientCode` | `string` | Auto-generated code (read-only) |
| `name` | `string` | Nama perusahaan/nasabah |
| `address` | `string \| null` | Alamat |
| `phone` | `string \| null` | Nomor telepon |
| `email` | `string \| null` | Email |
| `contactPerson` | `string \| null` | Personil yang bisa dihubungi |
| `createdAt` | `string` (ISO 8601) | Timestamp dibuat |
| `updatedAt` | `string` (ISO 8601) | Timestamp terakhir diupdate |

**Catatan:**
- Urutan berdasarkan `createdAt` descending (terbaru di atas)
- Client yang sudah di-soft-delete tidak muncul

---

### 2.2 `GET /clients/:id` — Get Client Detail

Mengembalikan detail satu client berdasarkan ID.

**Permission:** `client:read`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | ✅ | ID client (cuid) |

**Response 200 — Success:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...abc",
    "clientCode": "CLT-20260725-001",
    "name": "PT Asuransi ABC",
    "address": "Jl. Sudirman No. 123",
    "phone": "021-12345678",
    "email": "info@abc.com",
    "contactPerson": "Budi Santoso",
    "createdAt": "2025-01-15T08:30:00.000Z",
    "updatedAt": "2025-03-01T14:20:00.000Z"
  }
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| `401 Unauthorized` | Token tidak ada atau invalid |
| `403 Forbidden` | User tidak punya permission `client:read` |
| `404 Not Found` | Client tidak ditemukan atau sudah dihapus |

---

### 2.3 `POST /clients` — Create Client

Membuat client baru. `clientCode` akan digenerate otomatis.

**Permission:** `client:create`

**Request Body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | ✅ | Nama perusahaan (min 1 karakter) |
| `address` | `string` | ❌ | Alamat |
| `phone` | `string` | ❌ | Nomor telepon |
| `email` | `string` | ❌ | Email |
| `contactPerson` | `string` | ❌ | Personil kontak |

**Contoh Request Body:**

```json
{
  "name": "PT Asuransi ABC",
  "address": "Jl. Sudirman No. 123",
  "phone": "021-12345678",
  "email": "info@abc.com",
  "contactPerson": "Budi Santoso"
}
```

**Response 201 — Created:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...abc",
    "clientCode": "CLT-20260725-001",
    "name": "PT Asuransi ABC"
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `_id` | `string` | ID client yang baru dibuat |
| `clientCode` | `string` | Auto-generated code |
| `name` | `string` | Nama perusahaan |

**Error Responses:**

| Status | Description |
|--------|-------------|
| `400 Bad Request` | Validasi gagal (`name` kosong, dll) |
| `401 Unauthorized` | Token tidak ada atau invalid |
| `403 Forbidden` | User tidak punya permission `client:create` |

---

### 2.4 `PATCH /clients/:id` — Update Client

Mengupdate data client. Semua field bersifat **opsional** — partial update.

**Permission:** `client:update`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | ✅ | ID client yang akan diupdate |

**Request Body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | ❌ | Nama perusahaan baru (min 1 karakter) |
| `address` | `string` | ❌ | Alamat baru |
| `phone` | `string` | ❌ | Nomor telepon baru |
| `email` | `string` | ❌ | Email baru |
| `contactPerson` | `string` | ❌ | Personil kontak baru |

> Kirim hanya field yang ingin diubah.

**Response 200 — Success:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...abc",
    "clientCode": "CLT-20260725-001",
    "name": "PT Asuransi ABC Updated"
  }
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| `400 Bad Request` | Validasi gagal |
| `401 Unauthorized` | Token tidak ada atau invalid |
| `403 Forbidden` | User tidak punya permission `client:update` |
| `404 Not Found` | Client tidak ditemukan atau sudah dihapus |

---

### 2.5 `DELETE /clients/:id` — Soft Delete Client

Menonaktifkan client. Data tetap di database tetapi tidak muncul di list.

**Permission:** `client:delete`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | ✅ | ID client yang akan dinonaktifkan |

**Response 200 — Success:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...abc"
  }
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| `401 Unauthorized` | Token tidak ada atau invalid |
| `403 Forbidden` | User tidak punya permission `client:delete` |
| `404 Not Found` | Client tidak ditemukan atau sudah dihapus |

---

## 3. Flow End-to-End

### Skenario: Staff membuat client baru

**Step 1: Buat client**

```http
POST /clients
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "name": "PT Pelayaran Nusantara",
  "address": "Jl. Pelabuhan No. 1",
  "phone": "021-87654321",
  "email": "info@pelayaran.com",
  "contactPerson": "Agus Wijaya"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "_id": "clx...client1",
    "clientCode": "CLT-20260725-001",
    "name": "PT Pelayaran Nusantara"
  }
}
```

---

**Step 2: Cek list client**

```http
GET /clients
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Response: Array berisi semua client aktif, termasuk yang baru dibuat. Field `clientCode` sudah terisi.

---

**Step 3: Update data client**

```http
PATCH /clients/clx...client1
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "phone": "021-99999999",
  "contactPerson": "Bambang"
}
```

---

**Step 4: Nonaktifkan client**

```http
DELETE /clients/clx...client1
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Response:

```json
{
  "success": true,
  "data": {
    "_id": "clx...client1"
  }
}
```

Setelah ini, client tersebut tidak muncul di `GET /clients` tetapi data masih tersimpan di database.

---

## 4. Authorization & Permissions

### 4.1 Matrix Endpoint vs Permission

| Endpoint | Permission Required |
|----------|---------------------|
| `GET /clients` | `client:read` |
| `GET /clients/:id` | `client:read` |
| `POST /clients` | `client:create` |
| `PATCH /clients/:id` | `client:update` |
| `DELETE /clients/:id` | `client:delete` |

### 4.2 Alur Cek Permission

```
Request → AuthGuard (validasi JWT)
          → PermissionGuard (cek metadata @RequirePermission)
               → SUPERADMIN? → LANGSUNG LOLOS
               → USER? → cek permission di database:
                    permission.findFirst({
                      resource: "client",
                      action: "read",
                      organizations → users → current user
                    })
                    → ditemukan? → LOLOS
                    → tidak ditemukan? → 403 Forbidden
```

---

## 5. Error Response Codes

| Status | Kondisi |
|--------|---------|
| `200 OK` | GET list, GET detail, PATCH update, DELETE sukses |
| `201 Created` | POST create sukses |
| `400 Bad Request` | Validasi gagal |
| `401 Unauthorized` | Token tidak ada, invalid, atau expired |
| `403 Forbidden` | Token valid tapi tidak punya permission yang sesuai |
| `404 Not Found` | Client dengan ID tertentu tidak ditemukan |
