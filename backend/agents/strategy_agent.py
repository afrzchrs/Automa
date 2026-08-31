import time
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv
from .model_rotator import model_agent_rotator

load_dotenv()
client = genai.Client()

def prompt_strategy(nama_produk, kategori_produk, harga_awal, region_kompetitor):
    AUTOMA_DYNAMIC_STRATEGY_PROMPT = f"""
    Kamu adalah Automa Strategy Agent (CMO Otonom) dan Ahli Strategi Dynamic Pricing Global untuk produk {kategori_produk} bernama "{nama_produk}". 
    Fokus utamamu adalah memenangkan pangsa pasar di wilayah/negara target: "{region_kompetitor}" terhadap dinamika ekonomi global (USD).
    Harga acuan dasar produk klien adalah {harga_awal}.

    TUGAS UTAMA:
    Analisis data kondisi ekonomi, valuta asing, dan harga kompetitor di wilayah "{region_kompetitor}". Gunakan prinsip Purchasing Power Parity (PPP) dan faktor psikologis harga lokal untuk merumuskan harga regional yang optimal dan sudut pandang (angle) pemasaran yang tajam.

    ATURAN ANALISIS DINAMIS:
    1. Evaluasi Mata Uang Lokal Target: Tentukan kode mata uang lokal resmi wilayah "{region_kompetitor}" (misal: IDR untuk Indonesia, JPY untuk Jepang, MYR untuk Malaysia, EUR untuk Eropa, USD untuk Global). Evaluasi fluktuasi nilai tukarnya terhadap USD.
    2. Analisis Daya Beli (PPP): Sesuaikan harga ke mata uang lokal target agar memiliki *perceived value* yang kompetitif dibanding kompetitor global berbasis USD.
    3. Celah Kompetitor: Identifikasi inefisiensi harga kompetitor di wilayah target tersebut (apakah terlalu mahal karena kurs atau tidak memiliki lokalisasi harga).
    4. Direktif Kampanye: Rumuskan angle pemasaran spesifik yang menyoroti keunggulan harga dan relevansi lokal bagi konsumen di "{region_kompetitor}".
    5. Bahasa yang digunakan pada bagian alasan_penetapan_harga : Gunakan bahasa "{region_kompetitor}" untuk hasil analisis bagian alasan_penetapan_harga.

    NAMA ARUS DATA MASUK:
    "Kompilasi Harga Pasar dan Valuta Asing" (Format JSON)

    NAMA ARUS DATA KELUAR:
    Kamu WAJIB merespons HANYA dalam format JSON valid sebagai "Direktif Kampanye Marketing". Gunakan struktur dinamis berikut:
    """

    AUTOMA_JSON_STRUCTURE = """
    {
      "wilayah_target": "Nama negara / region target",
      "analisis_pasar": "Penjelasan analisis ekonomi dan perbandingan kompetitor 2-3 kalimat",
      "keputusan_harga": {
        "harga_usd_global": 3.99,
        "kode_valuta_lokal": "IDR",
        "harga_nominal_lokal": 29000,
        "format_tampilan_lokal": "Rp 29.000",
        "alasan_penetapan_harga": "Penjelasan logis penyesuaian PPP dan batas psikologis valuta target"
      },
      "direktif_kampanye": {
        "angle_utama": "Satu kalimat instruksi utama kampanye spesifik target pasar",
        "emosi_target": "Frasa emosi target audiens"
      }
    }
    """
    return AUTOMA_DYNAMIC_STRATEGY_PROMPT + AUTOMA_JSON_STRUCTURE

