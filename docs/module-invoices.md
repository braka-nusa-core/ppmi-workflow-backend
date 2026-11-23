# Invoices Module

Modul ini membuat invoice dari Request for Invoice (RFI) yang sudah `READY_FOR_INVOICE`, menghitung angka dan terbilang di server, membuat nomor invoice, dan menyimpan dokumen invoice. Pratinjau di layar dan pencetakan dikerjakan frontend; backend memberi angka dan kalimat terbilang yang sama persis dengan yang akan disimpan.

Alur:

```
RFI READY_FOR_INVOICE -> GET invoice-draft (usulan, belum disimpan)
                      -> POST invoices/preview (hitung ulang saat form diubah)
                      -> POST request-invoices/:id/invoices (terbit, status UNPAID)
Incoming payment (modul payments) -> status invoice UNPAID / PARTIALLY_PAID / PAID
```

---

## 1. Contoh invoice

Invoice contoh dari PPMI (Cargo, 20 Juli 2026):

| Bagian | Nilai |
| --- | --- |
| `insuranceTypeLabel` | `CARGO` |
| `invoiceNumber` | `007/07-26/PPMI/FIN/MC` |
| `issueDate` | 20 Juli 2026 |
| `coverName` | `Askrindo` |
| `billToName` / `billToAddress` | `PT. Kertas Nusantara` / alamat klien |
| Baris | `DEWI SAMUDRA XXI`, polis `0306.26.017.2.00005-0/00`, `Tanjung Perak` ke `Mangkajang, Kabupaten Berau - Kalimantan Timur`, `As Per List`, 13 Juli 2026 sampai 13 Agustus 2026, TSI 28.633.463.500,00, rate 0,15% (disimpan `0.15`), total 42.950.195,25 |
| Gross Premium | 42.950.195,25 |
| Discount | - (0) |
| Nett Premium (A-B) | 42.950.195,25 |
| Stamp Duty + Policy Cost | 150.000,00 |
| Balance Due | 43.100.195,25 |
| Terbilang | `Forty-three million one hundred thousand one hundred ninety-five Indonesian Rupiah and twenty-five cents.` |
| Payment | Bank Mandiri Tbk, PT Pandi Proteksi Marine Indonesia, 157.00.44.004449 (IDR), `FULL PAYMENT` |
| Catatan | jatuh tempo 14 hari setelah tanggal invoice |
| Penandatangan | `Julia.SE`, `Head Finance` |

## 2. Perhitungan

Dilakukan di server (`calculateInvoice`), dengan aritmetika desimal, tidak pernah float biner. Angka dari klien selain yang tercantum di bawah diabaikan.

| Angka | Rumus |
| --- | --- |
| `items[].total` | `total` yang dikirim bila ada, jika tidak `round2(sumInsured x rate / 100)`. Tanpa `sumInsured` dan `rate`, total kosong dan dihitung 0. |
| `grossPremium` | Jumlah `total` semua baris. |
| `discount` | Dari body, default `0`. |
| `nettPremium` | `grossPremium - discount`. Ditolak (`400`) bila negatif. |
| `stampDutyPolicyCost` | Dari body, default `0`. |
| `balanceDue` | `nettPremium + stampDutyPolicyCost`. |
| `amountInWords` | Terbilang `balanceDue` sesuai mata uang. |

Pembulatan 2 desimal, setengah naik (half up). `rate` adalah persen: `0.15` berarti 0,15%. Nilai uang boleh dikirim sebagai angka atau string, tidak negatif, maksimal 2 desimal (`rate` maksimal 4 desimal). Respons mengirim uang sebagai string 2 desimal, misalnya `"42950195.25"`.

### Terbilang (bahasa Inggris)

Huruf pertama kapital, puluhan-satuan dengan tanda hubung (`forty-three`), tanpa kata `and` di dalam angka, skala `thousand`, `million`, `billion`, `trillion`, lalu nama mata uang, lalu ` and {kata} cents` hanya bila sen lebih dari 0, diakhiri titik.

| Mata uang | Nama | Contoh |
| --- | --- | --- |
| `IDR` | `Indonesian Rupiah` | `Zero Indonesian Rupiah.` |
| `USD` | `US Dollars` (`US Dollar` untuk tepat 1) | `One thousand two hundred fifty US Dollars and fifty cents.` |

