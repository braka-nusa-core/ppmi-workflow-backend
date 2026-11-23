# Insurance Companies Module

Master perusahaan asuransi (penanggung). Dipakai saat quotation dikirim ke insurer dan pada placement polis (leader dan member).

---

## 1. Data

| Field | Type | Keterangan |
| --- | --- | --- |
| `_id` | `string` | ID perusahaan. |
| `code` | `string` | Kode unik, disimpan huruf besar. |
| `name` | `string` | Nama perusahaan. |
| `address` | `string \| null` | Alamat. |
| `phone` | `string \| null` | Telepon. |
| `email` | `string \| null` | Email. |
| `contactPerson` | `string \| null` | Kontak. |
| `status` | `string \| null` | Teks bebas. |

## 2. Endpoint

**Authentication:** Bearer token. Permission mengikuti resource `insurance-company`.

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `GET` | `/insurance-companies` | `insurance-company:read` | Daftar, dengan `q`, `page`, `limit`. |
| `GET` | `/insurance-companies/:id` | `insurance-company:read` | Detail. |
| `POST` | `/insurance-companies` | `insurance-company:create` | Membuat perusahaan. |
| `PATCH` | `/insurance-companies/:id` | `insurance-company:update` | Mengubah perusahaan. |
| `DELETE` | `/insurance-companies/:id` | `insurance-company:delete` | Soft delete. |

**Query `GET /insurance-companies`:**

| Parameter | Default | Keterangan |
| --- | --- | --- |
| `q` | - | Mencari di `code` dan `name` (tidak peka huruf besar-kecil). |
| `page` | `1` | Halaman. |
| `limit` | `50` | Jumlah per halaman, maksimal `200`. |

Response: `{ "items": [], "total": 0, "page": 1, "limit": 50 }`.

**Body `POST`:**

```json
{
  "code": "abc",
  "name": "PT Asuransi ABC",
  "address": "Jl. Sudirman No. 1, Jakarta",
  "phone": "021-5551234",
  "email": "underwriting@abc.co.id",
  "contactPerson": "Budi",
  "status": "ACTIVE"
}
```

`code` dan `name` wajib. Kode di atas tersimpan sebagai `ABC`.

**Body `PATCH`:** field yang sama, semuanya opsional. Kirim `null` untuk mengosongkan `address`, `phone`, `email`, `contactPerson`, atau `status`.

## 3. Aturan

- `code` dirapikan (spasi dibuang) dan dijadikan huruf besar. Kode yang sudah dipakai perusahaan lain: `400 Bad Request`. Kode perusahaan yang sudah dihapus tetap terpakai, karena kolomnya unik.
- Perusahaan yang masih dipakai peserta placement aktif tidak bisa dihapus: `400 Bad Request`.
- Perusahaan tidak ditemukan atau sudah dihapus: `404 Not Found`.
- Membuat, mengubah, dan menghapus dicatat di tabel `log` dengan `referenceType = INSURANCE_COMPANY`.
