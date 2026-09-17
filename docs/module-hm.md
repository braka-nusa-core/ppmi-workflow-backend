# H&M Module

Module H&M mengelola detail Marine Hull & Machinery pada quotation existing. Root quotation dibuat melalui `POST /quotations` dengan `InsuranceType.code` bernilai `HM`.

## Endpoints

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `GET` | `/hm/template` | `quotation:read` | Mengambil template H&M aktif. |
| `POST` | `/hm/quotations/:quotationId` | `quotation:update` | Membuat detail H&M. |
| `GET` | `/hm/quotations/:quotationId` | `quotation:read` | Mengambil detail H&M, instalment, dan firm assignment. |
| `PATCH` | `/hm/quotations/:quotationId` | `quotation:update` | Mengubah detail H&M. |

## Detail H&M

```json
{
  "vesselType": "Tug Boat",
  "tradingWarranty": "Indonesian Waters",
  "premiumPaymentEnabled": true,
  "brokerageEnabled": true,
  "installments": [
    { "installmentNo": 1, "percentage": 25, "dueAfterDays": 30 },
    { "installmentNo": 2, "percentage": 25, "dueAfterDays": 60 },
    { "installmentNo": 3, "percentage": 25, "dueAfterDays": 90 },
    { "installmentNo": 4, "percentage": 25, "dueAfterDays": 120 }
  ],
  "adjusterIds": ["adjuster-id"],
  "surveyorIds": ["surveyor-id"]
}
```

Aturan:

- Quotation harus memiliki `InsuranceType.code = HM`.
- Detail H&M hanya dapat dibuat satu kali untuk setiap quotation aktif.
- Create dan patch hanya tersedia pada status `DRAFT` atau `REVISION`.
- Jika `installments` dikirim, daftar tersebut menggantikan schedule aktif secara eksplisit.
- Jika `adjusterIds` atau `surveyorIds` dikirim, assignment terkait diganti secara eksplisit.
- Adjuster dan surveyor harus merupakan master data aktif.

## Template UI-Only

Template H&M hanya dikembalikan untuk dipakai frontend. Server tidak otomatis membuat clause, warranty, installment, atau firm assignment dari template.

Frontend menggunakan endpoint quotation generic untuk membuat terms dan warranties:

```text
POST /quotations/:quotationId/terms
POST /quotations/:quotationId/warranties
```

Terms mendukung `section`, `sortOrder`, `isSelected`, `isEditable`, `isRemovable`, `selectionGroup`, dan `conditionRule`. Ini digunakan untuk H&M clause yang editable, removable, atau conditional.

## Submit Validation

Saat `POST /quotations/:id/submit`:

- Detail H&M wajib tersedia.
- Jika `premiumPaymentEnabled` bernilai `true`, harus terdapat tepat empat instalment aktif.

Field H&M dan daftar clause/warranty sumber dirujuk dari [`markdown/hm-cargo-requirement.md`](../markdown/hm-cargo-requirement.md). Full legal wording clause tidak dibuat oleh API.
