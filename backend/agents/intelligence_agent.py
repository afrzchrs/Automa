import os
import json
import re
import requests
from datetime import datetime
from apify_client import ApifyClient
from dotenv import load_dotenv
from .model_rotator import model_agent_rotator
from google import genai
from google.genai import types
import time

load_dotenv()

# Kredensial API
SERPER_API_KEY = os.getenv("SERPER_API_KEY")
APIFY_API_TOKEN = os.getenv("APIFY_API_TOKEN")

client_gemini = genai.Client()

# ==========================================
# HELPER: PARSER GEMINI UNTUK DATA SCRAPING
# ==========================================
def parse_data_mentah_dengan_gemini(teks_halaman_mentah, nama_kompetitor):
    """
    Menggunakan Gemini Flash untuk mengekstrak informasi harga dan fitur
    dari dump teks scraping mentah Apify.
    """
    if not teks_halaman_mentah:
        return {"ringkasan": "Tidak ada teks halaman"}

    prompt = f"""
Ekstrak informasi harga langganan/produk dan fitur utama dari teks mentah website kompetitor "{nama_kompetitor}" berikut.
Kembalikan HANYA JSON valid dengan format:
{{
  "harga_terdeteksi": "contoh: $5/bulan atau Rp 50.000",
  "fitur_kunci": ["fitur 1", "fitur 2"],
  "ringkasan_penawaran": "1 kalimat ringkasan singkat"
}}

Teks Mentah:
\"\"\"{teks_halaman_mentah[:2000]}\"\"\"
"""
    try:
        response = client_gemini.models.generate_content(
            model='gemma-4-31b-it',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1
            )
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"[WARNING] Gemini scraper parser fallback: {e}")
        return {"ringkasan": teks_halaman_mentah[:200]}

# ==========================================
# FUNGSI 1: AI PENCARI URL KOMPETITOR
# ==========================================
def cari_url_kompetitor_dengan_ai(nama_produk, kategori_produk, deskripsi_produk, region_kompetitor):
    """Menggunakan Gemini untuk meriset siapa kompetitor terpopuler beserta URL pricing mereka."""
    print(f"[INFO] AI sedang meriset target URL & nama kompetitor untuk kategori: {kategori_produk}...")
    
    prompt = f"""
    Kamu adalah asisten riset pasar teknologi.
    Klien kami memiliki produk : {nama_produk} 
    Kategori: "{kategori_produk}".
    Deskripsi: "{deskripsi_produk}".
    
    Tugasmu: Cari 3 hingga maksimal 5 produk {kategori_produk} kompetitor di ranah {region_kompetitor} terpopuler yang sejenis dan memiliki deskripsi yang serupa.
    Kembalikan HANYA array JSON berisi objek dengan properti "nama_kompetitor" dan "url_pricing" (halaman harga atau fitur utama resmi mereka).
    
    Contoh output yang valid:
    [
      {{
        "nama_kompetitor": "Todoist",
        "url_pricing": "https://todoist.com/pricing"
      }},
      {{
        "nama_kompetitor": "TickTick",
        "url_pricing": "https://ticktick.com/about/upgrade"
      }}
    ]
    """
    model = 'gemini-3.7-flash'
    daftar_model_gagal = []
    while True:
        try:
            response = client_gemini.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json", 
                    temperature=0.2
                )
            )
            target_urls = json.loads(response.text)
            return target_urls[:5]
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
        except json.JSONDecodeError:
            print("[ERROR] Automa Intelligence Agent gagal menghasilkan JSON yang valid.")
            return None

# ==========================================
# FUNGSI 2: PENCARI TREN PASAR (SERPER)
# ==========================================
def pantau_tren_pasar_via_serper(kategori_produk):
    """Menggunakan Serper API untuk mencari keluhan atau sentimen kompetitor secara dinamis."""
    print(f"[INFO] Memantau tren pasar untuk {kategori_produk} via Google Search...")
    url = "https://google.serper.dev/search"
    
    query_dinamis = f"why {kategori_produk} software is expensive alternative complaints"
    payload = json.dumps({"q": query_dinamis, "num": 3})
    headers = {'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json'}

    try:
        response = requests.post(url, headers=headers, data=payload)
        hasil = response.json()
        sentimen_berita = [item['snippet'] for item in hasil.get('organic', [])]
        return " | ".join(sentimen_berita)
    except Exception as e:
        print(f"[ERROR] Serper gagal: {e}")
        return "Sentimen tidak diketahui"

# ==========================================
# FUNGSI 3: PENARIK DATA VALUTA ASING
# ==========================================
def fetch_exchange_rate():
    url = "https://api.exchangerate-api.com/v4/latest/USD"
    try:
        response = requests.get(url)
        response.raise_for_status()
        return {
            "mata_uang": "USD/IDR",
            "nilai_tukar": response.json()['rates']['IDR'],
            "tren": "fluktuatif"
        }
    except Exception as e:
        print(f"[ERROR] Gagal ambil kurs: {e}")
        return None

