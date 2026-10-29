# Clubs Module

Modul **Clubs** mengelola master klub P&I. Klub dipakai untuk memilih template P&I quotation dan sebagai kode klub pada polis kapal.

---

## 1. Data Klub

| Field | Type | Keterangan |
| --- | --- | --- |
| `_id` | `string` | ID klub. |
| `code` | `string` | Kode unik, huruf besar, angka, dan underscore. Contoh: `MSIG`, `EOM`, `HYDOR`. |
| `name` | `string` | Nama lengkap klub. |

Klub yang di-soft-delete tidak muncul di daftar dan tidak bisa dipilih untuk quotation baru.

**Aturan kode:**
- `code` wajib unik, termasuk klub yang sudah di-soft-delete.
- `code` tidak bisa diubah setelah dipakai oleh quotation P&I atau template.
- `name` bisa diubah kapan saja.

---

## 2. Endpoint

**Authentication:** Bearer token. Permission mengikuti resource `club`.

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `GET` | `/clubs` | `club:read` | Daftar klub aktif. |
| `GET` | `/clubs/:id` | `club:read` | Detail klub. |
| `POST` | `/clubs` | `club:create` | Membuat klub. |
| `PATCH` | `/clubs/:id` | `club:update` | Mengubah klub. |
| `POST` | `/clubs/:id/restore` | `club:update` | Mengaktifkan kembali klub yang di-soft-delete. |
| `DELETE` | `/clubs/:id` | `club:delete` | Soft delete klub. |

### Request body: `POST /clubs`

```json
{
  "code": "MSIG",
  "name": "MSIG Specialty Marine NV"
}
```

### Request body: `PATCH /clubs/:id`

```json
{
  "name": "MSIG Specialty Marine"
}
```

Semua field bersifat opsional. Kirim hanya field yang ingin diubah.

---

## 3. Error

| Status | Kondisi |
| --- | --- |
| `400 Bad Request` | `code` sudah dipakai, atau `code` diubah padahal sudah dipakai. |
| `404 Not Found` | Klub tidak ditemukan atau sudah di-soft-delete (untuk `GET`, `PATCH`, dan `DELETE`). |
| `404 Not Found` | Klub nonaktif tidak ditemukan (untuk `restore`). |

---

## 4. Audit Log

Setiap create, update, delete, dan restore dicatat di tabel `log` dengan `referenceType = CLUB`.
