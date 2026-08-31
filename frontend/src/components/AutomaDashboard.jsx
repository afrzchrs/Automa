import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';

const AutomaDashboard = ({ draftId, isBackgroundAnalyzing, onBack, onViewWorkspace, onReanalyze }) => {
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('banner');
  const [editableAset, setEditableAset] = useState({});
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [modalStatus, setModalStatus] = useState({ success: true, message: '' });
  const [otonomi_level, setOtonomiLevel] = useState(1);
  
  useEffect(() => {
    if (!draftId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const docRef = doc(db, "campaign_approvals", draftId);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          setDraft(data);
          setEditableAset(data.aset_kreatif || {});
        }
        setLoading(false);
      },
      (error) => {
        console.error("Product data synchronization failed:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [draftId]);

  const handleTextChange = (field, value) => {
    setEditableAset((prev) => ({ ...prev, [field]: value }));
  };

  const handleToggleOtonomi = async () => {
    const currentLevel = draft.otonomi_level || 1;
    const newLevel = currentLevel === 1 ? 2 : 1;
    try {
      const docRef = doc(db, "campaign_approvals", draftId);
      await updateDoc(docRef, { otonomi_level: newLevel });
    } catch (err) {
      console.error("Failure to change the level of autonomy:", err);
    }
  };

  const handlePilihBannerRiwayat = async (bannerUrl) => {
    handleTextChange('gambar_preview', bannerUrl);
    try {
      const docRef = doc(db, "campaign_approvals", draftId);
      await updateDoc(docRef, { "aset_kreatif.gambar_preview": bannerUrl });
    } catch (err) {
      console.error("Failed to replace the banner:", err);
    }
  };

  // Integrated Approval & Publishing Functionality (Firestore + Make.com Webhooks)
  const handleApprove = async () => {
    setIsPublishing(true);
    try {
      const activeBanner = editableAset.gambar_preview || draft.aset_kreatif?.gambar_preview;
      const docRef = doc(db, "campaign_approvals", draftId);

      // 1. Save draf to Firestore
      await updateDoc(docRef, {
        status: "approved",
        aset_kreatif: editableAset,
        ...(activeBanner ? { banner_history: arrayUnion(activeBanner) } : {}),
      });

      // 2. Send a publish command to the FastAPI backend -> Forward it to Make.com
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/publish-campaign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft_id: draftId }),
      });

      if (!res.ok) {
        throw new Error("Failed to send the payload to the Make.com webhook");
      }

      setModalStatus({
        success: true,
        message: "The campaign was successfully approved and forwarded to Make.com & Buffer!",
      });
    } catch (error) {
      console.error("Gagal publikasi:", error);
      setModalStatus({
        success: false,
        message: error.message || "An issue occurred while publishing the campaign.",
      });
    } finally {
      setIsPublishing(false);
      setShowPublishModal(true);
    }
  };

  const downloadBanner = (base64Url) => {
    if (!base64Url) return;
    const link = document.createElement("a");
    link.href = base64Url;
    link.download = `automa-banner-${draftId.substring(0, 6)}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const kirimKeWorkspace = () => {
    if (onViewWorkspace && draft) {
      onViewWorkspace({
        nama_produk: draft.informasi_produk_kita?.nama || "Produk",
        deskripsi_produk: draft.informasi_produk_kita?.deskripsi || "",
        harga_produk: draft.strategi_harga?.harga_nominal_lokal || draft.strategi_harga?.harga_idr_lokal || 100000,
        kategori_produk: draft.informasi_produk_kita?.kategori || "Umum",
        region_kompetitor: draft.region_kompetitor || "Indonesia"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-100 text-slate-200">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-mono text-xs tracking-wider text-slate-400">LOADING PRODUCT DETAILS...</p>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="max-w-6xl mx-auto px-6 pt-12 text-center text-slate-400">
        <p>No product campaign data was found.</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold">
          &larr; Back to the Catalog
        </button>
      </div>
    );
  }

  const isApproved = draft.status === 'approved' || draft.status === 'published';
  const bannerAktif = editableAset.gambar_preview || draft.aset_kreatif?.gambar_preview;
  const daftarRiwayatBanner = draft.riwayat_banner || (bannerAktif ? [bannerAktif] : []);
  const namaProduk = draft.informasi_produk_kita?.nama || "Analisis Produk";

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-10 pt-8 font-sans pb-16 space-y-4">
      {/* Active Agent Notification Banner Background */}
      {isBackgroundAnalyzing && (
        <div className="bg-indigo-950/90 border border-indigo-500/50 rounded-2xl px-5 py-3 flex justify-between items-center text-xs shadow-lg shadow-indigo-950/40 animate-pulse">
          <div className="flex items-center gap-2.5 text-indigo-200">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="font-semibold">⚡ Multi-Agent is currently running a new price and material analysis in the background...</span>
          </div>
          <button
            onClick={kirimKeWorkspace}
            className="text-white bg-indigo-600 hover:bg-indigo-500 px-3.5 py-1.5 rounded-xl font-bold transition shadow"
          >
            View Live Workspace &rarr;
          </button>
        </div>
      )}

      {/* Top Header Nav */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
        >
          &larr; Back to the Catalog
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setOtonomiLevel(prev => prev === 1 ? 2 : 1)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition ${
              (otonomi_level === 2)
                ? 'bg-purple-600/20 text-purple-400 border-purple-500/50 hover:bg-purple-600/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Change the Autopilot Execution Mode"
          >
            {otonomi_level === 2 ? '🤖 Autopilot Execution' : '🧑‍💻 Execution: Manual'}
          </button>
          <button
            onClick={kirimKeWorkspace}
            className="bg-slate-900 hover:bg-indigo-950/50 border border-indigo-800/80 text-indigo-300 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-sm hover:border-indigo-500"
          >
            <span>📡 Workspace Console</span>
          </button>
          
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider ${
            isApproved ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
          }`}>
            {isApproved ? '● Ready for Publish' : '● Pending Approval'}
          </span>
        </div>
      </div>

      {/* Main Card Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-6">
        <div className="mb-6 pb-4 border-b border-slate-800 flex flex-wrap justify-between items-center gap-3">
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">{namaProduk}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Category: {draft.informasi_produk_kita?.kategori || "Umum"} | Region: {draft.region_kompetitor || "Indonesia"}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (onReanalyze) {
                  onReanalyze({
                    nama_produk: namaProduk,
                    deskripsi_produk: draft.informasi_produk_kita?.deskripsi || "",
                    harga_produk: draft.strategi_harga?.harga_nominal_lokal || draft.strategi_harga?.harga_idr_lokal || 100000,
                    kategori_produk: draft.informasi_produk_kita?.kategori || "Umum",
                    region_kompetitor: draft.region_kompetitor || "Indonesia",
                    otonomi_level: otonomi_level
                  });
                }
              }}
              className="bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-2 transition"
            >
              <span>🔄</span>
              <span>Restart the Agent</span>
            </button>
            <span className="text-xs text-slate-500 font-mono">
              Update: {draft.waktu_dibuat ? new Date(draft.waktu_dibuat).toLocaleTimeString('id-ID') : 'Baru saja'}
            </span>
          </div>
        </div>

        {/* 2-Column Aligned Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column: Pricing & Banner History*/}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-5">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pricing Engine (PPP)</h3>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900">
                  {draft.strategi_harga?.harga_usd_global ? `$${draft.strategi_harga.harga_usd_global} USD Global` : 'Dynamic'}
                </span>
              </div>
              <div className="text-3xl font-extrabold text-white">
                {draft.strategi_harga?.format_tampilan_lokal ||
                  `Rp ${draft.strategi_harga?.harga_nominal_lokal?.toLocaleString('id-ID') || draft.strategi_harga?.harga_idr_lokal?.toLocaleString('id-ID') || '0'}`}
              </div>
              <p className="text-xs text-slate-400 mt-3 leading-relaxed border-t border-slate-800/60 pt-3">
                {draft.strategi_harga?.alasan_penetapan_harga || 'Adjustments for local purchasing power and exchange rate fluctuations.'}
              </p>
            </div>

            {/* Riwayat Banner Visual */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-5 flex-1 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Select a Visual Banner Version ({daftarRiwayatBanner.length})
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {daftarRiwayatBanner.map((imgUrl, index) => {
                    const isSelected = imgUrl === bannerAktif;
                    return (
                      <div
                        key={index}
                        onClick={() => handlePilihBannerRiwayat(imgUrl)}
                        className={`relative rounded-lg overflow-hidden border-2 cursor-pointer aspect-square group transition ${
                          isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <img src={imgUrl} alt={`Versi ${index + 1}`} className="w-full h-full object-cover" />
                        {isSelected && (
                          <div className="absolute top-1 right-1 bg-indigo-600 text-white rounded-full p-0.5 text-[10px]">
                            ✓
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-3 italic">
                New banners are automatically added to the list without overwriting the previous history.
              </p>
            </div>
          </div>

          {/* Right Column: Channel Content Previews & Actions */}
          <div className="lg:col-span-7 flex flex-col justify-between h-full">
            <div className="flex-1 flex flex-col">
              {/* Navigation Tab */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4 overflow-x-auto">
                {[
                  { key: 'banner', label: 'Banner Visual', icon: '🖼️' },
                  { key: 'instagram', label: 'Instagram', icon: '📷' },
                  { key: 'facebook', label: 'Facebook', icon: '📘' },
                  { key: 'linkedin', label: 'LinkedIn', icon: '💼' },
                  { key: 'x', label: 'X (Twitter)', icon: '🐦' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      activeTab === tab.key
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Draft Content Panel */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex-1 flex flex-col justify-between">
                {activeTab === 'banner' && (
                  <div className="flex-1 flex flex-col justify-between space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-slate-300">Active Banner Ready for Publication</span>
                      {bannerAktif && (
                        <button
                          onClick={() => downloadBanner(bannerAktif)}
                          className="text-[11px] bg-slate-800 hover:bg-slate-700 text-indigo-300 px-2.5 py-1 rounded border border-slate-700 transition"
                        >
                          ⬇️ Download JPG
                        </button>
                      )}
                    </div>
                    {bannerAktif ? (
                      <div className="rounded-xl overflow-hidden border border-slate-800 max-w-sm mx-auto shadow-2xl my-auto">
                        <img src={bannerAktif} alt="Banner Aktif" className="w-full h-auto aspect-square object-cover" />
                      </div>
                    ) : (
                      <div className="flex h-48 items-center justify-center text-slate-500 text-xs">
                        There is no visual banner preview.
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'instagram' && (
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-7 flex flex-col h-full justify-between">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-linear-to-tr from-yellow-500 via-pink-500 to-purple-600 p-[1.5px]">
                          <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center text-[9px]">📷</div>
                        </div>
                        <p className="text-xs font-bold text-white">Instagram Feed Draft</p>
                      </div>
                      <textarea
                        rows={8}
                        value={editableAset.postingan_instagram || ''}
                        onChange={(e) => handleTextChange('postingan_instagram', e.target.value)}
                        className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs leading-relaxed text-slate-200 resize-none focus:outline-none focus:border-indigo-500/60 flex-1"
                        placeholder="Caption Instagram..."
                      />
                    </div>
                    <div className="md:col-span-5 flex justify-center">
                      {bannerAktif && (
                        <div className="rounded-xl overflow-hidden border border-slate-800 shadow-xl max-w-50 aspect-square">
                          <img src={bannerAktif} alt="Instagram Visual" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'facebook' && (
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-7 flex flex-col h-full justify-between">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs text-white">f</div>
                        <p className="text-xs font-bold text-white">Facebook Ad Draft</p>
                      </div>
                      <textarea
                        rows={8}
                        value={editableAset.postingan_facebook || ''}
                        onChange={(e) => handleTextChange('postingan_facebook', e.target.value)}
                        className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs leading-relaxed text-slate-200 resize-none focus:outline-none focus:border-blue-500/60 flex-1"
                        placeholder="Caption Facebook..."
                      />
                    </div>
                    <div className="md:col-span-5 flex justify-center">
                      {bannerAktif && (
                        <div className="rounded-xl overflow-hidden border border-slate-800 shadow-xl max-w-50 aspect-square">
                          <img src={bannerAktif} alt="Facebook Visual" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'linkedin' && (
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-7 flex flex-col h-full justify-between">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs text-white">in</div>
                        <p className="text-xs font-bold text-white">LinkedIn Post Draft</p>
                      </div>
                      <textarea
                        rows={8}
                        value={editableAset.postingan_linkedin || ''}
                        onChange={(e) => handleTextChange('postingan_linkedin', e.target.value)}
                        className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs leading-relaxed text-slate-200 resize-none focus:outline-none focus:border-indigo-500/60 flex-1"
                        placeholder="Caption LinkedIn..."
                      />
                    </div>
                    <div className="md:col-span-5 flex justify-center">
                      {bannerAktif && (
                        <div className="rounded-xl overflow-hidden border border-slate-800 shadow-xl max-w-50 aspect-square">
                          <img src={bannerAktif} alt="LinkedIn Visual" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'x' && (
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-7 flex flex-col h-full justify-between">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-white">𝕏</div>
                        <p className="text-xs font-bold text-white">X Post Draft</p>
                      </div>
                      <textarea
                        rows={8}
                        value={editableAset.postingan_x_twitter || ''}
                        onChange={(e) => handleTextChange('postingan_x_twitter', e.target.value)}
                        className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs leading-relaxed text-slate-200 resize-none focus:outline-none focus:border-indigo-500/60 flex-1"
                        placeholder="Tweet X..."
                      />
                    </div>
                    <div className="md:col-span-5 flex justify-center">
                      {bannerAktif && (
                        <div className="rounded-xl overflow-hidden border border-slate-800 shadow-xl max-w-50 aspect-square">
                          <img src={bannerAktif} alt="X Visual" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tombol Simpan & Publish */}
            <div className="flex items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-800">
              <span className="text-[11px] text-slate-500 italic">
                Data is updated directly in the same product document.
              </span>
              <button
                onClick={handleApprove}
                disabled={isPublishing}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
                  isPublishing
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 cursor-pointer'
                }`}
              >
                {isPublishing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Sending to Webhook...</span>
                  </>
                ) : (
                  <span>⚡ Approve & Publish</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Modern Dark-Theme Popup Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl shadow-indigo-500/10 text-center">
            {/* Glow Ambient Effect */}
            <div className={`absolute -top-10 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-40 ${
              modalStatus.success ? 'bg-emerald-500' : 'bg-rose-500'
            }`}></div>

            {/* Icon */}
            <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border ${
              modalStatus.success 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}>
              <span className="text-3xl">{modalStatus.success ? '🚀' : '⚠️'}</span>
            </div>

            {/* Content */}
            <h3 className="text-lg font-black tracking-tight text-white uppercase mb-2">
              {modalStatus.success ? "Publication Successful!" : "Failed Execution"}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              {modalStatus.message}
            </p>

            {/* Button */}
            <button
              onClick={() => setShowPublishModal(false)}
              className={`w-full py-3 px-5 rounded-xl text-xs font-bold text-white transition-all shadow-lg cursor-pointer ${
                modalStatus.success
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                  : 'bg-slate-800 hover:bg-slate-700 shadow-slate-900/50'
              }`}
            >
              Understood & Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomaDashboard;