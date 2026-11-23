# Vessels and Vessel Policies Module

Modul ini mengelola master kapal (`Vessel`) dan polis per periode (`VesselPolicy`). Satu kapal bisa punya banyak polis dari tahun ke tahun. Satu klien bisa punya banyak kapal melalui polisnya.

Relasi:

```
Client (1) -> VesselPolicy (banyak) -> Vessel (1)
```

Pemilik kapal per periode disimpan di `VesselPolicy.clientId`. Kapal tidak punya klien langsung, karena pemilik bisa berganti.

---

## 1. Vessel

### 1.1 Data kapal

| Field | Type | Keterangan |
| --- | --- | --- |
| `_id` | `string` | ID kapal. |
| `name` | `string` | Nama kapal, disimpan apa adanya (spasi dirapikan). |
| `normalizedName` | `string` | Nama huruf besar, spasi dirapikan. Dipakai untuk pencarian. |
| `vesselType` | `string \| null` | Tipe kapal, misalnya `TUG BOAT`. |
| `builtYear` | `number \| null` | Tahun bangun. |
| `grossTonnage` | `number \| null` | GRT. |
| `vesselClass` | `string \| null` | Klas, misalnya `BKI`. |
| `classNotApplicable` | `boolean` | `true` bila klas tidak berlaku. Default `false`. |
| `imoNumber` | `string \| null` | Nomor IMO. Belum dipakai untuk identitas kapal. |
| `flag` | `string \| null` | Bendera. |
| `tradingArea` | `string \| null` | Area operasi kapal, teks bebas. Berbeda dengan `tradingArea` pada insurance block P&I, yaitu area yang dijamin pada quotation. |
| `portOfRegistry` | `string \| null` | Pelabuhan pendaftaran. |

**Identitas kapal:** dihitung dari `normalizedName`, `builtYear`, dan `grossTonnage`. Dua kapal dengan kombinasi yang sama dianggap satu kapal. Field ini dihitung di server dan tidak perlu dikirim. Field lain (IMO, flag, trading area, dan seterusnya) tidak memengaruhi identitas.

### 1.2 Endpoint

**Authentication:** Bearer token. Permission mengikuti resource `vessel`.

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `GET` | `/vessels` | `vessel:read` | Daftar kapal, dengan `q`, `page`, dan `limit`. |
| `GET` | `/vessels/:id` | `vessel:read` | Detail kapal, beserta polis aktifnya. |
| `POST` | `/vessels` | `vessel:create` | Membuat kapal. |
| `PATCH` | `/vessels/:id` | `vessel:update` | Mengubah kapal. |
| `DELETE` | `/vessels/:id` | `vessel:delete` | Soft delete kapal. |

**Query `GET /vessels`:**

| Parameter | Default | Keterangan |
| --- | --- | --- |
| `q` | - | Filter nama (tidak peka huruf besar-kecil). |
| `page` | `1` | Halaman. |
| `limit` | `50` | Jumlah per halaman, maksimal `200`. |

