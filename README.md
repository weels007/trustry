# Trustry — GenLayer Intelligent Contract (AI Notary)

Proyek **Trustry** membangun layanan AI Notary otomatis di GenLayer, menggunakan konsensus AI-validator untuk memverifikasi kejadian online melalui sumber URL terpercaya.

## Menjalankan

```bash
# Kontrak
genvm-lint check contracts/trustry.py
pytest tests/direct/ -v

# Frontend
cd frontend
npm install
npm run dev
```

## Deploy ke Vercel

Repositori ini berisi kontrak dan frontend. Frontend-nya ada di `frontend/`, jadi
pilih **Root Directory = `frontend`** saat membuat project di Vercel, atau
biarkan `vercel.json` di root yang mengarahkan build ke sana.

Tidak ada environment variable yang dibutuhkan. Frontend membaca kontrak
langsung dari browser lewat `gen_call` ke RPC studio, jadi tidak ada API key
yang disimpan di server.

Untuk mengganti kontrak, ubah `TRUSTRY_CONTRACT` di `frontend/src/lib/genlayer/chain.ts`.

## Deploy kontrak ke studionet

```bash
python "D:\Genlayer-project\weels\wallet\deploy.py" --contract contracts/trustry.py --wallet tester1
```

CLI `genlayer` biasa tidak bisa dipakai di sini: ia membaca password keystore
dengan `inquirer`, yang butuh terminal sungguhan, jadi tidak bisa di-pipe.

## Struktur Proyek

```
ai-notary/
  agent.md                 # Panduan dan aturan agent (selalu baca doc GenLayer)
  contracts/
    trustry.py            # Intelligent Contract Trustry
  tests/
    direct/
      test_ai_notary.py     # Tes langsung (fast, ~30ms) — 24 passed
    integration/
      test_ai_notary.py     # Tes integrasi (konsensus penuh, real web/LLM)
  test_studionet.py         # Test semua method di studionet asli — 30 passed
  test_escrow_studionet.py  # Test escrow + pergerakan saldo on-chain — 25 passed
  gltest.config.yaml        # Konfigurasi jaringan gltest
```

## Status di Studionet

| Item | Nilai |
|---|---|
| Contract address | `0xcf2Ae53f11116Fbf0121990678E4DB513f44dd8d` |
| Jaringan | Genlayer Studio Network (chain 61999) |
| Wallet | `tester1` (folder `D:\Genlayer-project\weels\wallet`) |
| Lint GenVM | OK — 15 method (9 view, 6 write) |
| Direct test | 46 passed (33 perilaku + 13 security regression) |
| Studionet test | 39 passed |
| Escrow test | 31 passed |

## API Kontrak

```
open_case(event_id, description, evidence_url, expected_event_title)  # belum payable
fund_escrow(event_id)                                                # payable, tidak pernah gagal
notarize(event_id)                                                   # consensus, belum payable
appeal_notarization(event_id)                                        # evaluasi ulang
release_escrow(event_id, recipient) / refund_escrow(event_id)         # pemindahan dana
```

Reads: `get_record`, `get_frontend_details`, `get_all_record_ids`, `get_escrow_status`,
`get_escrow_pool`, `get_event_count`, `get_total_escrow_held`, `get_contract_balance`,
`is_trusted_domain`.

## Escrow (dana benar-benar berpindah, tidak pernah terperangkap)

`fund_escrow` (payable) menahan GEN; `release_escrow` memindahkan ke penerima, `refund_escrow`
mengembalikan ke submitter. Status escrow dilacak eksplisit (`none` / `held` / `released` /
`refunded`) supaya dana tidak bisa dilepas dua kali.

**Penting:** transaksi yang GAGAL tetap dikreditkan dengan nilainya (`value_credited: True`),
sementara storage di-rollback — dananya hilang tanpa jejak. Karena itu pem-fundingan dipisahkan
dari langkah berisiko: `open_case` dan `notarize` tidak pernah membawa nilai, dan `fund_escrow`
tidak punya pemeriksaan yang bisa menolak, sehingga nilainya selalu tercatat dan selalu bisa
dikembalikan.

`test_escrow_studionet.py` membuktikan perpindahan dana dengan membaca saldo on-chain
depositor, penerima, dan kontrak sebelum/sesudah setiap langkah, serta memverifikasi invarian
`saldo kontrak == total escrow yang dipegang`.

## Keamanan

- **Ground truth deterministik**: frasa kunci wajib benar-benar ada di halaman yang di-fetch.
  LLM hanya menilai apakah halaman mendeskripsikan event, dan tidak pernah bisa membuat kontrak
  menerima halaman yang tidak memuat bukti.
- **Title tidak boleh dikarang**: judul yang dilaporkan harus frasa yang ada di halaman.
- **Bukti harus bisa dikutip**: validator harus mengembalikan kalimat yang persis ada di
  halaman, dan kontrak memeriksanya. Bukti yang dikarang tidak bisa menyegel record.
- **Satu halaman = satu event**: URL dinormalisasi (scheme, case host, query, fragment) dan
  direservasi.