Sen bernilai 1 ditulis `cent`.

## 3. Nomor invoice

Format `{NNN}/{MM}-{YY}/PPMI/FIN/{suffix}`, misalnya `007/07-26/PPMI/FIN/MC`.

- `MM-YY` diambil dari `issueDate`.
- `NNN` = 1 + urutan tertinggi di antara semua invoice (termasuk yang sudah dihapus, karena nomor tetap unik) yang nomornya memuat `/{MM}-{YY}/PPMI/FIN/`. Urutan direset tiap bulan untuk semua jenis asuransi. Nomor yang tidak cocok polanya diabaikan. Diisi nol sampai 3 digit.
- `suffix` diambil dari `InvoiceNumberSetting` untuk jenis asuransi quotation. Bila belum diatur, dipakai konstanta `DEFAULT_INVOICE_SUFFIX = 'MC'`. **Arti `MC` belum dikonfirmasi.**
- Nomor hanya usulan: Finance boleh mengubahnya di form, selama unik. Nomor ganda ditolak dengan `400`.
- Bila nomor tidak dikirim, server membuat nomor sendiri. Kalau nomor itu ternyata baru saja dipakai invoice lain yang terbit bersamaan, server mencoba nomor berikutnya (sampai 3 kali).
- Nomor yang dikirim Finance tidak pernah diganti diam-diam: bila sudah terpakai, permintaan ditolak dengan `400`. Usulan nomor di draft bisa basi bila ada invoice lain yang terbit lebih dulu; kosongkan `invoiceNumber` agar server memilih nomor yang masih kosong.

## 4. Endpoint

**Authentication:** Bearer token.

| Method | Endpoint | Permission | Keterangan |
| --- | --- | --- | --- |
| `GET` | `/request-invoices/:requestInvoiceId/invoice-draft` | `invoice:create` | Form invoice terisi otomatis. Tidak menyimpan apa pun. |
| `POST` | `/invoices/preview` | `invoice:create` | Body sama dengan create. Mengembalikan baris, total, dan terbilang. Tidak menulis. |
| `POST` | `/request-invoices/:requestInvoiceId/invoices` | `invoice:create` | Menerbitkan invoice, status `UNPAID`. |
| `GET` | `/invoices` | `invoice:read` | Daftar. Filter `status`, `currency`, `q` (nomor mengandung), `requestInvoiceId`, `page`, `limit`. |
| `GET` | `/invoices/:id` | `invoice:read` | Detail: baris (urut `sortOrder`), dokumen, ringkasan pembayaran. |
| `PATCH` | `/invoices/:id` | `invoice:update` | Mengubah invoice. |
| `POST` | `/invoices/:id/documents` | `invoice:update` | Upload `file` (multipart) dan `documentType`. |
| `DELETE` | `/invoices/:id/documents/:documentId` | `invoice:update` | Soft delete dokumen. |
| `GET` | `/invoice-number-settings` | `invoice:read` | Suffix per jenis asuransi (default `MC`). |
| `PUT` | `/invoice-number-settings/:insuranceTypeId` | `invoice:update` | Body `{ "suffix": "MC" }`. |

`GET /invoices` mengembalikan `{ items, total, page, limit }` (`limit` default 50, maksimal 200).

### 4.1 Draft

Syarat: RFI `READY_FOR_INVOICE` dan belum punya invoice yang belum dihapus, kalau tidak `400`. Jalur data: RFI, Policy, Quotation (klien, jenis asuransi, cargo, P&I vessel, objek), dan peserta placement lewat `quotationId`.

