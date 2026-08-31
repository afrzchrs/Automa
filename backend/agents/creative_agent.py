import time
import json
import re
import os
import base64
from io import BytesIO
from dotenv import load_dotenv
from google import genai
from google.genai import types
from huggingface_hub import InferenceClient
from .model_rotator import model_agent_rotator

load_dotenv()

client = genai.Client()

def clean_json_string(raw_text):
    """Membersihkan format markdown ```json ... ``` agar bisa di-parse json.loads."""
    if not raw_text:
        return ""
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw_text.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip())
    return cleaned.strip()

def prompt_creative(region_kompetitor, nama_produk, kategori_produk, format_harga, daftar_kompetitor):
    cleaned_kompetitor = []
    if isinstance(daftar_kompetitor, list):
        for k in daftar_kompetitor:
            if isinstance(k, dict):
                nama = k.get("nama_kompetitor") or k.get("nama") or str(k)
                cleaned_kompetitor.append(nama)
            elif isinstance(k, str):
                cleaned_kompetitor.append(k)

    kompetitor_text = ", ".join(cleaned_kompetitor) if cleaned_kompetitor else "kompetitor global berbasis USD"

    prompt = f"""
Kamu adalah Automa Creative Agent (Autonomous Content Strategist & Copywriter) untuk produk {kategori_produk} bernama "{nama_produk}".
Tugas utamamu adalah menyusun aset promosi media sosial multikanal untuk audiens di wilayah/negara: "{region_kompetitor}" dan menyesuaikan bahasa yang digunakan di asset promosi
untuk audiens "{region_kompetitor}".

INFORMASI KONTEKS PASAR:
- Wilayah / Target Region: {region_kompetitor}
- Harga Produk Kita: {format_harga} (Terkunci / Sesuai PPP wilayah ini)
- Kompetitor Relevan: {kompetitor_text}

ATURAN PENULISAN KONTEN SPESIFIK PLATFORM:
1. X (Twitter): Singkat, tajam (punchy), fokus pada keresahan biaya langganan. Maksimal 280 karakter.
2. LinkedIn: Gaya bahasa profesional, analitis, fokus pada ROI, efisiensi kerja tim, dan anggaran operasional.
3. Instagram: Menarik, santai, storytelling visual, gunakan emoji secukupnya dan ajakan berinteraksi.
4. Facebook: Komunikatif, fokus pada komunitas/solusi praktis sehari-hari, sertakan pengenalan fitur dan Call to Action (CTA) link.
5. Pembuatan Prompt Visual (FLUX.1 / Imagen): Deskripsi visual poster DALAM BAHASA INGGRIS yang menonjolkan produk dan estetika modern.

NAMA ARUS DATA MASUK:
"Direktif Kampanye Marketing" (Format JSON dari Agen Strategi).

NAMA ARUS DATA KELUAR:
Kamu WAJIB menghasilkan output HANYA dalam format JSON yang valid sebagai "Aset Publikasi Final":
{{
  "postingan_x_twitter": "Teks siap rilis untuk X...",
  "postingan_linkedin": "Teks siap rilis untuk LinkedIn...",
  "postingan_instagram": "Teks siap rilis untuk Instagram...",
  "postingan_facebook": "Teks siap rilis untuk Facebook...",
  "prompt_gambar_imagen": "A detailed high-quality promotional banner prompt in English..."
}}
"""
    return prompt

def generate_banner_hf_flux(prompt_text):
    """
    Generate gambar dengan FLUX.1-schnell via Hugging Face API.
    Membutuhkan HF_TOKEN di file .env
    """
    hf_token = os.getenv("HF_TOKEN")
    if not hf_token:
        print("[WARNING] HF_TOKEN tidak ditemukan di .env, melewati pembuatan gambar visual.")
        return None

    try:
        print("[INFO] Automa Creative Agent sedang me-render banner visual via FLUX.1-schnell...")
        client_hf = InferenceClient("black-forest-labs/FLUX.1-schnell", token=hf_token)
        image = client_hf.text_to_image(prompt_text)

        buffered = BytesIO()
        image.save(buffered, format="JPEG", quality=85)
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        
        return f"data:image/jpeg;base64,{img_str}"
    except Exception as e:
        print(f"[ERROR] Gagal generate dengan FLUX: {e}")
        return None

def jalankan_agen_kreatif(direktif_json):
    """
    Menerima JSON 'Direktif Kampanye Marketing' dari Agen Strategi,
    membaca konteks dinamis, dan menghasilkan 'Aset Publikasi Final'.
    """
    print("[INFO] Automa Creative Agent sedang menyusun aset media sosial...")
    
    # 1. Parsing input dari Agen Strategi
    try:
        clean_input = clean_json_string(direktif_json)
        data = json.loads(clean_input)
    except Exception as e:
        print(f"[ERROR] Input direktif bukan JSON valid: {e}")
        return None

    region_kompetitor = data.get("region_kompetitor", data.get("wilayah_target", "global"))
    
    info_produk = data.get("informasi_produk_kita", {})
    nama_produk = info_produk.get("nama", "Automa App")
    kategori_produk = info_produk.get("kategori", "Aplikasi Produktivitas")
    
    keputusan_harga = data.get("keputusan_harga", {})
    format_harga = keputusan_harga.get("format_tampilan_lokal") or f"{keputusan_harga.get('kode_valuta_lokal', 'IDR')} {keputusan_harga.get('harga_nominal_lokal', keputusan_harga.get('harga_idr_lokal', 0)):,}"
    daftar_kompetitor = data.get("daftar_nama_kompetitor", [])

    system_instruction_dinamis = prompt_creative(
        region_kompetitor=region_kompetitor,
        nama_produk=nama_produk,
        kategori_produk=kategori_produk,
        format_harga=format_harga,
        daftar_kompetitor=daftar_kompetitor
    )

    model = 'gemini-3.5-flash'
    daftar_model_gagal = []
    
    while True:
        try:
            response = client.models.generate_content(
                model=model,
                contents=direktif_json,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction_dinamis,
                    temperature=0.7,
                    response_mime_type="application/json",
                ),
            )
            
            raw_output = clean_json_string(response.text)
            json_output = json.loads(raw_output)

            # Eksekusi FLUX.1 jika prompt visual berhasil dibuat
            prompt_gambar = json_output.get("prompt_gambar_imagen")
            if prompt_gambar:
                gambar_base64 = generate_banner_hf_flux(prompt_gambar)
                json_output["gambar_preview"] = gambar_base64

            return json.dumps(json_output, indent=4)
            
        except json.JSONDecodeError:
            print("[ERROR] Automa Creative Agent gagal menghasilkan JSON yang valid. Mencoba rotasi model...")
            daftar_model_gagal.append(model)
            model = model_agent_rotator(daftar_model_gagal)
            if model:
                print(f"[INFO] Memutar ke model: {model}...")
                time.sleep(1)
            else:
                daftar_model_gagal.clear()
                model = 'gemini-3.5-flash'
                return None
        except Exception as e:
            pesan_error = str(e)
            if "503" in pesan_error or "429" in pesan_error or "UNAVAILABLE" in pesan_error:
                print(f"[WARNING] Model {model} sibuk. Melakukan rotasi...")
                daftar_model_gagal.append(model)
                model = model_agent_rotator(daftar_model_gagal)
                if model:
                    time.sleep(2)
                else:
                    daftar_model_gagal.clear()
                    model = 'gemini-3.5-flash'
            else:
                print(f"[ERROR] Kesalahan fatal pada {model}: {pesan_error}")
                return None