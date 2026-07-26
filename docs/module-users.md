# Users Module

Dokumentasi lengkap modul **Users** untuk frontend — manajemen akun internal dengan soft delete, audit log, dan integrasi Organization Unit hierarchy.

---

## 1. Organization Unit Hierarchy

### 1.1 Konsep

Organization Unit menggunakan **self-referencing tree** dengan 2 level:

```
Level 1 — DIVISION  (parentId: null)
│
└── Level 2 — DEPARTMENT  (parentId → DIVISION._id)
```

**Aturan:**
- `DIVISION` adalah level tertinggi — `parentId = null`
- `DEPARTMENT` adalah anak dari `DIVISION` — `parentId` mengacu ke `DIVISION._id`
- Hanya ada 2 level. Department tidak bisa punya anak lagi.
- Setiap user bisa ditempatkan di DIVISION atau DEPARTMENT.

### 1.2 Visual Hierarchy

```
Teknik (DIVISION)
├── H&M (DEPARTMENT)
├── P&I (DEPARTMENT)
└── Cargo (DEPARTMENT)

Finance (DIVISION)
└── Finance (DEPARTMENT)
```

### 1.3 Struktur Response `organizationUnit`

Ketika user memiliki `organizationUnit`, response yang dikembalikan berbentuk objek bersarang:

```json
{
  "name": "H&M",
  "type": "DEPARTMENT",
  "parent": {
    "name": "Teknik",
    "type": "DIVISION"
  }
}
```

**Penjelasan properti:**

| Field                 | Type     | Keterangan                                    |
|-----------------------|----------|-----------------------------------------------|
| `name`                | `string` | Nama unit user                                |
| `type`                | `string` | `DIVISION` atau `DEPARTMENT`                  |
| `parent`              | `object` | **Hanya muncul jika** `type == "DEPARTMENT"`; `null` jika DIVISION |
| `parent.name`         | `string` | Nama parent DIVISION                          |
| `parent.type`         | `string` | Selalu `"DIVISION"`                           |

> Jika user berada di DIVISION langsung (parentId = null), maka `parent` akan bernilai `null`.

### 1.4 Penempatan User

User bisa ditempatkan di **DIVISION** atau **DEPARTMENT**. Contoh:

```json
{
  "_id": "clx...abc",
  "fullname": "Budi Santoso",
  "role": "USER",
  "organizationUnit": {
    "name": "H&M",
    "type": "DEPARTMENT",
    "parent": {
      "name": "Teknik",
      "type": "DIVISION"
    }
  }
}
```

Berarti Budi ditempatkan di **H&M** yang merupakan DEPARTMENT di bawah DIVISI **Teknik**.

---

## 2. Permission System

### 2.1 Cara Kerja

1. **Permission** didefinisikan sebagai master data: kombinasi `resource` + `action`
   - Contoh: `quotation_slip:create`, `invoice:approve`
2. Setiap **OrganizationUnit** (hanya DIVISION) bisa memiliki banyak **Permission** melalui bridge table `OrganizationUnitPermission`
3. **User** mendapatkan permission dari DIVISION. Jika user ditempatkan di DEPARTMENT, permission diambil dari parent DIVISION
4. **SUPERADMIN** memiliki akses penuh — semua permission check dianggap lolos
5. **USER** biasa hanya memiliki permission dari DIVISION-nya

### 2.2 Flow Cek Permission

```
User → DEPARTMENT
         └── parent DIVISION → permissions → permission
                                              ├── resource: "quotation_slip"
                                              └── action: "approve"
```

Contoh response di endpoint `profile`:

```json
{
  "_id": "clx...abc",
  "fullname": "Budi Santoso",
  "email": "budi@mail.com",
  "phone": "08123456789",
  "role": "USER",
  "createdAt": "2025-01-15T08:30:00.000Z",
  "updatedAt": "2025-03-01T14:20:00.000Z",
  "organizationUnit": {
    "name": "H&M",
    "type": "DEPARTMENT",
    "parent": {
      "name": "Teknik",
      "type": "DIVISION"
    }
  },
  "permissions": [
    "quotation_slip:create",
    "quotation_slip:read",
    "invoice:approve"
  ]
}
```

- SUPERADMIN akan mendapat `permissions: null` — karena semua akses terbuka
- USER biasa mendapat array string `"resource:action"` sesuai permission dari DIVISION
- Permission diambil dari DIVISION, meskipun user ada di DEPARTMENT

---

