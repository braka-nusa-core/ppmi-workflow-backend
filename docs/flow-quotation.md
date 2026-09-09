# Flow Quotation Slip

Dokumen ini adalah kontrak teknis aktif untuk modul Quotation Slip (QS). Baseline bisnisnya adalah `flow-v2.md`; jika terdapat perbedaan, `flow-v2.md` berlaku.

## Scope

QS mencakup proses dari pembuatan oleh Teknik sampai keputusan review insurance. Setelah insurance menyetujui QS, module Policy harus menerbitkan policy number dan dokumen polis sebelum workflow dapat meneruskan ke placement.

```text
Client Request
  -> QS dibuat oleh Teknik H&M/P&I/Cargo
  -> Approval Supervisor Teknik
  -> Export dan kirim ke perusahaan asuransi
  -> Insurance review
  -> Revisi atau insurance approval
  -> Policy issuance (module Policy)
```

## State Machine

```text
+-------+    submit    +------------------+   approve   +----------+
| DRAFT | -----------> | WAITING_APPROVAL | ----------> | APPROVED |
+-------+              +------------------+             +----------+
   ^                           |                               |
   | reject / revision         |                               | send
   +---------------------------+                               v
                                                     +-------------------+
                                                     | SENT_TO_INSURANCE |
                                                     +-------------------+
                                                       |             |
                                             revision  |             | approve
                                                       v             v
                                                +----------+  +--------------------+
                                                | REVISION |  | INSURANCE_APPROVED |
                                                +----------+  +--------------------+
                                                     |                |
                                      edit + submit  |                | Policy module
                                                     v                v
                                            WAITING_APPROVAL   POLICY_ISSUED
```

`INSURANCE_APPROVED` berarti keputusan insurer sudah dicatat. Status ini bukan bukti polis telah terbit. `POLICY_ISSUED` hanya boleh ditetapkan dalam transaksi yang juga membuat record Policy dengan policy number dan dokumen polis.

### Aturan Sementara Revisi Insurance

Aturan sementara yang diterapkan adalah jalur konservatif: setelah insurer meminta revisi, Teknik harus mengubah QS lalu memperoleh approval Supervisor Teknik lagi sebelum mengirim ulang QS.

```text
REVISION -> edit QS -> WAITING_APPROVAL -> APPROVED -> SENT_TO_INSURANCE
```

Aturan ini diisolasi pada `REQUIRES_SUPERVISOR_APPROVAL_AFTER_INSURER_REVISION` di `src/quotations/quotations.constants.ts`. Stakeholder harus mengonfirmasi aturan final sebelum nilai ini diubah.

## Role dan Permission

| Aksi                                   | Permission                                        | Pelaksana                         |
| -------------------------------------- | ------------------------------------------------- | --------------------------------- |
| Buat/edit QS dan child data            | `quotation:create`, `quotation:update`            | Teknik H&M, P&I, Cargo pemilik QS |
| Submit QS                              | `quotation:submit`                                | Teknik pemilik QS                 |
| Approve, reject, minta revisi internal | `quotation:approve`                               | Supervisor Teknik                 |
| Export dan kirim QS                    | `quotation:export`, `quotation:send-to-insurance` | Teknik pemilik QS                 |
| Catat keputusan insurer                | `quotation:record-insurer-review`                 | Petugas internal berwenang        |

QS baru dibuat oleh user yang terdaftar pada department H&M, P&I, atau Cargo di bawah division Teknik. Sistem menyimpan `technicalUnitId` pada QS dan membatasi mutasi QS serta child data ke unit pemilik. `SUPERADMIN` tetap dapat melewati pemeriksaan ownership untuk QS yang sudah ada.

## Data Utama

| Entity                                                                                              | Tanggung jawab                                                                             |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `Quotation`                                                                                         | Data QS, status, client, insurance type, unit Teknik pemilik, dan actor creation/approval. |
| `QuotationObject`, `QuotationCoverage`, `QuotationTerm`, `QuotationWarranty`, `QuotationAttachment` | Detail teknis QS.                                                                          |
| `QuotationApproval`                                                                                 | Keputusan Supervisor Teknik: approved, rejected, atau revision request.                    |
| `QuotationHistory`                                                                                  | Riwayat seluruh transition status dan actor internal.                                      |
| `QuotationSubmission`                                                                               | Pengiriman QS ke perusahaan asuransi, termasuk snapshot QS immutable.                      |
| `InsuranceReview`                                                                                   | Keputusan insurer yang dicatat oleh petugas internal.                                      |

## Transition