- **Batas event per alamat** (25) agar satu alamat tidak bisa membanjiri kontrak.
- **Owner tidak punya hak atas escrow orang lain** — hanya depositor yang bisa memindahkan dana.
- **Case yang ditolak bisa di-appeal** dan dinilai ulang dari nol.
- **Input dibatasi** dan halaman ditandai sebagai data tak tepercaya (prompt injection).

## Frontend (`frontend/`)

Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn + TypeScript + viem.

| Halaman | Isi |
|---|---|
| `/` | Hero dengan animasi konvergensi validator, tiga langkah, jaminan keamanan |
| `/notarize` | Alur tiga transaksi: buka case → dana escrow → notaris, dengan panel konsensus |
| `/records` | Register semua record, dibaca langsung dari kontrak |
| `/how-it-works` | Cara konsensus bekerja dan di mana bisa gagal |

**Menyambung ke kontrak**

- **Baca** memakai `gen_call` lewat `fetch` biasa — tidak butuh wallet.
- **Tulis** mengirim transaksi EVM ke *consensus main contract*, yang meneruskannya ke kontrak
  Intelligent untuk menjalankan satu ronde konsensus.
- GenLayer tidak memakai ABI EVM untuk pemanggilan kontrak. Ada codec sendiri
  (`src/lib/genlayer/calldata.ts` + `rlp.ts`) yang diverifikasi **byte per byte** terhadap
  SDK Python.

**Wallet connect (MetaMask + Rabby)**

Ketika keduanya terpasang, mereka berebut `window.ethereum`. Trustry mencari *semua* provider
yang ter-inject, menampilkannya di sebuah pemilih, lalu hanya meminta izin ke wallet yang
dipilih — jadi **tidak ada dua popup yang berebut**. `eth_accounts` dipakai untuk memulihkan
sesi tanpa popup sama sekali.

**Verifikasi** (`npm run verify` di `frontend/`)

| Perintah | Yang diperiksa |
|---|---|
| `verify:calldata` | Codec TypeScript vs byte dari SDK Python |
| `verify:write` | Data transaksi yang ditandatangani wallet vs SDK Python |
| `verify:wallet` | Deteksi wallet, termasuk MetaMask + Rabby bersamaan |
| `verify:wallet-ui` | Browser sungguhan dengan dua wallet palsu: hanya wallet yang dipilih yang diminta izin |
| `verify:read` | Baca dari kontrak sungguhan |

## Fitur Utama (Web3-Ready)

1. **Verifikasi Event Online** — Kontrak mengambil bukti dari URL terpercaya, menjalankan LLM untuk menganalisis konten, dan menyimpan hasil verifikasi on-chain.
2. **Sumber Terpercaya (Trusted Domains)** — Hanya domain yang dapat dipertanggungjawabkan (misalnya `.org`, `.edu`, situs berita resmi, GitHub, Ethereum) yang diterima sebagai bukti.
3. **Konsensus Validator** — Menggunakan `run_nondet_unsafe` dengan validator independen yang menjalankan ulang web fetch dan LLM, membandingkan `verified` dan `event_title`. Bukan hanya validasi format JSON.
4. **Escrow Opsional** — Metode `payable` (`notarize`) menerima GEN sebagai jaminan; `release_escrow` dapat melepaskan jika event terverifikasi.
5. **Audit Trail** — Semua record (`NotaryRecord`) tersimpan persisten dengan `event_id`, URL bukti, domain, status verifikasi, dan pengirim.

## Prinsip Kesetaraan (Equivalence Principle)

Karena web dan LLM bersifat non-deterministik, kontrak menggunakan **custom validator function** (`run_nondet_unsafe`):
- **Leader**: Fetch URL + LLM → JSON hasil.
- **Validator**: Rerun fetch + LLM → bandingkan `verified` (bool), `event_title` (string stabil), dan `evidence_url` (harus sama persis).
- Jika tidak cocok, konsensus gagal dan rotasi validator terjadi.

## Aturan Agent

Lihat `agent.md`. Intinya:
- Selalu baca dokumentasi GenLayer (`https://docs.genlayer.com/`) sebelum mengambil keputusan desain.
- Selalu pin versi runner konkret (`py-genlayer:...hash...`), tidak pernah `test` atau `latest`.
- Selalu gunakan `run_nondet_unsafe` dengan verifikasi independen, bukan `strict_eq` untuk LLM/web.
- Jangan deploy ke `studionet` tanpa konfirmasi pengguna.
- Selalu perbarui `agent.md` jika instruksi baru diterima.

## Catatan Desain

- **Tema Notary AI**: Kontrak bertindak sebagai notaris digital yang dapat memverifikasi pernyataan atau kejadian online menggunakan bukti dari situs tepercaya.
- **Web3 Integration**: Hasil verifikasi tersimpan sebagai state kontrak yang bisa dibaca oleh dApp/Web3 agent lain; escrow memungkinkan model pembayaran berbasis verifikasi.
- **Tidak Deploy Sekarang**: Struktur kontrak sudah lengkap untuk lint dan direct test, tapi belum dideploy ke `studionet` atau `localnet`.
