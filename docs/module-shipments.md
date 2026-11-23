# Shipments Module

Modul ini mengelola pengiriman dokumen ke klien beserta nomor resi kurir. Dikerjakan Finance.

**Authentication:** Bearer token. Permission memakai resource `shipment` (`read`, `create`, `update`).

Alur status:

```
SHIPPED -> DELIVERED -> COMPLETED
```

| Field | Type | Keterangan |
| --- | --- | --- |
| `_id` | `string` | ID pengiriman. |
| `invoiceId` | `string` | Invoice yang dikirim. |
| `courier` | `string \| null` | Nama kurir. |
| `trackingNumber` | `string \| null` | Nomor resi. |
| `shipmentDate` | `date \| null` | Tanggal kirim. |
| `receiver` | `string \| null` | Nama penerima. |
| `receivedDate` | `date \| null` | Tanggal diterima, diisi saat `deliver`. |
| `notes` | `string \| null` | |
| `status` | `SHIPPED \| DELIVERED \| COMPLETED` | |

Dokumen (`ShipmentDocument`): `documentType` (teks bebas), `fileName`, `url`.

## Endpoint

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `POST` | `/invoices/:invoiceId/shipments` | `shipment:create` | Body `{ courier?, trackingNumber?, shipmentDate?, receiver?, notes? }`. Status `SHIPPED`. |
| `GET` | `/shipments` | `shipment:read` | Filter `status`, `invoiceId`, `page`, `limit`. Respons `{ items, total, page, limit }`. |
| `GET` | `/shipments/:id` | `shipment:read` | Detail dengan dokumen dan nomor invoice. |
| `PATCH` | `/shipments/:id` | `shipment:update` | Ubah field yang sama. Ditolak setelah `COMPLETED`. |
| `POST` | `/shipments/:id/deliver` | `shipment:update` | Body `{ receivedDate, receiver? }`. `SHIPPED` menjadi `DELIVERED`. |
| `POST` | `/shipments/:id/complete` | `shipment:update` | `DELIVERED` menjadi `COMPLETED`, dengan syarat di bawah. |
| `POST` | `/shipments/:id/documents` | `shipment:update` | Multipart `file` (maks 50 MB) dan `documentType`. Key S3 `shipments/{id}/{uuid}{ext}`. |
| `DELETE` | `/shipments/:id/documents/:documentId` | `shipment:update` | Soft delete dokumen. |

## Syarat complete

Semua harus terpenuhi, kalau tidak respons 400 dengan pesan yang menyebut kekurangannya:

1. Status pengiriman `DELIVERED`.
2. Invoice berstatus `PAID`.
3. Polis punya peserta placement, dan setiap peserta yang belum dihapus punya outgoing payment yang belum dihapus dengan status `FULLY_PAID`. Pesan menyebut perusahaan yang belum punya pembayaran dan yang belum lunas.

Perubahan status memakai `updateMany` dengan status sebelumnya sebagai syarat, jadi permintaan bersamaan tidak saling menimpa. Log `referenceType: SHIPMENT`.