Response:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 50
}
```

**Body `POST /vessels`:**

```json
{
  "name": "BUANA HARBOUR 3201",
  "vesselType": "HARBOUR TUG",
  "builtYear": 2018,
  "grossTonnage": 354,
  "vesselClass": "BKI",
  "imoNumber": "9876543",
  "flag": "Indonesia",
  "tradingArea": "Indonesia",
  "portOfRegistry": "Jakarta"
}
```

### 1.3 Aturan

- Kapal dengan nama, tahun bangun, dan GRT yang sama sudah ada: `400 Bad Request`.
- Mengubah nama, tahun bangun, atau GRT menghitung ulang identitas. Kalau hasilnya sudah dipakai kapal lain, `400 Bad Request`.
- Kapal yang masih punya polis aktif tidak bisa dihapus: `400 Bad Request`.

### 1.4 Dokumen dan foto kapal

Dokumen dan foto disimpan per kapal. Foto adalah dokumen dengan kategori `PHOTO`, dan satu kapal boleh punya banyak foto. File disimpan di storage S3 lewat `StorageService`. Lampiran quotation tidak berubah dan tetap terpisah.

**Authentication:** Bearer token. Permission mengikuti resource `vessel`.

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `GET` | `/vessels/:vesselId/documents` | `vessel:read` | Daftar dokumen, filter `category`. |
| `POST` | `/vessels/:vesselId/documents` | `vessel:update` | Upload file (`multipart/form-data`). |
| `PATCH` | `/vessels/:vesselId/documents/:id` | `vessel:update` | Ubah metadata. |
| `DELETE` | `/vessels/:vesselId/documents/:id` | `vessel:update` | Soft delete. |

**Data dokumen:**

| Field | Type | Keterangan |
| --- | --- | --- |
| `_id` | `string` | ID dokumen. |
| `vesselId` | `string` | Kapal pemilik dokumen. |
| `category` | `string` | Teks bebas, disimpan huruf besar dengan spasi menjadi `_` (misalnya `SURAT_LAUT`, `PHOTO`). Default `OTHER`. |
| `title` | `string \| null` | Judul. |
| `fileName` | `string` | Nama file asli. |
| `fileUrl` | `string` | URL file di storage. |
| `mimeType` | `string \| null` | Tipe file. |
| `fileSize` | `number \| null` | Ukuran dalam byte. |
| `documentDate` | `string (ISO) \| null` | Tanggal dokumen. |
| `validFrom` | `string (ISO) \| null` | Mulai berlaku. |
| `validUntil` | `string (ISO) \| null` | Kedaluwarsa. |
| `status` | `string` | Teks bebas, default `AVAILABLE`. |
| `note` | `string \| null` | Catatan. |
| `uploadedById` | `string \| null` | Pengunggah. |

**Form `POST`:** field `file` wajib. Field lain (`category`, `title`, `documentDate`, `validFrom`, `validUntil`, `status`, `note`) opsional. Field kosong dianggap tidak dikirim.

**Body `PATCH`:** JSON dengan field metadata di atas. Kirim `null` untuk mengosongkan `title`, tanggal, atau `note`.

**Aturan:**
- Kategori dan status berupa teks bebas karena daftar dokumen resmi belum final. Dokumen apa pun bisa diunggah.
- File maksimal 50 MB. Tipe yang diterima: PDF, gambar, dan dokumen Office.
- `validUntil` tidak boleh lebih awal dari `validFrom`: `400 Bad Request`.
- Kapal tidak ditemukan atau sudah dihapus, atau dokumen bukan milik kapal itu: `404 Not Found`.
- Upload, ubah, dan hapus dicatat di tabel `log` dengan `referenceType = VESSEL`.
- Menghapus dokumen hanya soft delete. File di storage tidak dihapus.

### 1.5 Survey kapal

Survey dicatat per kapal. Perusahaan surveyor memakai master `Surveyor` yang sudah ada. Laporan survey adalah dokumen kapal (bagian 1.4) yang ditautkan lewat `reportDocumentId`.

**Authentication:** Bearer token. Permission mengikuti resource `vessel`.

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `GET` | `/vessels/:vesselId/surveys` | `vessel:read` | Daftar survey, filter `status`. |
| `GET` | `/vessels/:vesselId/surveys/:id` | `vessel:read` | Detail survey. |
| `POST` | `/vessels/:vesselId/surveys` | `vessel:update` | Buat survey (penunjukan atau rencana). |
| `PATCH` | `/vessels/:vesselId/surveys/:id` | `vessel:update` | Ubah survey. |
| `DELETE` | `/vessels/:vesselId/surveys/:id` | `vessel:update` | Soft delete. |

```json
{
  "surveyorId": "surveyor-id",
  "quotationId": "quotation-id",
  "surveyType": "Condition survey",
  "status": "nominated",
  "nominatedAt": "2026-11-01",
  "surveyDate": "2026-11-10",
  "reportDate": "2026-11-12",
  "validUntil": "2027-11-10",
  "reportDocumentId": "vessel-document-id",
  "note": "Survey untuk renewal H&M"
}
```

**Aturan:**
- Semua field opsional. `status` berupa teks bebas (huruf besar, spasi menjadi `_`), default `PLANNED`, karena daftar status resmi belum ada.
- `surveyorId` dan `quotationId` harus masih aktif. `reportDocumentId` harus dokumen milik kapal yang sama: `400 Bad Request`.
- `validUntil` tidak boleh lebih awal dari `surveyDate`: `400 Bad Request`.
- Survey yang `validUntil`-nya mendekati jatuh tempo masuk reminder, kecuali berstatus `CANCELLED`.
- Perubahan dicatat di `log` dengan `referenceType = VESSEL_SURVEY`.

---

## 2. Vessel Policy

### 2.1 Data polis

| Field | Type | Keterangan |
| --- | --- | --- |
| `_id` | `string` | ID polis. |
| `vesselId` | `string` | Kapal. |
| `clientId` | `string` | Tertanggung pada periode ini. |
| `policyNumber` | `string \| null` | Nomor polis, sudah dinormalisasi. |
| `policyNumberRaw` | `string \| null` | Nomor polis asli. |
| `insuredRaw` | `string \| null` | Teks tertanggung asli, termasuk bagian setelah `QQ`. |
| `periodRaw` | `string \| null` | Teks periode asli. |
| `periodStart` | `string (ISO) \| null` | Tanggal mulai. |
| `periodEnd` | `string (ISO) \| null` | Tanggal selesai. |
| `clubCode` | `string \| null` | Kode klub, huruf besar. |
| `clubRaw` | `string \| null` | Nama klub asli. |
| `status` | `string \| null` | `ON`, `NEW_VESSEL`, `OFF`, `CANCEL`, atau `SELL`. |
| `statusRaw` | `string \| null` | Status asli. |

**Identitas polis:** dihitung dari kapal, `policyNumber`, dan `periodStart`. Dua polis dengan kombinasi yang sama ditolak. Nomor polis tidak unik secara global, karena nomor yang sama bisa dipakai kapal berbeda.

### 2.2 Endpoint

**Authentication:** Bearer token. Permission mengikuti resource `vessel-policy`.

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `GET` | `/vessel-policies` | `vessel-policy:read` | Daftar polis, dengan filter. |
| `GET` | `/vessel-policies/:id` | `vessel-policy:read` | Detail polis. |
| `POST` | `/vessel-policies` | `vessel-policy:create` | Membuat polis. |
| `PATCH` | `/vessel-policies/:id` | `vessel-policy:update` | Mengubah polis. |
| `DELETE` | `/vessel-policies/:id` | `vessel-policy:delete` | Soft delete polis. |

**Query `GET /vessel-policies`:**

| Parameter | Keterangan |
| --- | --- |
| `clientId` | Polis milik klien tertentu. Dipakai untuk "kapal aktif per klien". |
| `vesselId` | Polis untuk kapal tertentu. |
| `status` | Filter status. |
| `expiringWithinDays` | Polis yang `periodEnd`-nya jatuh dalam N hari ke depan. Dipakai untuk polis yang akan jatuh tempo. |
| `page` | Default `1`. |
| `limit` | Default `50`, maksimal `200`. |

**Body `POST /vessel-policies`:**

```json
{
  "vesselId": "vessel-id",
  "clientId": "client-id",
  "policyNumber": "50017227/2026",
  "periodStart": "2026-01-04",
  "periodEnd": "2027-01-04",
  "clubCode": "MSIG",
  "status": "ON"
}
```

`vesselId` dan `clientId` wajib, dan keduanya harus masih aktif.

### 2.3 Aturan

- `policyNumber` dinormalisasi: spasi dibuang, awalan `NO.` dihapus, `*` diganti `-`, dan `O` di antara angka menjadi `0`.
- `clubCode` dinormalisasi ke huruf besar. Tidak ada validasi terhadap tabel `club`, karena klub di polis bisa berbeda dengan klub untuk template P&I.
- Polis yang sudah ada dengan kombinasi kapal, nomor polis, dan tanggal mulai yang sama: `400 Bad Request`.
- Mengubah `policyNumber` atau `periodStart` menghitung ulang identitas polis, dan kombinasi yang sudah dipakai ditolak.

---

## 3. Audit Log

Setiap create, update, dan delete dicatat di tabel `log`:
- Kapal: `referenceType = VESSEL`.
- Polis: `referenceType = VESSEL_POLICY`.