## 3. Endpoint Reference

### 3.1 `GET /users` — List All Users

Mengembalikan daftar semua user **non-SUPERADMIN** yang aktif (belum di-soft-delete).

**Authentication:** SUPERADMIN-only

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `organizationUnitId` | `string` | ❌ | Filter user berdasarkan unit organisasi tertentu |

**Response 200 — Success:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "clx...abc",
      "fullname": "Budi Santoso",
      "email": "budi@mail.com",
      "phone": "08123456789",
      "role": "USER",
      "organizationUnit": {
        "name": "H&M",
        "type": "DEPARTMENT",
        "parent": {
          "name": "Teknik",
          "type": "DIVISION"
        }
      },
      "createdAt": "2025-01-15T08:30:00.000Z"
    },
    {
      "_id": "clx...def",
      "fullname": "Siti Nurhaliza",
      "email": "siti@mail.com",
      "phone": null,
      "role": "USER",
      "organizationUnit": null,
      "createdAt": "2025-02-20T10:00:00.000Z"
    }
  ]
}
```

**Response Fields (tiap item dalam `data[]`):**

| Field | Type | Description |
|-------|------|-------------|
| `_id` | `string` | Unique identifier user (cuid) |
| `fullname` | `string` | Nama lengkap user |
| `email` | `string` | Email user (unique) |
| `phone` | `string \| null` | Nomor telepon, bisa `null` jika tidak diisi |
| `role` | `string` | `"USER"` — karena `SUPERADMIN` otomatis difilter |
| `organizationUnit` | `object \| null` | Unit organisasi user. `null` jika tidak punya unit |
| `organizationUnit.name` | `string` | Nama unit (contoh: `"H&M"`) |
| `organizationUnit.type` | `string` | `"DIVISION"` atau `"DEPARTMENT"` |
| `organizationUnit.parent` | `object \| null` | Parent unit. `null` jika unit adalah DIVISION |
| `organizationUnit.parent.name` | `string` | Nama parent DIVISION (contoh: `"Teknik"`) |
| `organizationUnit.parent.type` | `string` | Selalu `"DIVISION"` |
| `createdAt` | `string` (ISO 8601) | Timestamp kapan user dibuat |

**Catatan:**
- `SUPERADMIN` tidak pernah muncul di list ini
- Urutan berdasarkan `createdAt` descending (terbaru di atas)
- User yang sudah di-soft-delete tidak muncul

**Error Responses:**

| Status | Response | Description |
|--------|----------|-------------|
| `401 Unauthorized` | `{ "success": false, "error": { "name": "Unauthorized", "message": "Unauthorized" } }` | Token tidak ada atau invalid |
| `403 Forbidden` | `{ "success": false, "error": { "name": "Forbidden", "message": "Forbidden" } }` | Token valid tapi role bukan SUPERADMIN |

---

### 3.2 `GET /users/:id` — Get User Detail

Mengembalikan detail satu user berdasarkan ID. Termasuk user `SUPERADMIN`.

**Authentication:** SUPERADMIN-only

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | ✅ | ID user (cuid) |

**Response 200 — Success:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...abc",
    "fullname": "Budi Santoso",
    "email": "budi@mail.com",
    "phone": "08123456789",
    "role": "USER",
    "organizationUnit": {
      "name": "H&M",
      "type": "DEPARTMENT",
      "parent": {
        "name": "Teknik",
        "type": "DIVISION"
      }
    },
    "createdAt": "2025-01-15T08:30:00.000Z",
    "updatedAt": "2025-03-01T14:20:00.000Z"
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `_id` | `string` | Unique identifier user (cuid) |
| `fullname` | `string` | Nama lengkap user |
| `email` | `string` | Email user (unique) |
| `phone` | `string \| null` | Nomor telepon, bisa `null` |
| `role` | `string` | `"SUPERADMIN"` atau `"USER"` |
| `organizationUnit` | `object \| null` | Unit organisasi user |
| `organizationUnit.name` | `string` | Nama unit |
| `organizationUnit.type` | `string` | `"DIVISION"` atau `"DEPARTMENT"` |
| `organizationUnit.parent` | `object \| null` | Parent unit |
| `organizationUnit.parent.name` | `string` | Nama parent DIVISION |
| `organizationUnit.parent.type` | `string` | Selalu `"DIVISION"` |
| `createdAt` | `string` (ISO 8601) | Timestamp dibuat |
| `updatedAt` | `string` (ISO 8601) | Timestamp terakhir diupdate |

> **Perbedaan dengan `list`:** Endpoint ini mengembalikan `updatedAt` dan tidak memfilter `SUPERADMIN`.

**Error Responses:**

| Status | Description |
|--------|-------------|
| `401 Unauthorized` | Token tidak ada atau invalid |
| `403 Forbidden` | Bukan SUPERADMIN |
| `404 Not Found` | User tidak ditemukan atau sudah dihapus |

---

### 3.3 `POST /users` — Create User

Membuat user baru.

**Authentication:** SUPERADMIN-only

**Request Body (JSON):**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `fullname` | `string` | ✅ | — | Nama lengkap (min 1 karakter) |
| `email` | `string` | ✅ | — | Email valid, unique |
| `password` | `string` | ✅ | — | Password (min 6 karakter) |
| `phone` | `string` | ❌ | — | Nomor telepon (unique jika diisi) |
| `role` | `string` | ❌ | `"USER"` | `"SUPERADMIN"` atau `"USER"` |
| `organizationUnitId` | `string` | ❌ | — | ID OrganizationUnit (cuid) |

**Contoh Request Body:**

```json
{
  "fullname": "Budi Santoso",
  "email": "budi@mail.com",
  "password": "rahasia123",
  "phone": "08123456789",
  "role": "USER",
  "organizationUnitId": "clx...orgunit1"
}
```

**Response 201 — Created:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...abc",
    "fullname": "Budi Santoso",
    "email": "budi@mail.com"
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `_id` | `string` | ID user yang baru dibuat |
| `fullname` | `string` | Nama lengkap user |
| `email` | `string` | Email user |

> Password tidak pernah dikembalikan.

**Error Responses:**

| Status | Description |
|--------|-------------|
| `400 Bad Request` | Validasi gagal (email invalid, password terlalu pendek, dll) |
| `401 Unauthorized` | Token tidak ada atau invalid |
| `403 Forbidden` | Bukan SUPERADMIN |

---

### 3.4 `PATCH /users/:id` — Update User

Mengupdate data user. Semua field bersifat **opsional** — partial update.

**Authentication:** SUPERADMIN-only

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | ✅ | ID user yang akan diupdate |

**Request Body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fullname` | `string` | ❌ | Nama lengkap baru (min 1 karakter) |
| `email` | `string` | ❌ | Email baru (unique) |
| `password` | `string` | ❌ | Password baru (min 6 karakter) |
| `phone` | `string` | ❌ | Nomor telepon baru |
| `role` | `string` | ❌ | Role baru (`"SUPERADMIN"` / `"USER"`) |
| `organizationUnitId` | `string` | ❌ | ID OrganizationUnit baru |

