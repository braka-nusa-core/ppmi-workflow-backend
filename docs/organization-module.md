# Organizations Module

Dokumentasi lengkap modul **Organizations** untuk frontend — manajemen struktur organisasi (DIVISION/DEPARTMENT), master permission, dan assignment permission ke unit organisasi.

---

## 1. Organization Unit

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
- User bisa ditempatkan di DIVISION atau DEPARTMENT.

### 1.2 Visual Hierarchy

```
Teknik (DIVISION)
├── H&M (DEPARTMENT)
├── P&I (DEPARTMENT)
└── Cargo (DEPARTMENT)

Finance (DIVISION)
└── Finance (DEPARTMENT)
```

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

### 2.3 Struktur Response Permission

Ketika diambil melalui `GET /organizations/:id/permissions`, response berbentuk array flat:

```json
[
  { "_id": "clx...perm1", "resource": "quotation_slip", "action": "create" },
  { "_id": "clx...perm2", "resource": "quotation_slip", "action": "read" }
]
```

| Field      | Type     | Keterangan                           |
|------------|----------|--------------------------------------|
| `_id`      | `string` | ID permission (cuid)                 |
| `resource` | `string` | Nama resource (contoh: `invoice`)    |
| `action`   | `string` | Nama action (contoh: `approve`)      |

---

## 3. Endpoint Reference

Semua endpoint di modul ini bersifat **SUPERADMIN-only**.

### 3.1 `GET /organizations` — List Tree

Mengembalikan struktur tree DIVISION + DEPARTMENT.

**Response 200 — Success:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "clx...teknik",
      "name": "Teknik",
      "type": "DIVISION",
      "children": [
        { "_id": "clx...hm", "name": "H&M", "type": "DEPARTMENT", "_count": { "users": 5 } },
        { "_id": "clx...pi", "name": "P&I", "type": "DEPARTMENT", "_count": { "users": 3 } }
      ]
    },
    {
      "_id": "clx...finance",
      "name": "Finance",
      "type": "DIVISION",
      "children": [
        { "_id": "clx...fin", "name": "Finance", "type": "DEPARTMENT", "_count": { "users": 2 } }
      ]
    }
  ]
}
```

**Response Fields (tiap item dalam `data[]`):**

| Field              | Type              | Keterangan                       |
|--------------------|-------------------|----------------------------------|
| `_id`              | `string`          | ID organisasi (cuid)             |
| `name`             | `string`          | Nama unit                        |
| `type`             | `string`          | `"DIVISION"` atau `"DEPARTMENT"` |
| `children`         | `array`           | Daftar DEPARTMENT (kosong jika tidak ada) |
| `children[]._id`   | `string`          | ID DEPARTMENT                    |
| `children[].name`  | `string`          | Nama DEPARTMENT                  |
| `children[].type`  | `string`          | `"DEPARTMENT"`                   |
| `children[]._count` | `object`          | Hitungan user aktif              |
| `children[]._count.users` | `number`   | Jumlah user di DEPARTMENT        |

> Hanya DIVISION yang muncul di root array. DEPARTMENT bersarang sebagai `children`.

---

### 3.2 `GET /organizations/:id` — Get Detail

Mengembalikan detail satu unit organisasi.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id`      | `string` | ✅ | ID organisasi (cuid) |

**Response 200 — Success:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...teknik",
    "name": "Teknik",
    "type": "DIVISION",
    "parent": null,
    "children": [
      { "_id": "clx...hm", "name": "H&M", "type": "DEPARTMENT" }
    ],
    "_count": {
      "users": 8
    }
  }
}
```

**Response Fields:**

| Field      | Type                    | Keterangan                              |
|------------|-------------------------|-----------------------------------------|
| `_id`      | `string`                | ID organisasi                           |
| `name`     | `string`                | Nama unit                               |
| `type`     | `string`                | `"DIVISION"` atau `"DEPARTMENT"`        |
| `parent`   | `object \| null`        | Parent DIVISION. `null` jika DIVISION   |
| `parent._id` | `string`              | ID parent                               |
| `parent.name` | `string`             | Nama parent                             |
| `parent.type` | `string`             | Selalu `"DIVISION"`                     |
| `children` | `array`                 | Daftar DEPARTMENT (kosong jika DEPARTMENT) |
| `_count.users` | `number`            | Jumlah user aktif di unit               |

---

### 3.3 `POST /organizations` — Create

Membuat unit organisasi baru.

**Request Body (JSON):**

| Field      | Type     | Required | Description |
|------------|----------|----------|-------------|
| `name`     | `string` | ✅ | Nama unit (min 1 karakter) |
| `type`     | `string` | ✅ | `"DIVISION"` atau `"DEPARTMENT"` |
| `parentId` | `string` | ❌ | ID parent DIVISION. **Wajib** jika `type = "DEPARTMENT"`, **tidak boleh** jika `type = "DIVISION"` |

**Contoh Request Body — DIVISION:**

```json
{
  "name": "Logistik",
  "type": "DIVISION"
}
```

**Contoh Request Body — DEPARTMENT:**

```json
{
  "name": "Gudang",
  "type": "DEPARTMENT",
  "parentId": "clx...logistik"
}
```

**Response 201 — Created:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...logistik",
    "name": "Logistik",
    "type": "DIVISION",
    "parentId": null
  }
}
```