def jalankan_agen_strategi(arus_data_masuk_json):
    """
    Menerima JSON dari Agen Intelijen, memprosesnya dengan Gemini,
    dan mengembalikan JSON Direktif Kampanye beserta metadata kompetitor.
    """
    print("[INFO] Automa Strategy Agent sedang menganalisis data pasar...")

    data = json.loads(arus_data_masuk_json)
    info_produk = data.get("informasi_produk_kita", {})
    nama_produk = info_produk.get("nama", "Produk")
    kategori_produk = info_produk.get("kategori", "Kategori Umum")
    harga_awal = info_produk.get("target_harga_awal", 0)
    region_kompetitor = info_produk.get("region_kompetitor", data.get("region_kompetitor", "global"))

    # Tangkap data kompetitor agar tidak hilang saat diteruskan ke Creative & Executor Agent
    daftar_nama_kompetitor = data.get("daftar_nama_kompetitor", [])
    kompetitor_terpantau = data.get("kompetitor_terpantau", [])

    model = 'gemini-3.7-flash'
    daftar_model_gagal = []
    
    while True:
        try:
            response = client.models.generate_content(
                model=model,
                contents=arus_data_masuk_json,
                config=types.GenerateContentConfig(
                    system_instruction=prompt_strategy(nama_produk, kategori_produk, harga_awal, region_kompetitor),
                    temperature=0.4,
                    response_mime_type="application/json",
                ),
            )
            
            json_output = json.loads(response.text)

            # Sisipkan kembali data kompetitor ke output final Agen Strategi
            json_output["daftar_nama_kompetitor"] = daftar_nama_kompetitor
            json_output["kompetitor_terpantau"] = kompetitor_terpantau
            json_output["region_kompetitor"] = region_kompetitor
            json_output["informasi_produk_kita"] = data.get("informasi_produk_kita", {
                "nama": nama_produk,
                "kategori": kategori_produk,
                "target_harga_awal": harga_awal,
            })
            
            return json.dumps(json_output, indent=4)
        
        except json.JSONDecodeError:
            print("[ERROR] Automa Strategy Agent gagal menghasilkan JSON yang valid.")
            return None
        except Exception as e:
            pesan_error = str(e)
                
            if "503" in pesan_error or "429" in pesan_error or "UNAVAILABLE" in pesan_error:
                print(f"[WARNING] Model {model} gagal (Sibuk/Error).")
                daftar_model_gagal.append(model)
                model = model_agent_rotator(daftar_model_gagal)
                        
                if model:
                    print(f"[INFO] Memutar ke model cadangan: {model}. Menunggu 2 detik...")
                    time.sleep(2)
                else:
                    daftar_model_gagal.clear()
                    model = 'gemini-3.5-flash'
            else:
                print(f"[ERROR] Kesalahan fatal pada {model}: {pesan_error}")
                return None

# ==========================================
# BLOK PENGUJIAN LOKAL (SIMULASI ORKESTRASI)
# ==========================================
if __name__ == "__main__":
    # Ini adalah simulasi arus data yang biasanya dikirim oleh intelligence_agent.py
    simulasi_data_intelijen = {
        "tanggal_rekam": "2026-08-26",
        "sumber_arus_data": "Kompilasi Harga Pasar dan Valuta Asing",
        "kurs_valas": {
            "mata_uang": "USD/IDR",
            "nilai_tukar": 16500,
            "tren": "fluktuatif"
        },
        "sentimen_pasar": "Banyak pengguna mengeluh harga Todoist $5 terasa sangat mahal karena Dolar sedang naik. Mereka mencari alternatif yang lebih murah.",
        "kompetitor_terpantau": [
            {"url": "https://todoist.com/pricing", "data_mentah": "Todoist Pro is $5 per month."},
            {"url": "https://ticktick.com/about/upgrade", "data_mentah": "TickTick Premium $3 per month."}
        ]
    }
    
    # Konversi data simulasi ke string JSON
    input_json = json.dumps(simulasi_data_intelijen)
    
    # Eksekusi agen
    hasil_direktif = jalankan_agen_strategi(input_json)
    
    if hasil_direktif:
        print("\n=== OUTPUT: NAMA ARUS DATA (Direktif Kampanye Marketing) ===")
        print(hasil_direktif)