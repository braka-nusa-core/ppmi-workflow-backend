# P&I Module

Module P&I mengelola detail Quotation Slip P&I sebagai extension one-to-one dari `Quotation`. Status, approval, submission ke insurer, dan policy tetap memakai endpoint quotation generic.

## Endpoints

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `GET` | `/pni/clubs` | `quotation:read` | Daftar klub P&I yang aktif. |
| `GET` | `/pni/clubs/:clubCode/template` | `quotation:read` | Template P&I untuk klub. Query opsional `coverType` (`FULL` atau `LIMITED`). |
| `GET` | `/pni/quotations` | `quotation:read` | List quotation aktif yang memiliki detail P&I. |
| `POST` | `/pni/quotations` | `quotation:create` | Membuat root quotation dan detail P&I dalam satu transaction. |
| `GET` | `/pni/quotations/:quotationId` | `quotation:read` | Detail P&I lengkap. |
| `PATCH` | `/pni/quotations/:quotationId` | `quotation:update` | Patch root quotation dan aggregate P&I. |

## Klub P&I

Klub P&I diambil dari tabel `club` (lihat [Clubs](module-clubs.md)). Klub yang dipakai untuk quotation P&I:

| Code | Nama |
| --- | --- |
| `MSIG` | MSIG Specialty Marine NV |
| `EOM` | Eagle Ocean Marine |
| `HYDOR` | HYDOR |

Template P&I disimpan di `qs_template` dengan `clubId`. Saat quotation dibuat, sistem memilih template terbaru milik klub itu dan menyimpannya di `qsTemplateId`. Field `clubCode` di body dipetakan ke klub tersebut.

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
    "clubCode": "MSIG",
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

### Vessel dari master kapal

Vessel P&I dapat dihubungkan ke master kapal lewat `vesselId` (lihat [Vessels](module-vessels.md)):

```json
{ "vessels": [{ "key": "vessel-1", "vesselId": "vessel-master-id" }] }
```

- `vesselId` harus merujuk kapal master yang masih aktif, jika tidak `400 Bad Request`.
- Vessel P&I tetap menyimpan salinan (snapshot) datanya sendiri. Saat baris dibuat, field yang tidak dikirim diisi dari master (nama, IMO, tipe, tahun, flag, class, GT, port of registry). Nilai yang dikirim eksplisit selalu dipakai.
- Setelah dibuat, snapshot tidak berubah otomatis ketika master diubah, supaya dokumen lama tetap sama. Patch dengan `id` hanya mengubah field yang dikirim.
- `name` wajib kecuali `vesselId` atau `id` dikirim.
- Tanpa `vesselId`, perilaku lama tidak berubah. Vessel P&I yang sudah ada memiliki `vesselId = null`.

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

## Input QSheet (meeting 18 November 2026)

Field berikut ada di objek `pni` pada `POST` dan `PATCH /pni/quotations`, dan ikut dikembalikan oleh `GET /pni/quotations/:quotationId`. Pada `PATCH`, semuanya boleh `null` untuk mengosongkan nilai.

| Field | Type | Keterangan |
| --- | --- | --- |
| `referenceDate` | `string (tanggal) \| null` | Tanggal "Our Reference". Our Reference = `referenceDate` + `referenceNumber`, keduanya diisi manual. |
| `vesselScope` | `SINGLE \| FLEET \| null` | Satu kapal atau armada. |
| `declaredVesselCount` | `number \| null` | Jumlah kapal yang diketik user, minimal `1`. Hanya untuk `FLEET`. |
| `coverType` | `FULL \| LIMITED \| null` | Full Cover atau Limited Cover. Menentukan Conditions dan Survey Warranty yang dipakai. |
| `premiumType` | `MUTUAL \| FIX \| null` | Jenis premi. |

Aturan:

- `declaredVesselCount` hanya boleh dikirim bila `vesselScope` adalah `FLEET` (pada `PATCH`, nilai tersimpan ikut dihitung bila `vesselScope` tidak dikirim). Selain itu respons `400`.
- Mengubah `vesselScope` menjadi `SINGLE` (atau `null`) mengosongkan `declaredVesselCount` menjadi `null`.
- `quotation.voyageType` (`UNDER_VOYAGE` atau `SINGLE_VOYAGE`, boleh `null` pada `PATCH`) juga diterima di objek `quotation`. Single Voyage berarti kapal didatangkan satu kali, misalnya dari China.

### Template menurut cover type

Template dikelompokkan per klub dan per cover type (`QsTemplate.coverType`). `GET /pni/clubs/:clubCode/template?coverType=FULL` mengembalikan template klub dengan `coverType` sama atau `null` (generik), template yang cocok persis lebih dulu. Tanpa `coverType`, semua template klub dikembalikan seperti sebelumnya. Nilai selain `FULL` dan `LIMITED` ditolak dengan `400`.

Opsi dropdown QSheet (misalnya Security) diambil dari [QSheet Options](module-qs-options.md).

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