# ==========================================
# FUNGSI 4: SCRAPER HARGA WEBSITE
# ==========================================
def scrape_harga_kompetitor_via_apify(target_urls):
    if not target_urls:
        print("[WARNING] Tidak ada URL kompetitor untuk di-scrape.")
        return []

    start_urls = []
    for item in target_urls:
        if isinstance(item, dict):
            url = item.get("url_pricing") or item.get("url")
            if url:
                start_urls.append({"url": url})
        elif isinstance(item, str) and item.startswith("http"):
            start_urls.append({"url": item})

    client = ApifyClient(APIFY_API_TOKEN)
    run_input = {
        "startUrls": start_urls,
        "maxCrawlPages": len(start_urls),
        "pageFunction": """
            async function pageFunction(context) {
                const { $ } = context;
                return {
                    url: context.request.url,
                    teks_halaman: $('body').text().substring(0, 1000) 
                };
            }
        """
    }
    
    try:
        print(f"[INFO] Apify akan meng-scrape {len(target_urls)} URL: {target_urls}")
        run = client.actor("apify/cheerio-scraper").call(run_input=run_input)
        
        if isinstance(run, dict):
            dataset_id = run.get("defaultDatasetId")
        else:
            dataset_id = getattr(run, "defaultDatasetId", getattr(run, "default_dataset_id", None))
        
        hasil_kompetitor = []
        for item in client.dataset(dataset_id).iterate_items():
            hasil_kompetitor.append({
                "url": item.get('url'),
                "data_mentah": item.get('teks_halaman')
            })
        return hasil_kompetitor
    except Exception as e:
        print(f"[ERROR] Apify gagal: {e}")
        return []

# ==========================================
# ORKESTRATOR AGEN INTELIJEN
# ==========================================
def jalankan_agen_intelijen(nama_produk, deskripsi_produk, harga_produk, kategori_produk, region_kompetitor):
    print(f"\n[INFO] Agen Intelijen memulai riset untuk: {nama_produk}")
    
    # 1. Tarik Kurs
    data_kurs = fetch_exchange_rate()
    
    # 2. Tarik Tren via Google Search
    sentimen_pasar = pantau_tren_pasar_via_serper(kategori_produk)
    
    # 3. Cari URL Kompetitor via Gemini
    target_kompetitor = cari_url_kompetitor_dengan_ai(nama_produk, kategori_produk, deskripsi_produk, region_kompetitor) or []
    
    # 4. Tarik Konten Halaman via Apify
    hasil_scraping_mentah = scrape_harga_kompetitor_via_apify(target_kompetitor)

    # 5. Ekstraksi Nama & Parsing Konten dengan Gemini
    list_nama_kompetitor = [
        item.get("nama_kompetitor") for item in target_kompetitor if isinstance(item, dict) and "nama_kompetitor" in item
    ]

    kompetitor_terpantau = []
    for idx, komp in enumerate(target_kompetitor):
        nama = komp.get("nama_kompetitor") if isinstance(komp, dict) else f"Kompetitor {idx+1}"
        url = komp.get("url_pricing") if isinstance(komp, dict) else str(komp)
        
        mentah_match = next((s.get("data_mentah") for s in hasil_scraping_mentah if s.get("url") == url), None)
        analisis_gemini = parse_data_mentah_dengan_gemini(mentah_match, nama) if mentah_match else {"status": "Tidak ada data scraping"}

        kompetitor_terpantau.append({
            "nama_kompetitor": nama,
            "url_pricing": url,
            "analisis_konten": analisis_gemini
        })

    arus_data_keluar = {
        "tanggal_rekam": datetime.now().strftime("%Y-%m-%d"),
        "sumber_arus_data": "Kompilasi Harga Pasar dan Valuta Asing",
        "informasi_produk_kita": {
            "nama": nama_produk,
            "kategori": kategori_produk,
            "target_harga_awal": harga_produk,
            "region_kompetitor": region_kompetitor
        },
        "kurs_valas": data_kurs,
        "sentimen_pasar": sentimen_pasar,
        "daftar_nama_kompetitor": list_nama_kompetitor,
        "kompetitor_terpantau": kompetitor_terpantau
    }
    
    return json.dumps(arus_data_keluar, indent=4)

if __name__ == "__main__":
    hasil_json = jalankan_agen_intelijen(
        nama_produk="TaskMaster Pro",
        deskripsi_produk="Aplikasi manajemen tugas untuk tim developer dengan integrasi kalender dan pengingat.",
        harga_produk=35000,
        kategori_produk="To-Do List App",
        region_kompetitor="Indonesia"
    )
    print("\n=== OUTPUT: NAMA ARUS DATA ===")
    print(hasil_json)