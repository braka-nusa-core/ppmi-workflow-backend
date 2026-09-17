# Cargo Module

Module Cargo mengelola detail Marine Cargo pada quotation existing. Root quotation dibuat melalui `POST /quotations` dengan `InsuranceType.code` bernilai `CARGO`.

## Endpoints

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `GET` | `/cargo/template` | `quotation:read` | Mengambil template Cargo aktif. |
| `POST` | `/cargo/quotations/:quotationId` | `quotation:update` | Membuat detail Cargo. |
| `GET` | `/cargo/quotations/:quotationId` | `quotation:read` | Mengambil detail Cargo dan firm assignment. |
| `PATCH` | `/cargo/quotations/:quotationId` | `quotation:update` | Mengubah detail Cargo. |

## Detail Cargo

```json
{
  "interestInsured": "Machinery spare parts",
  "voyageFrom": "Jakarta",
  "voyageTo": "Surabaya",
  "etd": "2026-10-01",
  "eta": "2026-10-03",
  "conveyance": "MV Example",
  "instituteCargoClause": "INSTITUTE_CARGO_A",
  "adjusterIds": ["adjuster-id"],
  "surveyorIds": ["surveyor-id"]
}
```

Nilai valid `instituteCargoClause`:

```text
INSTITUTE_CARGO_A
INSTITUTE_CARGO_B
INSTITUTE_CARGO_C
INSTITUTE_BULK_OIL
INSTITUTE_COAL
INSTITUTE_CARGO_AIR
```

Aturan:

- Quotation harus memiliki `InsuranceType.code = CARGO`.
- Detail Cargo hanya dapat dibuat satu kali untuk setiap quotation aktif.
- Create dan patch hanya tersedia pada status `DRAFT` atau `REVISION`.
- `adjusterIds` dan `surveyorIds`, bila dikirim, mengganti assignment secara eksplisit.
- Adjuster dan surveyor harus merupakan master data aktif.

## Template UI-Only

Template Cargo dikembalikan untuk dipakai frontend. Server tidak otomatis menambahkan base clause atau additional clause ke quotation.

Frontend menyimpan additional clause melalui endpoint quotation terms:

```text
POST /quotations/:quotationId/terms
PATCH /quotations/:quotationId/terms/:id
```

Base Cargo Clause disimpan pada `CargoQuotation.instituteCargoClause`; ini adalah sumber utama single-select, bukan kumpulan term yang bebas dipilih.

## Submit Validation

Saat `POST /quotations/:id/submit`:

- Detail Cargo wajib tersedia.
- Tepat satu base Cargo Clause wajib telah dipilih melalui `instituteCargoClause`.

Requirement belum memastikan apakah additional Cargo clauses selalu diterapkan atau selectable per quotation. API tidak memaksakan salah satu perilaku tersebut.

Field Cargo dan daftar additional clause sumber dirujuk dari [`markdown/hm-cargo-requirement.md`](../markdown/hm-cargo-requirement.md).
