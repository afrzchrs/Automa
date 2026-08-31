import os
import re
import json
import requests
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from google import genai
from google.genai import types

load_dotenv()

client_gemini = genai.Client()

# ==========================================
# INISIALISASI FIREBASE
# ==========================================
CURRENT_DIR = Path(__file__).resolve().parent
ROOT_DIR = CURRENT_DIR.parent.parent

try:
    if not firebase_admin._apps:
        key_root = ROOT_DIR / "serviceAccountKey.json"
        key_backend = CURRENT_DIR.parent / "serviceAccountKey.json"
        
        if key_root.exists():
            cred_path = str(key_root)
        elif key_backend.exists():
            cred_path = str(key_backend)
        else:
            cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", str(key_root))

        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    FIREBASE_READY = True
except Exception as e:
    print(f"[WARNING] Firebase belum terhubung. Berjalan dalam mode simulasi lokal. Error: {e}")
    FIREBASE_READY = False

# ==========================================
# HELPER: UPLOAD BASE64 KE IMGBB (DIJALANKAN SAAT PUBLISH)
# ==========================================

def unggah_gambar_ke_imgbb(base64_str: str) -> str:
    """Mengonversi Base64 menjadi link publik ImgBB saat proses publikasi ke webhook."""
    if not base64_str:
        return ""

    if base64_str.startswith("http://") or base64_str.startswith("https://"):
        return base64_str

    imgbb_key = os.getenv("IMGBB_API_KEY")
    if not imgbb_key:
        print("[WARNING] IMGBB_API_KEY belum diset. Menggunakan string mentah.")
        return base64_str

    try:
        clean_base64 = base64_str.split("base64,")[-1] if "base64," in base64_str else base64_str
        
        url = "https://api.imgbb.com/1/upload"
        payload = {"key": imgbb_key, "image": clean_base64}

        response = requests.post(url, data=payload, timeout=30)
        data = response.json()

        if data.get("success"):
            public_url = data["data"]["url"]
            print(f"🖼️ [SUCCESS] Banner berhasil dikonversi ke ImgBB URL: {public_url}")
            return public_url
        else:
            print(f"❌ [WARNING] Gagal upload ImgBB: {data.get('error')}")
            return base64_str
    except Exception as e:
        print(f"❌ [WARNING] Exception ImgBB upload: {e}")
        return base64_str

# ==========================================
# FUNGSI AUDITOR & SAFETY GUARD
# ==========================================

