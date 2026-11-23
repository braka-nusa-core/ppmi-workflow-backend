# Banks Module

Modul ini mengelola master rekening bank PPMI yang dicetak di invoice (bagian Payment). Saat invoice terbit, nama bank, nama rekening, dan nomor rekening **disalin** ke invoice, jadi perubahan master tidak mengubah invoice yang sudah terbit.

---

## 1. Data bank

| Field | Type | Keterangan |
| --- | --- | --- |
| `_id` | `string` | ID bank. |
| `name` | `string` | Nama bank, misalnya `Bank Mandiri Tbk`. Wajib. |
| `accountNumber` | `string \| null` | Nomor rekening, misalnya `157.00.44.004449`. |
| `accountName` | `string \| null` | Nama penerima (beneficiary), misalnya `PT Pandi Proteksi Marine Indonesia`. |
| `branch` | `string \| null` | Cabang. |
| `currency` | `'IDR' \| 'USD' \| null` | Mata uang rekening. Dipakai untuk menyarankan bank di draft invoice. |

## 2. Endpoint

**Authentication:** Bearer token. Permission mengikuti resource `bank`.

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `GET` | `/banks` | `bank:read` | Daftar bank. Filter `currency` (`IDR`/`USD`) dan `q` (nama, nama rekening, atau nomor rekening). |
| `GET` | `/banks/:id` | `bank:read` | Detail bank. |
| `POST` | `/banks` | `bank:create` | Membuat bank. Hanya `name` yang wajib. |
| `PATCH` | `/banks/:id` | `bank:update` | Mengubah bank. |
| `DELETE` | `/banks/:id` | `bank:delete` | Soft delete. Ditolak (`400`) selama masih dipakai invoice yang belum dihapus. |

Contoh body `POST /banks`:

```json
{
  "name": "Bank Mandiri Tbk",
  "accountNumber": "157.00.44.004449",
  "accountName": "PT Pandi Proteksi Marine Indonesia",
  "branch": "Jakarta",
  "currency": "IDR"
}
```

`GET /banks` mengembalikan array bank, diurutkan menurut nama.

## 3. Aturan

- Bank yang dihapus (`deletedAt`) tidak muncul di daftar dan tidak bisa dipilih untuk invoice baru.
- Setiap create, update, dan delete ditulis ke `Log` dengan `referenceType` `BANK`.
- Teknik hanya membaca daftar bank (`bank:read`). Finance mengelolanya.