| Field draft | Sumber |
| --- | --- |
| `invoiceNumber` | Nomor usulan (bagian 3), bulan hari ini (zona Asia/Jakarta). |
| `issueDate` | Hari ini. |
| `paymentTermDays` | `14`. |
| `dueDate` | `issueDate` + 14 hari. |
| `currency` | `quotation.sumInsuredCurrency` bila `IDR`/`USD`, selain itu `IDR`. |
| `insuranceTypeLabel` | Kode jenis asuransi. |
| `billToName`, `billToAddress` | Nama dan alamat klien. |
| `coverName` | Nama perusahaan asuransi peserta `LEADER`. |
| `bankId` | Bank pertama yang belum dihapus dengan mata uang yang sama. |
| `paymentDetail` | `FULL PAYMENT`. |
| `items[0].description` | Nama kapal P&I pertama, atau `name` pada `data` objek quotation pertama, atau `quotation.interest`. |
| `items[0].policyNumber` | Nomor polis. |
| `items[0].voyageFrom`, `voyageTo` | Dari `CargoQuotation`. |
| `items[0].subjectInterest` | `CargoQuotation.interestInsured`, jika kosong `quotation.interest`. |
| `items[0].sailingStart`, `sailingEnd` | Periode polis, jika kosong `etd` dan `eta` cargo. |
| `items[0].sumInsured`, `rate` | Dari quotation. **Asumsi:** `quotation.rate` sudah berupa persen (misalnya `0.15`), sama dengan `InvoiceItem.rate`. Bila di data ternyata pecahan (`0.0015`), hasil salah dan harus dikoreksi di form. |

Draft juga memuat `grossPremium`, `discount`, `nettPremium`, `stampDutyPolicyCost`, `balanceDue`, dan `amountInWords` hasil hitung.

### 4.2 Create

Body `POST /request-invoices/:requestInvoiceId/invoices`:

| Field | Wajib | Keterangan |
| --- | --- | --- |
| `invoiceNumber` | Tidak | Dibuat otomatis bila kosong. |
| `issueDate` | Ya | Tanggal invoice. |
| `dueDate` | Tidak | Bila kosong: `issueDate` + `paymentTermDays`. |
| `paymentTermDays` | Tidak | Default `14`. |
| `currency` | Ya | `IDR` atau `USD`. |
| `insuranceTypeLabel`, `coverName`, `billToAddress` | Tidak | Salinan cetak. |
| `billToName` | Ya | Salinan cetak. |
| `items` | Ya | Minimal satu. Per baris hanya `description` yang wajib: `policyNumber`, `voyageFrom`, `voyageTo`, `subjectInterest`, `sailingStart`, `sailingEnd`, `sumInsured`, `rate`, `total`. |
| `discount`, `stampDutyPolicyCost` | Tidak | Default `0`. |
| `bankId` | Tidak | Bank harus ada. Nama, nama rekening, dan nomor rekening disalin ke invoice. |
| `paymentDetail`, `notes`, `signerName`, `signerTitle` | Tidak | Teks cetak. |

Aturan: RFI harus `READY_FOR_INVOICE`; satu RFI hanya boleh punya satu invoice yang belum dihapus; nomor unik. Kolom lama diisi `subtotal = nettPremium`, `grandTotal = balanceDue`, `ppn` kosong. `issuedById` diisi pengguna yang menerbitkan. Ditulis ke `Log` dengan `referenceType` `INVOICE`.

### 4.3 Detail dan ringkasan pembayaran

`GET /invoices/:id` menambahkan `paymentSummary`:

```json
{
  "balanceDue": "43100195.25",
  "paidAmount": "10000000.00",
  "remaining": "33100195.25"
}
```

`paidAmount` adalah jumlah incoming payment berstatus `PAID` yang belum dihapus.

### 4.4 Update

Semua field boleh dikirim sebagian. Bila `items` dikirim, semua baris lama diganti (baris lama di-soft delete). Angka dan terbilang selalu dihitung ulang dari baris dan diskon yang berlaku. `dueDate` dihitung ulang bila `issueDate` atau `paymentTermDays` berubah dan `dueDate` tidak dikirim. Mengganti `bankId` menyalin ulang data bank. **Ditolak (`400`) bila sudah ada incoming payment yang belum dihapus.**

### 4.5 Dokumen

`POST /invoices/:id/documents` adalah multipart dengan `file` (PDF atau gambar, maksimal 50 MB) dan `documentType` (`INVOICE_PDF` atau `VOUCHER`). File disimpan di S3 dengan key `invoices/{invoiceId}/{uuid}{ext}`.

## 5. Status invoice

Invoice terbit dengan status `UNPAID`. `INVOICE_ISSUED` tidak dipakai. Status berikutnya (`PARTIALLY_PAID`, `PAID`) dihitung dari incoming payment di modul payments, bukan di modul ini.