| Dari                | Endpoint                                  | Ke                   | Ketentuan                                                   |
| ------------------- | ----------------------------------------- | -------------------- | ----------------------------------------------------------- |
| `DRAFT`             | `POST /quotations/:id/submit`             | `WAITING_APPROVAL`   | QS disubmit oleh unit Teknik pemilik.                       |
| `WAITING_APPROVAL`  | `POST /quotations/:id/approve`            | `APPROVED`           | Hanya Supervisor Teknik.                                    |
| `WAITING_APPROVAL`  | `POST /quotations/:id/reject`             | `DRAFT`              | Hanya Supervisor Teknik.                                    |
| `WAITING_APPROVAL`  | `POST /quotations/:id/request-revision`   | `DRAFT`              | Hanya Supervisor Teknik.                                    |
| `APPROVED`          | `POST /quotations/:id/send-to-insurance`  | `SENT_TO_INSURANCE`  | Wajib menyertakan perusahaan asuransi penerima.             |
| `SENT_TO_INSURANCE` | `POST /quotations/:id/insurance-approve`  | `INSURANCE_APPROVED` | Mencatat keputusan insurer pada submission pending.         |
| `SENT_TO_INSURANCE` | `POST /quotations/:id/insurance-revision` | `REVISION`           | Menandai waktu permintaan revisi.                           |
| `REVISION`          | `POST /quotations/:id/submit`             | `WAITING_APPROVAL`   | Ditolak bila belum ada perubahan QS setelah revisi insurer. |

## Pengiriman ke Insurance

`POST /quotations/:id/send-to-insurance` hanya dapat dilakukan untuk QS `APPROVED` dan memerlukan payload berikut:

```json
{
  "insuranceCompanyId": "clx...insurance-company",
  "note": "Dikirim ke underwriting"
}
```

Setiap pengiriman membuat `QuotationSubmission` dengan:

- Perusahaan asuransi penerima.
- Pengirim dan waktu pengiriman.
- Catatan pengiriman.
- Snapshot immutable QS, child data aktif, client, insurance type, dan attachment yang dikirim.

`insurance-approve` dan `insurance-revision` menulis `InsuranceReview` pada submission pending terakhir. Keputusan insurer tidak dicatat sebagai `QuotationApproval`, karena approval tersebut khusus untuk Supervisor Teknik.

## Aturan Konten dan Dokumen

- Root QS dan seluruh child data hanya dapat diubah pada `DRAFT` atau `REVISION`.
- QS approved, sent, atau insurance-approved tidak dapat diubah melalui endpoint child data.
- Setiap perubahan ketika status `REVISION` menandai QS sebagai sudah diperbaiki.
- Submit ulang dari `REVISION` ditolak sampai perubahan tersebut tercatat setelah waktu revision request dari insurer.
- Export hanya diizinkan pada QS `APPROVED`.
- Endpoint export masih placeholder. Snapshot submission menjadi artefak data immutable sementara sampai generator PDF tersedia.

## Audit dan Konsistensi

- Setiap transition menulis `QuotationHistory` dan `Log` dalam transaction yang sama.
- Approval Supervisor juga menulis `QuotationApproval`.
- Submission dan insurer review dicatat dalam transaction status yang sama.
- Actor pada QS, approval, history, submission, dan review direlasikan ke `User` untuk data baru.
- Update status memakai conditional update berdasarkan status awal untuk menolak transition paralel yang sudah stale.

## Endpoint QS

| Endpoint                                  | Fungsi                                                            |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `GET /quotations`                         | List QS aktif.                                                    |
| `GET /quotations/:id`                     | Detail QS, child data, approval, history, submission, dan review. |
| `POST /quotations`                        | Membuat QS `DRAFT` untuk unit Teknik actor.                       |
| `PATCH /quotations/:id`                   | Mengubah root QS pada `DRAFT` atau `REVISION`.                    |
| `DELETE /quotations/:id`                  | Soft delete QS `DRAFT`.                                           |
| `POST /quotations/:id/submit`             | Submit atau resubmit QS untuk approval Supervisor.                |
| `POST /quotations/:id/approve`            | Approval Supervisor Teknik.                                       |
| `POST /quotations/:id/reject`             | Reject Supervisor Teknik.                                         |
| `POST /quotations/:id/request-revision`   | Revision request internal oleh Supervisor Teknik.                 |
| `POST /quotations/:id/send-to-insurance`  | Mengirim QS approved ke perusahaan asuransi.                      |
| `POST /quotations/:id/insurance-approve`  | Mencatat insurance approval.                                      |
| `POST /quotations/:id/insurance-revision` | Mencatat permintaan revisi dari insurer.                          |
| `GET /quotations/:id/approvals`           | Riwayat keputusan Supervisor Teknik.                              |
| `GET /quotations/:id/history`             | Riwayat status QS.                                                |
| `GET /quotations/:id/export-pdf`          | Export QS approved; generator PDF masih placeholder.              |

Endpoint child data menggunakan prefix `quotations/:quotationId` untuk `objects`, `coverages`, `terms`, `warranties`, dan `attachments`. Semua mutasi child data mengikuti lock status dan ownership QS.

## Batas Implementasi Saat Ini

- Generator PDF dan penyimpanan file hasil export belum diimplementasikan.
- `INSURANCE_APPROVED -> POLICY_ISSUED` menunggu module Policy.
- Policy placement, Insurance Voucher, RFI, Invoice, AR, AP, dan Shipment bukan bagian dari module QS ini.
