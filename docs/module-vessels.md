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

**Identitas kapal:** dihitung dari `normalizedName`, `builtYear`, dan `grossTonnage`. Dua kapal dengan kombinasi yang sama dianggap satu kapal. Field ini dihitung di server dan tidak perlu dikirim.

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
  "vesselClass": "BKI"
}
```

### 1.3 Aturan

- Kapal dengan nama, tahun bangun, dan GRT yang sama sudah ada: `400 Bad Request`.
- Mengubah nama, tahun bangun, atau GRT menghitung ulang identitas. Kalau hasilnya sudah dipakai kapal lain, `400 Bad Request`.
- Kapal yang masih punya polis aktif tidak bisa dihapus: `400 Bad Request`.

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
