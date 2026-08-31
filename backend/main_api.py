import os
import sys
import asyncio
import requests
import traceback
import requests
from pathlib import Path
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from agents.executor_agent import unggah_gambar_ke_imgbb,db,FIREBASE_READY
from pydantic import BaseModel

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

CURRENT_DIR = Path(__file__).resolve().parent
ROOT_DIR = CURRENT_DIR.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

try:
    from backend.main import jalankan_pipeline_automa
except ImportError:
    from main import jalankan_pipeline_automa

try:
    from backend.agents.executor_agent import publikasi_langsung_ke_webhook, FIREBASE_READY, db
except ImportError:
    from agents.executor_agent import publikasi_langsung_ke_webhook, FIREBASE_READY, db

app = FastAPI(title="Automa Multi-Agent Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# THREAD-SAFE LOG STREAMING (NON-BLOCKING)
# ---------------------------------------------------------
stream_subscribers = set()
executor = ThreadPoolExecutor(max_workers=4)

class SafeStdoutRedirector:
    def __init__(self, original_stdout):
        self.original_stdout = original_stdout

    def write(self, text):
        self.original_stdout.write(text)
        self.original_stdout.flush()
        
        cleaned = text.strip()
        if cleaned:
            # Broadcast ke antrean SSE secara non-blocking
            for q in list(stream_subscribers):
                try:
                    q.put_nowait(cleaned)
                except Exception:
                    pass

    def flush(self):
        self.original_stdout.flush()

sys.stdout = SafeStdoutRedirector(sys.stdout)

# ---------------------------------------------------------
# SKEMA REQUEST & ENDPOINTS
# ---------------------------------------------------------
class ProdukBaruRequest(BaseModel):
    nama_produk: str
    deskripsi_produk: str = ""
    harga_produk: float
    kategori_produk: str = "Umum"
    region_kompetitor: str = "Indonesia"
    otonomi_level: int = 1

class PublishCampaignRequest(BaseModel):
    draft_id: str

# Di dalam main_api.py
def eksekusi_pipeline_background(payload: dict):
    nama = payload.get("nama_produk", "Produk")
    
    # Ambil level otonomi langsung dari payload (dikirim oleh Dashboard/App.jsx)
    level_otonomi = payload.get("otonomi_level", 1) 
    
    print(f"\n🚀 [PIPELINE START] Memulai proses pipeline untuk: {nama} (Level: {level_otonomi})")
    
    try:
        jalankan_pipeline_automa(
            otonomi_level=level_otonomi,
            nama_produk=nama,
            deskripsi_produk=payload.get("deskripsi_produk", ""),
            harga_produk=payload.get("harga_produk", 100000),
            kategori_produk=payload.get("kategori_produk", "Umum"),
            region_kompetitor=payload.get("region_kompetitor", "Indonesia")
        )
        print(f"✅ [PIPELINE FINISHED] Selesai memproses {nama}!")
    except Exception as e:
        print(f"❌ [PIPELINE ERROR] Terjadi kegagalan: {e}")
        traceback.print_exc()

@app.get("/api/stream-logs")
async def stream_logs(request: Request):
    queue = asyncio.Queue()
    stream_subscribers.add(queue)

    async def event_generator():
        try:
            yield "data: 🔗 Terhubung ke Live Agent Log Stream...\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    # Ambil log dengan timeout agar koneksi tetap hidup
                    data = await asyncio.wait_for(queue.get(), timeout=1.0)
                    yield f"data: {data}\n\n"
                except asyncio.TimeoutError:
                    continue
        finally:
            stream_subscribers.remove(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.post("/api/analisis-produk")
async def trigger_analisis_produk(req: ProdukBaruRequest):
    # Jalankan langsung di threadpool independen (tidak terpengaruh navigasi browser)
    executor.submit(eksekusi_pipeline_background, req.model_dump())
    return {"status": "started", "message": f"Pipeline untuk {req.nama_produk} berjalan di background."}

@app.post("/api/trigger-daily-agent")
async def trigger_daily_agent(x_cron_secret: str = Header(None)):
    expected_secret = os.getenv("CRON_SECRET_KEY")
    if not expected_secret or x_cron_secret != expected_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not FIREBASE_READY:
        return {"success": False, "message": "Firebase tidak siap"}

    try:
        docs = db.collection("campaign_approvals").stream()
        produk_diproses = set()
        count = 0

        for doc in docs:
            data = doc.to_dict()
            info = data.get("informasi_produk_kita", {})
            nama_produk = info.get("nama")

            if nama_produk and nama_produk not in produk_diproses:
                produk_diproses.add(nama_produk)
                
                # Baca level otonomi dari Firestore (Default 1 jika tidak ada)
                level_otonomi = data.get("otonomi_level", 1)
                
                payload = {
                    "nama_produk": nama_produk,
                    "deskripsi_produk": info.get("deskripsi", ""),
                    "harga_produk": info.get("target_harga_awal", 100000),
                    "kategori_produk": info.get("kategori", "Umum"),
                    "region_kompetitor": data.get("region_kompetitor", "Indonesia"),
                    "otonomi_level": level_otonomi
                }
                
                print(f"🔄 [SCHEDULER] Memasukkan {nama_produk} ke antrean pipeline dengan Otonomi Level {level_otonomi}...")
                executor.submit(eksekusi_pipeline_background, payload)
                count += 1
                
        return {"success": True, "message": f"{count} produk dimasukkan ke antrean agen harian."}
    except Exception as e:
        print(f"❌ [SCHEDULER ERROR] Gagal menjalankan tugas otomatis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/produk/{product_id}")
async def hapus_produk(product_id: str):
    try:
        # Menghapus dokumen dari koleksi Firestore 'campaign_approvals'
        db.collection("campaign_approvals").document(product_id).delete()
        return {"status": "success", "message": f"Produk dengan ID {product_id} berhasil dihapus."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/publish-campaign")
async def publish_campaign(payload: dict):
    webhook_url = os.getenv("PUBLISH_WEBHOOK_URL")
    if not webhook_url:
        return {"success": False, "error": "PUBLISH_WEBHOOK_URL belum diatur di .env"}

    draft_id = payload.get("draft_id")
    data_doc = {}

    # Ambil data Firestore secara aman
    if draft_id and FIREBASE_READY:
        try:
            doc_snap = db.collection("campaign_approvals").document(draft_id).get()
            if doc_snap.exists:
                data_doc = doc_snap.to_dict()
        except Exception as e:
            print(f"[ERROR] Gagal membaca Firestore: {e}")

    aset = data_doc.get("aset_kreatif", {})
    info_produk = data_doc.get("informasi_produk_kita", {})
    strategi_harga = data_doc.get("strategi_harga", {})

    # Ambil gambar Base64 dari dokumen Firestore
    raw_banner = aset.get("gambar_preview") or payload.get("banner_url") or ""
    
    # Konversi Base64 menjadi Public URL ImgBB (https://i.ibb.co/...)
    public_banner_url = unggah_gambar_ke_imgbb(raw_banner)

    # Validasi: Jika ImgBB gagal dan output masih Base64, jangan kirim Base64 ke parameter banner_url
    if public_banner_url and not public_banner_url.startswith("http"):
        print("[WARNING] Gagal membuat URL publik, mengosongkan banner_url agar tidak memicu crash di Buffer")
        public_banner_url = ""

    payload_make = {
        "nama_produk": info_produk.get("nama", payload.get("nama_produk", "Produk")),
        "kategori": info_produk.get("kategori", payload.get("kategori", "Umum")),
        "harga_tampilan": strategi_harga.get("format_tampilan_lokal", ""),
        "postingan_instagram": aset.get("postingan_instagram", ""),
        "postingan_facebook": aset.get("postingan_facebook", ""),
        "postingan_linkedin": aset.get("postingan_linkedin", ""),
        "postingan_x_twitter": aset.get("postingan_x_twitter", ""),
        "banner_url": public_banner_url,
        "region": data_doc.get("region_kompetitor", "Indonesia"),
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

    try:
        res = requests.post(
            webhook_url, 
            json=payload_make, 
            headers={"Content-Type": "application/json"}, 
            timeout=30
        )
        print(f"[INFO] Respons Make.com Webhook: Status {res.status_code}")
        return {"success": res.status_code in [200, 201, 204]}
    except Exception as e:
        print(f"[ERROR] Gagal kirim ke webhook Make.com: {e}")
        return {"success": False, "error": str(e)}