**Contoh Request Body:**

```json
{
  "fullname": "Budi Santoso Updated",
  "email": "budi.baru@mail.com",
  "phone": "08987654321"
}
```

> Kirim hanya field yang ingin diubah. Untuk menghapus `phone` atau `organizationUnitId`, kirim `null`.

**Response 200 — Success:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...abc",
    "fullname": "Budi Santoso Updated",
    "email": "budi.baru@mail.com"
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `_id` | `string` | ID user |
| `fullname` | `string` | Nama lengkap (bisa berubah) |
| `email` | `string` | Email (bisa berubah) |

**Error Responses:**

| Status | Description |
|--------|-------------|
| `400 Bad Request` | Email sudah dipakai user lain |
| `401 Unauthorized` | Token tidak ada atau invalid |
| `403 Forbidden` | Bukan SUPERADMIN |
| `404 Not Found` | User tidak ditemukan atau sudah dihapus |

---

### 3.5 `DELETE /users/:id` — Soft Delete User

Menonaktifkan user. Data tetap di database tetapi tidak bisa login dan tidak muncul di list.

**Authentication:** SUPERADMIN-only

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | ✅ | ID user yang akan dinonaktifkan |

**Request Body:** Tidak ada

**Response 200 — Success:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...budi"
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `_id` | `string` | ID user yang dinonaktifkan |

**Error Responses:**

| Status | Description |
|--------|-------------|
| `401 Unauthorized` | Token tidak ada atau invalid |
| `403 Forbidden` | Bukan SUPERADMIN |
| `404 Not Found` | User tidak ditemukan atau sudah dihapus |

---

## 4. Error Response Format

### 4.1 Success Response

Semua response sukses mengikuti format:

```json
{
  "success": true,
  "data": { ... }
}
```

