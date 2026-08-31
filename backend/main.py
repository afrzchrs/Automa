import time
from agents import jalankan_agen_intelijen, jalankan_agen_strategi, jalankan_agen_kreatif, jalankan_agen_eksekutor

def jalankan_pipeline_automa(otonomi_level, nama_produk, deskripsi_produk, harga_produk, kategori_produk, region_kompetitor):
    """
    Fungsi orkestrasi utama (The Taskmaster Workflow).
    Menggabungkan seluruh agen dari pengumpulan data hingga eksekusi.
    """
    print("==================================================")
    print("MEMULAI PIPELINE AUTOMA AI - OPERASI PASAR")
    print("==================================================\n")
    start_time = time.time()

    # ---------------------------------------------------------
    # TAHAP 1: AGEN INTELIJEN (Pengumpulan Data)
    # ---------------------------------------------------------
    arus_data_intelijen = jalankan_agen_intelijen(nama_produk, deskripsi_produk, harga_produk, kategori_produk, region_kompetitor)
    if not arus_data_intelijen:
        print("[PIPELINE HALTED] Gagal di Tahap Intelijen. Operasi dihentikan.")
        return False
    print("⬇=== INTELLIGENCE AGENT DATA DONE ===")
    print(arus_data_intelijen)
    print("================================\n")
    print("[SUCCESS] Data Intelijen berhasil dikumpulkan.\n")


    # ---------------------------------------------------------
    # TAHAP 2: AGEN STRATEGI (Analisis & Keputusan Harga)
    # ---------------------------------------------------------
    arus_data_strategi = jalankan_agen_strategi(arus_data_intelijen)
    if not arus_data_strategi:
        print("[PIPELINE HALTED] Gagal di Tahap Strategi. Operasi dihentikan.")
        return False
    print("⬇=== STRATEGY DIRECTIVE AGENT DATA DONE ===")
    print(arus_data_strategi)
    print("==================================\n")
    print("[SUCCESS] Direktif Strategi (Harga & Angle) berhasil dirumuskan.\n")

    # ---------------------------------------------------------
    # TAHAP 3: AGEN KREATIF (Produksi Aset Sosmed)
    # ---------------------------------------------------------
    arus_data_kreatif = jalankan_agen_kreatif(arus_data_strategi)
    if not arus_data_kreatif:
        print("[PIPELINE HALTED] Gagal di Tahap Kreatif. Operasi dihentikan.")
        return False
    print("⬇=== CREATIVE AGENT ASSET DATA DONE ===")
    print(arus_data_kreatif)
    print("=============================\n")
    print("[SUCCESS] Aset Publikasi Final berhasil dibuat.\n")

    # ---------------------------------------------------------
    # TAHAP 4: AGEN EKSEKUTOR (Simpan ke DB / Posting Webhook)
    # ---------------------------------------------------------
    sukses_eksekusi = jalankan_agen_eksekutor(
        aset_kreatif_json=arus_data_kreatif,
        strategi_json=arus_data_strategi,
        otonomi_level=otonomi_level
    )

    if sukses_eksekusi:
        waktu_eksekusi = round(time.time() - start_time, 2)
        print("\n==================================================")
        print(f"PIPELINE SELESAI DALAM {waktu_eksekusi} DETIK!")
        print("Data telah diamankan oleh Agen Eksekutor.")
        print("==================================================")
        return True
    else:
        print("[PIPELINE HALTED] Gagal di Tahap Eksekusi (Database/Webhook).")
        return False

# ==========================================
# TITIK MASUK (ENTRY POINT)
# ==========================================
if __name__ == "__main__":
    # Level 1: Simpan ke Firestore untuk di-approve manual di Web Dasbor
    # Level 2: Langsung posting otomatis via Webhook
    LEVEL_OTONOMI_SAAT_INI = 1 
    
    jalankan_pipeline_automa(otonomi_level=LEVEL_OTONOMI_SAAT_INI,
                            nama_produk="Kopi Luwak Premium",
                            deskripsi_produk="Kopi premium dengan rasa khas dan aroma yang kuat.",
                            harga_produk=150000,
                            kategori_produk="Minuman",
                            region_kompetitor="Indonesia") # bisa berupa global, atau negara tertentu seperti "Indonesia" atau dua negara seperti "Indonesia, Malaysia"