**Response Fields:**

| Field      | Type                    | Keterangan                    |
|------------|-------------------------|-------------------------------|
| `_id`      | `string`                | ID unit yang baru dibuat      |
| `name`     | `string`                | Nama unit                     |
| `type`     | `string`                | `"DIVISION"` / `"DEPARTMENT"` |
| `parentId` | `string \| null`        | ID parent DIVISION            |

---

### 3.4 `PATCH /organizations/:id` — Update

Mengupdate data unit organisasi. Semua field opsional — partial update.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id`      | `string` | ✅ | ID organisasi (cuid) |

**Request Body (JSON):**

| Field      | Type     | Required | Description |
|------------|----------|----------|-------------|
| `name`     | `string` | ❌ | Nama baru (min 1 karakter) |
| `type`     | `string` | ❌ | `"DIVISION"` / `"DEPARTMENT"` |
| `parentId` | `string` | ❌ | Parent baru. Kirim `null` untuk menghapus parent |

**Contoh Request Body:**

```json
{
  "name": "Logistik & Distribusi"
}
```

**Response 200 — Success:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...logistik",
    "name": "Logistik & Distribusi",
    "type": "DIVISION",
    "parentId": null
  }
}
```

---

### 3.5 `DELETE /organizations/:id` — Soft Delete

Menonaktifkan unit organisasi. Data tetap di database tetapi tidak muncul di list tree.

**Syarat:**
- Tidak memiliki active children (DEPARTMENT aktif) — harus dipindah/dihapus dulu
- Tidak memiliki active users — harus dipindah dulu

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id`      | `string` | ✅ | ID organisasi (cuid) |

**Response 200 — Success:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...logistik"
  }
}
```

---

### 3.6 `GET /organizations/permissions` — List All Permissions

Mengembalikan semua master permission.

**Response 200 — Success:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "clx...perm1",
      "resource": "quotation_slip",
      "action": "create",
      "description": null
    },
    {
      "_id": "clx...perm2",
      "resource": "quotation_slip",
      "action": "read",
      "description": null
    }
  ]
}
```

**Response Fields:**

| Field         | Type             | Keterangan                           |
|---------------|------------------|--------------------------------------|
| `_id`         | `string`         | ID permission (cuid)                 |
| `resource`    | `string`         | Nama resource                        |
| `action`      | `string`         | Nama action                          |
| `description` | `string \| null` | Deskripsi permission                 |

> Urutan berdasarkan `resource` ASC, lalu `action` ASC.

---

### 3.7 `POST /organizations/permissions` — Create Permission

Membuat master permission baru.

**Request Body (JSON):**

| Field         | Type     | Required | Description |
|---------------|----------|----------|-------------|
| `resource`    | `string` | ✅ | Nama resource (min 1 karakter) |
| `action`      | `string` | ✅ | Nama action (min 1 karakter) |
| `description` | `string` | ❌ | Deskripsi permission |

**Contoh Request Body:**

```json
{
  "resource": "invoice",
  "action": "approve",
  "description": "Menyetujui invoice"
}
```

**Response 201 — Created:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...perm3",
    "resource": "invoice",
    "action": "approve",
    "description": "Menyetujui invoice"
  }
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| `400 Bad Request` | Permission `resource:action` sudah ada (duplicate) |

---

### 3.8 `PATCH /organizations/permissions/:id` — Update Permission

Mengupdate deskripsi permission. Hanya `description` yang bisa diubah — `resource` dan `action` bersifat immutable.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id`      | `string` | ✅ | ID permission (cuid) |

**Request Body (JSON):**

| Field         | Type     | Required | Description |
|---------------|----------|----------|-------------|
| `description` | `string` | ❌ | Deskripsi baru |

**Contoh Request Body:**

```json
{
  "description": "Menyetujui invoice pelanggan"
}
```

**Response 200 — Success:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...perm3",
    "resource": "invoice",
    "action": "approve",
    "description": "Menyetujui invoice pelanggan"
  }
}
```

---

### 3.9 `DELETE /organizations/permissions/:id` — Delete Permission

Soft delete master permission.

**Syarat:**
- Permission tidak sedang di-assign ke organization manapun — harus di-unassign dulu

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id`      | `string` | ✅ | ID permission (cuid) |

