# Policies and Placement Module

Tahap Teknik setelah quotation disetujui insurer (`INSURANCE_APPROVED`): placement (leader, member, share), penerbitan polis, dan penyelesaian placement. Setelah itu Teknik membuat Request for Invoice (lihat `module-request-invoices.md`).

```
Quotation INSURANCE_APPROVED
  - Placement (boleh sebelum atau sesudah polis terbit)
  - Issue policy      -> quotation POLICY_ISSUED, policy POLICY_ISSUED
  - Complete placement -> policy PLACEMENT_COMPLETED
```

Placement menempel ke quotation (`PolicyParticipant.quotationId`). Baris placement baru mendapat `policyId` bila polisnya sudah ada. Saat polis terbit dan saat placement diselesaikan, peserta aktif quotation otomatis diberi `policyId`.

**Kepemilikan unit Teknik:** semua aksi tulis memeriksa `quotation.technicalUnitId`. Bila kosong, siapa pun dengan permission boleh. Bila terisi, pengguna harus SUPERADMIN atau berada di unit yang sama, kalau tidak `403 Forbidden`.

---

## 1. Placement

**Authentication:** Bearer token. Permission mengikuti resource `policy`.

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `GET` | `/quotations/:quotationId/placement` | `policy:read` | Peserta placement beserta total share. |
| `PUT` | `/quotations/:quotationId/placement` | `policy:create` | Mengganti seluruh peserta sekaligus. |

**Response `GET`:**

```json
{
  "participants": [
    {
      "_id": "...",
      "quotationId": "...",
      "policyId": null,
      "role": "LEADER",
      "share": "60",
      "orderNo": 1,
      "insuranceCompany": { "_id": "...", "code": "ABC", "name": "PT Asuransi ABC" }
    }
  ],
  "totalShare": 60,
  "isComplete": false
}
```

Urutan: LEADER dulu, lalu `orderNo`. `isComplete` bernilai `true` bila ada tepat satu leader dan total share tepat `100.00`.

**Body `PUT`:**

```json
{
  "participants": [
    { "insuranceCompanyId": "...", "role": "LEADER", "share": 60 },
    { "insuranceCompanyId": "...", "role": "MEMBER", "share": 40, "orderNo": 2 }
  ]
}
```

`orderNo` opsional, default urutan di array (mulai dari 1). Response sama dengan `GET`.

**Aturan:**
- Tepat satu `LEADER`.
- Satu perusahaan hanya boleh muncul sekali.
- Semua perusahaan harus ada dan belum dihapus.
- `share` lebih dari 0 dan maksimal 100, paling banyak 2 desimal.
- Total share tepat `100.00`. Penjumlahan memakai satuan seperseratus (`Math.round(share * 100)`), bukan float.
- Hanya boleh bila quotation `INSURANCE_APPROVED` atau `POLICY_ISSUED`, dan polis belum `PLACEMENT_COMPLETED`. Selain itu `400 Bad Request`.
- Baris lama di-soft delete dan baris baru dibuat dalam satu transaksi.
- Dicatat di tabel `log` dengan `referenceType = POLICY_PLACEMENT`.

---

## 2. Polis

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `POST` | `/quotations/:quotationId/issue-policy` | `policy:create` | Menerbitkan polis (`multipart/form-data`). |
| `GET` | `/policies` | `policy:read` | Daftar polis. |
| `GET` | `/policies/:id` | `policy:read` | Detail polis. |
| `PATCH` | `/policies/:id` | `policy:update` | Mengubah data polis. |
| `POST` | `/policies/:id/document` | `policy:update` | Upload atau ganti dokumen polis. |
| `POST` | `/policies/:id/complete-placement` | `policy:update` | Menyelesaikan placement. |

### 2.1 Issue policy

**Form `POST /quotations/:quotationId/issue-policy`:**

| Field | Wajib | Keterangan |
| --- | --- | --- |
| `policyNumber` | ya | Nomor polis. Boleh sama dengan polis lain (renewal). |
| `policyDate` | tidak | Tanggal polis. |
| `periodStart` | tidak | Awal periode. |
| `periodEnd` | tidak | Akhir periode, tidak boleh lebih awal dari `periodStart`. |
| `file` | tidak | Dokumen polis. PDF, gambar, atau dokumen Office, maksimal 50 MB. |

Field kosong dianggap tidak dikirim. File disimpan di S3 pada `policies/{quotationId}/{uuid}{ext}`.

**Aturan:**
- Quotation harus `INSURANCE_APPROVED` dan belum punya polis (satu quotation satu polis). Selain itu `400 Bad Request`.
- Dalam satu transaksi: polis dibuat (`POLICY_ISSUED`, `insuranceTypeId` dari quotation, `issuedById` pengguna), peserta placement aktif diberi `policyId`, quotation pindah ke `POLICY_ISSUED` (dijaga status lama, bila berubah bersamaan `400`), lalu riwayat dan log ditulis.
- `QuotationHistory`: action `ISSUE_POLICY`. `PolicyHistory`: `toStatus = POLICY_ISSUED`, action `ISSUE`.

### 2.2 Update dan dokumen

**Body `PATCH /policies/:id`:** `policyNumber`, `policyDate`, `periodStart`, `periodEnd`, semuanya opsional. Kirim `null` untuk mengosongkan tanggal. Hanya saat status `POLICY_ISSUED`, selain itu `400 Bad Request`.

**Form `POST /policies/:id/document`:** field `file` wajib. Menimpa `policyDocumentUrl` dan `policyDocumentName`. File lama di storage tidak dihapus.

### 2.3 Complete placement

Syarat: status polis `POLICY_ISSUED` dan placement quotation lengkap (satu leader, total `100.00`). Hasilnya status `PLACEMENT_COMPLETED`, `placementCompletedAt` terisi, peserta membawa `policyId`, riwayat (`action = COMPLETE_PLACEMENT`) dan log ditulis. Status dijaga saat update, jadi permintaan bersamaan tidak ganda.

### 2.4 Daftar dan detail

**Query `GET /policies`:**

| Parameter | Keterangan |
| --- | --- |
| `status` | `POLICY_ISSUED` atau `PLACEMENT_COMPLETED`. |
| `insuranceTypeId` | Filter jenis asuransi. |
| `quotationId` | Filter quotation. |
| `q` | Nomor polis mengandung teks (tidak peka huruf besar-kecil). |
| `page`, `limit` | Default `1` dan `50`, maksimal `200`. |

**`GET /policies/:id`** berisi data polis, ringkasan quotation (`quotationNumber`, `status`, `client`, `insuranceType`), `participants` beserta perusahaan, `totalShare`, `isComplete`, dan `histories`.

### 2.5 Data polis

| Field | Type | Keterangan |
| --- | --- | --- |
| `_id` | `string` | ID polis. |
| `quotationId` | `string` | Quotation asal (unik). |
| `policyNumber` | `string` | Nomor polis. |
| `policyDate` | `string (ISO) \| null` | Tanggal polis. |
| `periodStart` / `periodEnd` | `string (ISO) \| null` | Periode. |
| `insuranceTypeId` | `string` | Jenis asuransi. |
| `policyDocumentUrl` / `policyDocumentName` | `string \| null` | Dokumen polis. |
| `issuedById` | `string \| null` | Penerbit. |
| `placementCompletedAt` | `string (ISO) \| null` | Waktu placement selesai. |
| `status` | `string` | `POLICY_ISSUED` atau `PLACEMENT_COMPLETED`. |

Semua perubahan polis dicatat di tabel `log` dengan `referenceType = POLICY_PLACEMENT`. Polis tidak ditemukan: `404 Not Found`.
