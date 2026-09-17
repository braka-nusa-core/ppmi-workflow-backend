# P&I Module

Module P&I mengelola detail Quotation Slip P&I sebagai extension one-to-one dari `Quotation`. Status, approval, submission ke insurer, dan policy tetap memakai endpoint quotation generic.

## Endpoints

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `GET` | `/pni/club-formats` | `quotation:read` | Daftar format club P&I. |
| `GET` | `/pni/club-formats/:clubFormat/template` | `quotation:read` | Template aktif untuk club format. |
| `GET` | `/pni/quotations` | `quotation:read` | List quotation aktif yang memiliki detail P&I. |
| `POST` | `/pni/quotations` | `quotation:create` | Membuat root quotation dan detail P&I dalam satu transaction. |
| `GET` | `/pni/quotations/:quotationId` | `quotation:read` | Detail P&I lengkap. |
| `PATCH` | `/pni/quotations/:quotationId` | `quotation:update` | Patch root quotation dan aggregate P&I. |

## Club Format

| Code | Label Dokumen |
| --- | --- |
| `INIGO_SYNDICATE_1301` | `(Inigo Syndicate 1301)` |
| `EAGLE_OCEAN_MARINE` | `(Eagle Ocean Marine / American S.O. Mutual P&I Assoc.)` |
| `MSIG_SPECIALTY_MARINE_NV` | `(MSIG Europe / MSIG Specialty Marine NV)` |

## Create P&I Quotation

`POST /pni/quotations` membuat `Quotation`, `PniQuotation`, history, log audit, dan seluruh child P&I dalam satu transaction.

```json
{
  "quotation": {
    "clientId": "client-id",
    "insuranceTypeId": "insurance-type-id",
    "insured": "PT Example Shipping"
  },
  "pni": {
    "clubFormat": "INIGO_SYNDICATE_1301",
    "referenceNumber": "SO20262055",
    "validityDays": 30,
    "broker": "PT. Pandi Proteksi Marine Indonesia"
  },
  "vessels": [
    {
      "key": "vessel-1",
      "name": "ANGGREK 09",
      "vesselType": "Barge",
      "grossTonnage": 800
    }
  ],
  "insuranceBlocks": [
    {
      "key": "main-pi",
      "typeOfInsurance": "Shipowners' P&I",
      "maximumInsured": 10000000,
      "premium": 8500,
      "currency": "USD"
    }
  ]
}
```

`key` adalah referensi sementara dalam request yang sama. Key dapat digunakan oleh vessel coverage, provision, deductible, dan cover restriction untuk merujuk child record baru. Setelah record ada, gunakan `id` pada request patch berikutnya.

## Aggregate P&I

`GET /pni/quotations/:quotationId` dan payload patch dapat mencakup:

| Resource | Fungsi |
| --- | --- |
| `vessels` | Vessel P&I, termasuk IMO, class, GT, flag, dan port of registry. |
| `insuranceBlocks` | Satu atau lebih Type of Insurance block. |
| `vesselCoverages` | Premium/limit yang terkait vessel dan insurance block. |
| `provisions` | Condition, clause, exclusion, atau warranty. |
| `deductibles` | Deductible flat, claim-category, all vessels, atau selected vessels. |
| `installments` | Instalment terstruktur. |
| `requiredDocuments` | Checklist required documents. |
| `organizationRoles` | Organisation and role pada format Eagle Ocean. |
| `coverRestrictions` | Cover restricted to pada format MSIG. |

`insuranceBlocks` mendukung inheritance dengan `inheritsFromBlockRef`. Hal ini digunakan untuk War P&I yang mewarisi field main P&I. Nilai `premium: 0` valid untuk block War P&I.

## Scope Vessel

Provision dan deductible mendukung scope berikut:

| Scope | Arti |
| --- | --- |
| `QUOTE` | Berlaku pada quotation secara umum. |
| `ALL_VESSELS` | Berlaku untuk seluruh vessel dalam quotation. |
| `SELECTED_VESSELS` | Berlaku hanya pada `vesselRefs` yang diberikan. |

`SELECTED_VESSELS` wajib memiliki minimal satu vessel reference. Scope lain tidak menerima vessel reference.

## Patch dan Penghapusan

`PATCH /pni/quotations/:quotationId` bersifat upsert untuk child array yang dikirim. Record yang tidak dikirim tidak dihapus otomatis.

Gunakan `remove` untuk penghapusan eksplisit:

```json
{
  "remove": {
    "vesselIds": ["vessel-id"],
    "insuranceBlockIds": ["block-id"],
    "provisionIds": ["provision-id"],
    "deductibleIds": ["deductible-id"],
    "installmentIds": ["installment-id"]
  }
}
```

Mutasi P&I hanya diperbolehkan pada quotation berstatus `DRAFT` atau `REVISION` dan mengikuti ownership unit Teknik quotation.

## Workflow

Setelah detail P&I lengkap, workflow tetap menggunakan endpoint generic:

```text
POST /quotations/:id/submit
POST /quotations/:id/approve
POST /quotations/:id/send-to-insurance
```

Daftar field dan karakter struktur per club dirujuk dari [`club-format.md`](../club-format.md). Renderer/export Word per format club belum diimplementasikan.