**Response 200 — Success:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...perm3"
  }
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| `400 Bad Request` | Permission masih ter-assign ke organization |

---

### 3.10 `GET /organizations/:id/permissions` — List Org Permissions

Mengembalikan daftar permission yang sudah di-assign ke suatu organization.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id`      | `string` | ✅ | ID organisasi (cuid) |

**Response 200 — Success:**

```json
{
  "success": true,
  "data": [
    { "_id": "clx...perm1", "resource": "quotation_slip", "action": "create" },
    { "_id": "clx...perm2", "resource": "quotation_slip", "action": "read" }
  ]
}
```

> Response adalah array flat — tidak ada nesting bridge table.

---

### 3.11 `POST /organizations/:id/permissions` — Assign Permissions

Assign satu atau lebih permission ke suatu organization.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id`      | `string` | ✅ | ID organisasi (cuid) |

**Request Body (JSON):**

| Field           | Type     | Required | Description |
|-----------------|----------|----------|-------------|
| `permissionIds` | `string[]` | ✅ | Array ID permission (min 1 item) |

**Contoh Request Body:**

```json
{
  "permissionIds": ["clx...perm1", "clx...perm2"]
}
```

**Response 200 — Success:**

```json
{
  "success": true,
  "data": {
    "assigned": 2
  }
}
```

**Response Fields:**

| Field      | Type     | Keterangan |
|------------|----------|------------|
| `assigned` | `number` | Jumlah permission baru yang berhasil di-assign (yang sudah ada sebelumnya di-skip) |

---

### 3.12 `DELETE /organizations/:id/permissions/:permissionId` — Remove Permission

Menghapus assignment permission dari suatu organization.

**Path Parameters:**

| Parameter      | Type     | Required | Description |
|----------------|----------|----------|-------------|
| `id`           | `string` | ✅ | ID organisasi (cuid) |
| `permissionId` | `string` | ✅ | ID permission (cuid) |

**Response 200 — Success:**

```json
{
  "success": true,
  "data": {
    "_id": "clx...perm1"
  }
}
```

---

## 4. Endpoint Summary

| Method   | Endpoint                               | Deskripsi                        |
|----------|----------------------------------------|----------------------------------|
| `GET`    | `/organizations`                       | List tree DIVISION + DEPARTMENT  |
| `GET`    | `/organizations/:id`                   | Detail organisasi                |
| `POST`   | `/organizations`                       | Buat organisasi baru             |
| `PATCH`  | `/organizations/:id`                   | Update organisasi                |
| `DELETE` | `/organizations/:id`                   | Soft delete organisasi           |
| `GET`    | `/organizations/permissions`           | List semua master permission     |
| `POST`   | `/organizations/permissions`           | Buat master permission baru      |
| `PATCH`  | `/organizations/permissions/:id`       | Update deskripsi permission      |
| `DELETE` | `/organizations/permissions/:id`       | Soft delete permission           |
| `GET`    | `/organizations/:id/permissions`       | List permission organisasi       |
| `POST`   | `/organizations/:id/permissions`       | Assign permission ke organisasi  |
| `DELETE` | `/organizations/:id/permissions/:permId` | Hapus assignment permission     |

---

## 5. Error Responses

### 5.1 HTTP Status Codes

| Status | Kondisi |
|--------|---------|
| `200 OK` | GET, PATCH, DELETE sukses |
| `201 Created` | POST create sukses |
| `400 Bad Request` | Validasi gagal, constraint bisnis (parent tidak valid, masih punya children, dll) |
| `401 Unauthorized` | Token tidak ada, invalid, atau expired |
| `403 Forbidden` | Token valid tapi role bukan SUPERADMIN |
| `404 Not Found` | Resource dengan ID tertentu tidak ditemukan |

### 5.2 Format Response

Mengikuti standar global — lihat `docs/api-response.md` untuk detail format sukses dan error.

---

## 6. Aturan Bisnis

### 6.1 Organisasi

| Aturan | Keterangan |
|--------|------------|
| Hanya 2 level | DIVISION → DEPARTMENT. Department tidak bisa punya anak |
| `parentId` | DEPARTMENT **wajib** punya parentId DIVISION. DIVISION **tidak boleh** punya parentId |
| Soft delete | Organisasi tidak bisa dihapus jika masih punya children aktif atau users aktif |

### 6.2 Permission

| Aturan | Keterangan |
|--------|------------|
| Unique constraint | Kombinasi `resource` + `action` bersifat unique |
| Immutable `resource`/`action` | Endpoint update hanya mengubah `description` |
| Soft delete | Permission tidak bisa dihapus jika masih ter-assign ke organisasi manapun |
| Assign skip duplicate | Jika permission sudah ter-assign, di-skip secara otomatis |