- `success`: selalu `true`
- `data`: payload utama, bisa berupa array, object, atau string

### 4.2 Error Response

Semua error response mengikuti format:

```json
{
  "success": false,
  "error": {
    "name": "NotFoundException",
    "message": "User not found"
  }
}
```

- `success`: selalu `false`
- `error.name`: tipe error (bisa dipakai untuk switch-case di frontend)
- `error.message`: pesan error yang bisa ditampilkan ke user

### 4.3 HTTP Status Codes yang Mungkin

| Status | Kondisi |
|--------|---------|
| `200 OK` | GET list, GET detail, PATCH update, DELETE sukses |
| `201 Created` | POST create sukses |
| `400 Bad Request` | Validasi gagal atau email duplicate |
| `401 Unauthorized` | Token tidak ada, invalid, atau expired |
| `403 Forbidden` | Token valid tapi role bukan SUPERADMIN |
| `404 Not Found` | User dengan ID tertentu tidak ditemukan |

---

## 5. Contoh Flow End-to-End

### Skenario: Admin mengelola user baru

**Step 1: Login**

```http
POST /auth/login
Content-Type: application/json

{ "email": "superadmin@mail.com", "password": "password123" }
```

Response:

```json
{
  "success": true,
  "data": {
    "_id": "clx...admin",
    "fullname": "Super Admin",
    "email": "superadmin@mail.com",
    "organizationUnit": null,
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

> Simpan `accessToken` untuk dipakai di header Authorization request selanjutnya.

---

**Step 2: List semua user**

```http
GET /users
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Response: Array user non-SUPERADMIN.

---

**Step 3: Buat user baru**

```http
POST /users
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "fullname": "Budi Santoso",
  "email": "budi@mail.com",
  "password": "rahasia123",
  "phone": "08123456789",
  "role": "USER",
  "organizationUnitId": "clx...hm"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "_id": "clx...budi",
    "fullname": "Budi Santoso",
    "email": "budi@mail.com"
  }
}
```

---

**Step 4: Cek detail user baru**

```http
GET /users/clx...budi
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Response: Detail user + `organizationUnit` + `updatedAt`.

---

**Step 5: Update user**

```http
PATCH /users/clx...budi
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "fullname": "Budi Santoso Reborn",
  "phone": "08987654321"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "_id": "clx...budi",
    "fullname": "Budi Santoso Reborn",
    "email": "budi@mail.com"
  }
}
```

---

**Step 6: Nonaktifkan user**

```http
DELETE /users/clx...budi
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Response:

```json
{
  "success": true,
  "data": {
    "_id": "clx...budi"
  }
}
```

Setelah ini:
- `GET /users` → Budi tidak muncul lagi
- `POST /auth/login` dengan email Budi → `401 Unauthorized`
- Data Budi tetap di database tapi tidak bisa diakses

---

## 6. Authorization Summary

### 6.1 Matrix Endpoint vs Role

| Endpoint | SUPERADMIN | USER |
|----------|------------|------|
| `GET /users` | ✅ List | ❌ 403 |
| `GET /users/:id` | ✅ Detail | ❌ 403 |
| `POST /users` | ✅ Create | ❌ 403 |
| `PATCH /users/:id` | ✅ Update | ❌ 403 |
| `DELETE /users/:id` | ✅ Soft delete | ❌ 403 |

### 6.2 JWT Payload

Token JWT mengandung:

```json
{
  "sub": "clx...userId",
  "role": "SUPERADMIN",
  "fullname": "Super Admin",
  "iat": 1700000000,
  "exp": 1700086400
}
```

- `sub`: ID user
- `role`: `SUPERADMIN` atau `USER`
- `fullname`: nama lengkap user
- `iat`/`exp`: standard JWT timestamps

### 6.3 Yang Perlu Dilakukan Frontend

1. **Login**: Kirim `POST /auth/login` → simpan `access_token` (localStorage / cookie)
2. **Setiap Request**: Sertakan header `Authorization: Bearer <token>`
3. **Role Check**: Parse JWT payload (base64 decode) untuk dapat `role`
4. **Tampilkan/Hide Tombol**: Jika `role !== "SUPERADMIN"`, sembunyikan tombol Create, Edit, Delete user
5. **Handle 403**: Redirect ke halaman dashboard dengan pesan "Akses ditolak"
6. **Permissions**: Gunakan endpoint `/profile` untuk dapat daftar permission (string array `"resource:action"`)
