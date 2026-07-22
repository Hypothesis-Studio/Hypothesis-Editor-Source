# Changelog Bug Fixes — Hypothesis Editor

---

## 2026-07-22

### Fitur Check for Updates manual (Help menu TitleBar)
- **File baru:** `src/main/ipc/update.ipc.ts`, `src/renderer/utils/updateChecker.ts`
- **File diubah:** `src/main/ipc/index.ts`, `src/preload/index.ts`, `src/renderer/components/titlebar/TitleBar.tsx`
- **Perubahan:**
  - Menu Help → "Check for Updates" di TitleBar dropdown
  - Backend: fetch GitHub Releases API dari main process, semver comparison
  - Dialog konfirmasi "Later" / "Update Now" menggunakan showDialog yang sudah ada
  - "Update Now" buka halaman release di browser external
  - About dialog tetap seperti semula

### Folder missing tidak di-cached dan tombol Remove tidak berfungsi
- **File:** `src/renderer/components/sidebar/FileExplorer.tsx`, `src/renderer/App.tsx`
- **Perubahan:**
  - Folder yang sudah tidak ada di disk sekarang otomatis dihapus dari workspace saat load/refresh, bukan hanya ditandai `(missing)`
  - `loadAllRoots()` dan `refreshRoot()` langsung hapus folder dari workspace + stop watcher saat error
  - Tombol Remove (✕) pada toolbar per-folder sekarang juga stop file watcher + cleanup state explorer (`rootFiles`, `expanded`, `selected`)
  - App.tsx: tambah sync `rootPath` dengan workspace folders — jika semua folder dihapus, `rootPath` jadi null (tampilan kosong)

### Folder tidak terdeteksi hilang setelah dihapus dari disk
- **File:** `src/renderer/components/sidebar/FileExplorer.tsx`, `src/renderer/stores/workspaceStore.ts`
- **Perubahan:**
  - Tambah validasi folder saat restore session — folder yang sudah tidak ada dihapus otomatis dari workspace
  - Tambah state `missingRoots` di FileExplorer untuk mendeteksi folder yang gagal diakses
  - Tampilkan label `(missing)` dengan warna merah pada folder yang tidak ditemukan di disk
  - `loadAllRoots()` dan `refreshRoot()` sekarang menandai folder sebagai missing saat error, bukan diam-diam mengabaikannya