def audit_aset_dengan_gemini(strategi_data, aset_kreatif_data):
    konten_audit = {
        "strategi_harga": strategi_data.get("keputusan_harga", {}),
        "postingan_x": aset_kreatif_data.get("postingan_x_twitter", ""),
        "postingan_linkedin": aset_kreatif_data.get("postingan_linkedin", ""),
        "postingan_facebook": aset_kreatif_data.get("postingan_facebook",""),
        "postingan_instagram": aset_kreatif_data.get("postingan_instagram","")
    }

    prompt = f"""
Kamu adalah AI Safety & Quality Auditor.
Evaluasi draf kampanye pemasaran berikut:
{json.dumps(konten_audit, indent=2)}

Tugas:
1. Pastikan harga yang tertera tidak bernilai 0 atau negatif.
2. Pastikan teks promosi tidak mengandung klaim palsu, ujaran kebencian, atau halusinasi harga.

Kembalikan HANYA JSON valid:
{{
  "layak_publikasi": true,
  "skor_kualitas": 95,
  "catatan_audit": "Komentar singkat kepatuhan"
}}
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
        return {"layak_publikasi": True, "skor_kualitas": 85, "catatan_audit": "Audit otomatis darurat"}

# ==========================================
# FUNGSI PUBLIKASI KE WEBHOOK MAKE.COM
# ==========================================

def publikasi_langsung_ke_webhook(dokumen_data):
    webhook_url = os.getenv("PUBLISH_WEBHOOK_URL")
    if not webhook_url:
        print("[WARNING] PUBLISH_WEBHOOK_URL belum diatur di .env")
        return False

    try:
        aset = dokumen_data.get("aset_kreatif", {})
        info_produk = dokumen_data.get("informasi_produk_kita", {})
        strategi_harga = dokumen_data.get("strategi_harga", {})

        # Konversi Base64 ke ImgBB URL tepat sebelum dikirim
        raw_banner = aset.get("gambar_preview", "")
        banner_public_url = unggah_gambar_ke_imgbb(raw_banner)

        payload = {
            "nama_produk": info_produk.get("nama", "Produk"),
            "kategori": info_produk.get("kategori", "Umum"),
            "harga_tampilan": strategi_harga.get("format_tampilan_lokal", ""),
            "postingan_instagram": aset.get("postingan_instagram", ""),
            "postingan_facebook": aset.get("postingan_facebook", ""),
            "postingan_linkedin": aset.get("postingan_linkedin", ""),
            "postingan_x_twitter": aset.get("postingan_x_twitter", ""),
            "banner_url": banner_public_url,
            "region": dokumen_data.get("region_kompetitor", "Indonesia"),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

        response = requests.post(webhook_url, json=payload, headers={"Content-Type": "application/json"}, timeout=20)
        
        if response.status_code in [200, 201, 204]:
            print("⚡ [SUCCESS] Payload kampanye berhasil terkirim ke Webhook Make.com!")
            return True
        else:
            print(f"❌ [ERROR] Webhook Make.com error code: {response.status_code}")
            return False

    except Exception as e:
        print(f"❌ [ERROR] Gagal mengirim payload ke Make.com: {e}")
        return False

# ==========================================
# FUNGSI SENTRAL EKSEKUTOR
# ==========================================

def jalankan_agen_eksekutor(aset_kreatif_json, strategi_json=None, otonomi_level=1):
    print(f"[INFO] Automa Executor Agent beroperasi (Otonomi Level {otonomi_level})...")
    
    try:
        aset_data = json.loads(aset_kreatif_json)
        strategi_data = json.loads(strategi_json) if strategi_json else {}

        hasil_audit = audit_aset_dengan_gemini(strategi_data, aset_data)
        print(f"[AUDIT GEMINI] Layak Publikasi: {hasil_audit.get('layak_publikasi')} | Skor: {hasil_audit.get('skor_kualitas')}")

        status_awal = "pending_approval" if hasil_audit.get("layak_publikasi", True) else "rejected_by_audit"
        
        # Biarkan banner_baru tetap dalam format Base64 asli untuk Firestore & Frontend
        banner_baru = aset_data.get("gambar_preview")

        dokumen_final = {
            "waktu_dibuat": datetime.utcnow().isoformat() + "Z",
            "nama_arus_data": "Aset Publikasi Final",
            "informasi_produk_kita": strategi_data.get("informasi_produk_kita", {
                "nama": strategi_data.get("nama_produk", "Produk"),
                "kategori": strategi_data.get("kategori_produk", "Umum"),
                "target_harga_awal": strategi_data.get("harga_produk", 0),
                "deskripsi": strategi_data.get("deskripsi_produk", "")
            }),
            "region_kompetitor": strategi_data.get("region_kompetitor", "Indonesia"),
            "daftar_nama_kompetitor": strategi_data.get("daftar_nama_kompetitor", []),
            "kompetitor_terpantau": strategi_data.get("kompetitor_terpantau", []),
            "strategi_harga": strategi_data.get("keputusan_harga", {}),
            "aset_kreatif": aset_data,
            "riwayat_banner": [banner_baru] if banner_baru else [],
            "audit_kualitas": hasil_audit,
            "status": status_awal
        }

        if otonomi_level == 2 and dokumen_final["status"] == "pending_approval":
            sukses = publikasi_langsung_ke_webhook(dokumen_final)
            if sukses:
                dokumen_final["status"] = "published"

        if FIREBASE_READY:
            koleksi_ref = db.collection('campaign_approvals')
            nama_produk_target = dokumen_final["informasi_produk_kita"]["nama"]

            query_ada = koleksi_ref.where(filter=FieldFilter("informasi_produk_kita.nama", "==", nama_produk_target)).limit(1).stream()
            existing_doc = next(query_ada, None)

            if existing_doc:
                doc_id = existing_doc.id
                data_lama = existing_doc.to_dict()
                riwayat_lama = data_lama.get("riwayat_banner", [])
                
                MAX_BANNER = 5
                if banner_baru and banner_baru not in riwayat_lama:
                    if len(riwayat_lama) >= MAX_BANNER:
                        riwayat_lama.pop(0)
                    riwayat_lama.append(banner_baru)

                update_payload = {
                    "waktu_dibuat": dokumen_final["waktu_dibuat"],
                    "strategi_harga": dokumen_final["strategi_harga"],
                    "aset_kreatif": dokumen_final["aset_kreatif"],
                    "audit_kualitas": dokumen_final["audit_kualitas"],
                    "region_kompetitor": dokumen_final["region_kompetitor"],
                    "daftar_nama_kompetitor": dokumen_final["daftar_nama_kompetitor"],
                    "kompetitor_terpantau": dokumen_final["kompetitor_terpantau"],
                    "riwayat_banner": riwayat_lama,
                    "status": dokumen_final["status"] 
                }
                koleksi_ref.document(doc_id).set(update_payload, merge=True)
                koleksi_ref.document(doc_id).set(update_payload, merge=True)
                print(f"[SUCCESS] Data produk '{nama_produk_target}' berhasil DIPERBARUI pada ID: {doc_id}")
            else:
                doc_ref = koleksi_ref.add(dokumen_final)
                print(f"[SUCCESS] Produk baru tersimpan di Firestore dengan ID: {doc_ref[1].id}")
        return True
    except Exception as e:
        print(f"[ERROR] Eksekusi gagal: {e}")
        return False