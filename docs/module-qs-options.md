# QSheet Options Module

Modul ini menyimpan nilai pilihan untuk dropdown QSheet, misalnya Security atau Premium Warranty. User tetap memilih sendiri nilainya pada quotation; opsi hanya mengisi dropdown.

Opsi dikelompokkan dengan `group`:

| Group              | Isi awal               |
| ------------------ | ---------------------- |
| `SECURITY`         | `MSIG`, `HYDOR`, `IOM` |
| `PREMIUM_WARRANTY` | Diisi kemudian.        |

---

## 1. Data opsi

| Field       | Type             | Keterangan                                              |
| ----------- | ---------------- | ------------------------------------------------------- |
| `_id`       | `string`         | ID opsi.                                                |
| `group`     | `string`         | Nama grup, huruf besar dengan underscore.               |
| `value`     | `string`         | Nilai yang dipilih dan disimpan, spasi dirapikan.       |
| `label`     | `string \| null` | Teks tampilan bila berbeda dari `value`.                |
| `sortOrder` | `number`         | Urutan tampil, default `0`.                             |
| `isActive`  | `boolean`        | Opsi nonaktif tidak muncul di dropdown. Default `true`. |

## 2. Endpoint

**Authentication:** Bearer token. Permission mengikuti resource `qs-option`.

| Method   | Endpoint                     | Permission         | Keterangan                                                              |
| -------- | ---------------------------- | ------------------ | ----------------------------------------------------------------------- |
| `GET`    | `/qs-options?group=SECURITY` | `qs-option:read`   | Opsi aktif dari satu grup untuk dropdown. `group` wajib.                |
| `GET`    | `/qs-options/all?group=`     | `qs-option:read`   | Semua opsi termasuk yang nonaktif, untuk pengelolaan. `group` opsional. |
| `POST`   | `/qs-options`                | `qs-option:create` | Membuat opsi.                                                           |
| `PATCH`  | `/qs-options/:id`            | `qs-option:update` | Mengubah `value`, `label`, `sortOrder`, atau `isActive`.                |
| `DELETE` | `/qs-options/:id`            | `qs-option:delete` | Soft delete.                                                            |

Urutan `GET /qs-options`: `sortOrder` naik, lalu `value`. Opsi yang dihapus tidak pernah tampil.

## 3. Create dan update

```json
{
  "group": "security",
  "value": "MSIG",
  "label": "MSIG Specialty Marine NV",
  "sortOrder": 1,
  "isActive": true
}
```

- Hanya `group` dan `value` yang wajib.
- `group` dinormalkan ke huruf besar dengan underscore (`premium warranty` menjadi `PREMIUM_WARRANTY`). `value` dirapikan spasinya.
- `value` unik per grup di antara opsi yang belum dihapus, tanpa membedakan huruf besar-kecil. Pelanggaran memberi `400`.
- `PATCH` butuh minimal satu field. `group` tidak bisa diubah. `label` boleh `null`.
- Opsi yang tidak ditemukan atau sudah dihapus memberi `404`.
- Create, update, dan delete ditulis ke `Log` dengan `referenceType` `QS_TEMPLATE`.
