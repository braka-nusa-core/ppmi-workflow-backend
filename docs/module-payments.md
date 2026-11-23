# Payments Module

Modul ini mengelola pembayaran dari klien (incoming payment, AR) dan pembayaran ke penanggung (outgoing payment, AP). Dikerjakan Finance.

**Authentication:** Bearer token. Permission memakai resource `payment` (`read`, `create`, `update`).

Catatan: tabel `IncomingPaymentInstallment` **tidak dipakai**. Satu `IncomingPayment` adalah satu pembayaran yang diterima. Beberapa pembayaran pada satu invoice membentuk cicilan.

Semua jumlah uang dihitung dengan `Decimal` (tanpa float) dan dikirim sebagai angka atau string dengan maksimal 2 desimal. Respons mengembalikan nilai uang sebagai string.

---

## 1. Incoming payment (dari klien)

| Field | Type | Keterangan |
| --- | --- | --- |
| `_id` | `string` | ID pembayaran. |
| `invoiceId` | `string` | Invoice yang dibayar. |
| `paymentDate` | `date` | Tanggal pembayaran diterima. |
| `amount` | `decimal` | Jumlah, lebih dari 0, maksimal 2 desimal. |
| `currency` | `string` | Disalin dari invoice. |
| `paymentMethod` | `string \| null` | Teks bebas, misalnya `TRANSFER`. |
| `bankId` | `string \| null` | Bank penerima. |
| `receiptNumber` | `string \| null` | Nomor kuitansi. Dibuat otomatis `RCPT-YYYYMMDD-NNN` bila tidak dikirim. |
| `proofOfPaymentUrl` | `string \| null` | Bukti pembayaran di S3. |
| `status` | `PAID \| REFUNDED` | |
| `notes` | `string \| null` | |
| `recordedById` | `string` | User yang mencatat. |

### Endpoint

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `GET` | `/invoices/:invoiceId/incoming-payments` | `payment:read` | Daftar pembayaran dan ringkasan `{ balanceDue, paid, remaining, status }`. |
| `POST` | `/invoices/:invoiceId/incoming-payments` | `payment:create` | Catat pembayaran. |
| `POST` | `/incoming-payments/:id/proof` | `payment:update` | Unggah bukti (multipart `file`, PDF atau gambar, maks 50 MB). Key S3 `payments/incoming/{id}/{uuid}{ext}`. |
| `PATCH` | `/incoming-payments/:id` | `payment:update` | Ubah `paymentDate`, `amount`, `paymentMethod`, `bankId`, `receiptNumber`, `notes`. |
| `POST` | `/incoming-payments/:id/refund` | `payment:update` | Status menjadi `REFUNDED`. |
| `DELETE` | `/incoming-payments/:id` | `payment:update` | Soft delete. |

### Aturan

- Invoice harus ada, tidak terhapus, dan belum `PAID`.
- `amount` tidak boleh melebihi sisa tagihan: `balanceDue` dikurangi jumlah pembayaran `PAID` yang belum dihapus. Saat `PATCH`, pembayaran itu sendiri tidak ikut dihitung. Jumlah pembayaran `REFUNDED` tidak bisa diubah.
- Setelah setiap tulis (create, update, refund, delete), dalam transaksi yang sama, status invoice dihitung ulang dari pembayaran `PAID` yang belum dihapus: 0 menjadi `UNPAID`, di bawah `balanceDue` menjadi `PARTIALLY_PAID`, sama atau lebih menjadi `PAID`. Fungsinya `recomputeInvoiceStatus` di `src/payments/payment.util.ts`.
- Baris invoice dikunci selama transaksi agar dua pembayaran bersamaan tidak sama-sama lolos pengecekan sisa.
- Log `referenceType: INCOMING_PAYMENT`.
- Daftar pembayaran (`GET /invoices/:invoiceId/incoming-payments`) membawa `amountInWords` per pembayaran, dengan kalimat yang sama seperti invoice (IDR atau USD; mata uang lain `null`).
- Invoice tanpa `balanceDue` tidak bisa menerima pembayaran, dan tidak pernah berstatus `PAID`.

---

## 2. Outgoing payment (ke penanggung)

Satu pembayaran per peserta placement (`PolicyParticipant`). Peserta dicari lewat `quotationId` milik polis.

| Field | Type | Keterangan |
| --- | --- | --- |
| `policyParticipantId` | `string` | Peserta placement. Satu pembayaran aktif per peserta. |
| `amount` | `decimal` | Jumlah yang harus dibayar, diisi manual. |
| `currency` | `string` | Default mata uang invoice, jika belum ada invoice `IDR`. |
| `status` | `WAITING_PAYMENT \| PARTIAL_PAYMENT \| FULLY_PAID` | Dihitung dari cicilan. |
| `notes` | `string \| null` | |

Cicilan (`OutgoingInstallment`): `installmentOrder`, `amount`, `paymentDate`, `proofOfPaymentUrl`, `notes`.

### Endpoint

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `GET` | `/policies/:policyId/outgoing-payments` | `payment:read` | Semua peserta placement beserta perusahaan, `share`, pembayaran (dengan cicilan dan `paid`), dan `suggestedAmount`. |
| `POST` | `/policies/:policyId/outgoing-payments` | `payment:create` | Body `{ policyParticipantId, amount, currency?, notes? }`. |
| `PATCH` | `/outgoing-payments/:id` | `payment:update` | Ubah `amount` (tidak di bawah jumlah yang sudah dibayar), `currency`, `notes`. |
| `POST` | `/outgoing-payments/:id/installments` | `payment:create` | Body `{ amount, paymentDate, notes? }`. Total cicilan tidak boleh melebihi `amount`. |
| `POST` | `/outgoing-installments/:id/proof` | `payment:update` | Unggah bukti. Key S3 `payments/outgoing/{id}/{uuid}{ext}`. |
| `DELETE` | `/outgoing-installments/:id` | `payment:update` | Soft delete cicilan. |

### Aturan

- `suggestedAmount` = `share` x `nettPremium` / 100, dibulatkan 2 desimal, dari invoice polis yang belum dihapus (Policy, RequestInvoice, Invoice). `null` bila belum ada invoice. Hanya saran, nominal diisi manual.
- Peserta harus milik quotation polis ini dan belum dihapus. Peserta yang sudah punya pembayaran aktif ditolak (409).
- Setelah setiap tulis, status dihitung ulang dari cicilan yang belum dihapus: 0 menjadi `WAITING_PAYMENT`, di bawah `amount` menjadi `PARTIAL_PAYMENT`, sama menjadi `FULLY_PAID`. Fungsinya `recomputeOutgoingStatus`.
- Log `referenceType: OUTGOING_PAYMENT` dengan `referenceId` id pembayaran.
- `GET /policies/:policyId/outgoing-payments` membawa `amountInWords` untuk setiap pembayaran keluar dan setiap cicilannya.

---

## 3. Berkas

`payment.util.ts` (fungsi hitung status, penjumlahan Decimal), `incoming-payments.*`, `outgoing-payments.*`, `payments.validation.ts`, `payments.module.ts` (`PaymentsModule`).
