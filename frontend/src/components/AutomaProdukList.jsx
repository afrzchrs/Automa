import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';

const AutomaProdukList = ({ onSelectProduk, onStartAnalysis }) => {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // State untuk custom confirmation modal
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, nama: '' });
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    nama_produk: '',
    deskripsi_produk: '',
    harga_produk: '',
    kategori_produk: '',
    region_kompetitor: 'Indonesia',
    otonomi_level: 1,
  });

  useEffect(() => {
    const q = collection(db, 'campaign_approvals');
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const data = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setDrafts(data);
        setLoading(false);
      },
      (error) => {
        console.error('Product synchronization failed:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const toggleOtonomiList = async (e, id, currentLevel) => {
    e.stopPropagation(); 
    const newLevel = currentLevel === 2 ? 1 : 2;
    try {
      await updateDoc(doc(db, "campaign_approvals", id), { otonomi_level: newLevel });
    } catch (error) {
      console.error("Gagal set otonomi di list:", error);
    }
  };

  const confirmDeleteProduct = (e, id, namaProduk) => {
    e.stopPropagation(); 
    setDeleteModal({ isOpen: true, id, nama: namaProduk });
  };

  const executeDelete = async () => {
    if (!deleteModal.id) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "campaign_approvals", deleteModal.id));
      setDeleteModal({ isOpen: false, id: null, nama: '' });
    } catch (error) {
      console.error("Failed to delete product:", error);
      alert("Failed to delete product from database.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'harga_produk' ? Number(value) : value,
    }));
  };

  const handleKirimAnalisis = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setIsModalOpen(false);

    if (onStartAnalysis) {
      onStartAnalysis(formData);
    }

    setFormData({
      nama_produk: '',
      deskripsi_produk: '',
      harga_produk: '',
      kategori_produk: '',
      region_kompetitor: 'Indonesia',
      otonomi_level: 1,
    });
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-100 text-slate-200">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-mono text-xs tracking-wider text-slate-400">LOADING PRODUCT CATALOG...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-10 pt-8 font-sans pb-16">
      {/* Header Catalog */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-indigo-500 animate-pulse"></span>
            <h1 className="text-2xl font-black tracking-tight text-white uppercase">Automa Product Catalog</h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Select a product to view the results of the pricing strategy and campaign material analysis
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="bg-indigo-950/60 border border-indigo-800 text-indigo-300 text-xs px-3.5 py-2.5 rounded-xl font-mono font-semibold">
            {drafts.length} Produk
          </span>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-1.5"
          >
            <span>+</span> New Product Analysis
          </button>
        </div>
      </div>

      {/* Product Catalog Grid */}
      {drafts.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <p className="font-medium">There is no product data in the database yet.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-4 inline-block bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg"
          >
            + Start Analysing Product
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {drafts.map((draft) => {
            const banner = draft.aset_kreatif?.gambar_preview;
            const isApproved = draft.status === 'approved';
            const namaProduk = draft.informasi_produk_kita?.nama || 'Produk Tanpa Nama';
            const kategori = draft.informasi_produk_kita?.kategori || 'Kategori Umum';
            const harga =
              draft.strategi_harga?.format_tampilan_lokal ||
              `Rp ${draft.strategi_harga?.harga_nominal_lokal?.toLocaleString('id-ID') || draft.strategi_harga?.harga_idr_lokal?.toLocaleString('id-ID') || '0'}`;

            return (
              <div
                key={draft.id}
                onClick={() =>
                  onSelectProduk &&
                  onSelectProduk(draft.id, {
                    nama_produk: namaProduk,
                    kategori_produk: kategori,
                    harga_produk:
                      draft.strategi_harga?.harga_nominal_lokal ||
                      draft.strategi_harga?.harga_idr_lokal ||
                      100000,
                    region_kompetitor: draft.region_kompetitor || 'Indonesia',
                  })
                }
                className="bg-slate-900 border border-slate-800 hover:border-indigo-500/60 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1 shadow-xl flex flex-col justify-between group relative"
              >
                <div>
                  <div className="w-full h-48 bg-slate-950 border-b border-slate-800 overflow-hidden relative">
                    {banner ? (
                      <img
                        src={banner}
                        alt={namaProduk}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs font-mono">
                        No visual preview
                      </div>
                    )}
                    <span
                      className={`absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider backdrop-blur-md ${
                        isApproved ? 'bg-emerald-500/80 text-white' : 'bg-amber-500/80 text-white'
                      }`}
                    >
                      {isApproved ? '● Approved' : '● Pending'}
                    </span>
                  </div>

                  <div className="p-5">
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <h2 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">
                        {namaProduk}
                      </h2>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 capitalize">
                        {draft.region_kompetitor || 'Global'}
                      </span>
                    </div>

                    <p className="text-xs text-indigo-400 font-medium mb-3">{kategori}</p>

                    <div className="text-xl font-extrabold text-white mb-2">{harga}</div>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {draft.strategi_harga?.alasan_penetapan_harga || 'Analysis of the PPP dynamic pricing strategy.'}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="px-5 py-3.5 bg-slate-950/60 border-t border-slate-800/80 flex justify-between items-center text-xs text-slate-400">
                    <span className="font-mono text-[11px] text-slate-500">ID: {draft.id.substring(0, 8)}...</span>
                    <span className="text-indigo-400 font-semibold group-hover:translate-x-1 transition-transform">
                      Open the Dashboard &rarr;
                    </span>
                  </div>
                  
                  <div className='px-5 py-3 flex gap-2'>
                    <button
                      onClick={(e) => toggleOtonomiList(e, draft.id, draft.otonomi_level || 1)}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border flex items-center justify-center gap-2 ${
                        draft.otonomi_level === 2
                          ? 'bg-purple-900/30 text-purple-400 border-purple-500/50 hover:bg-purple-900/50'
                          : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700/50 hover:text-slate-200'
                        }`}
                    >
                      {draft.otonomi_level === 2 ? '🤖 Autopilot' : '🧑‍💻 Manual Approval'}
                    </button>

                    {/* Tombol Hapus / Delete Product Button */}
                    <button
                      onClick={(e) => confirmDeleteProduct(e, draft.id, namaProduk)}
                      title="Delete Product"
                      className="px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-900/50 rounded-lg text-[10px] font-bold transition flex items-center justify-center"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-rose-900/50 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative text-center">
            <div className="w-12 h-12 bg-rose-950/80 border border-rose-800/50 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4 text-xl shadow-lg shadow-rose-950/50">
              ⚠️
            </div>
            
            <h3 className="text-base font-bold text-white mb-1">Delete Product</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Are you sure you want to delete <span className="text-white font-semibold">"{deleteModal.nama}"</span>? This action cannot be undone and will permanently remove all multi-agent campaign records.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteModal({ isOpen: false, id: null, nama: '' })}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={executeDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Yes, Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FORM: ADD A PRODUCT TO BE ANALYSED BY AN AGENT*/}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white">Start New Product Analysis</h3>
                <p className="text-xs text-slate-400">Implement a Multi-Agent Pipeline for Your Product</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleKirimAnalisis} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Product Name</label>
                <input
                  type="text"
                  name="nama_produk"
                  required
                  placeholder="Example: Kopi Luwak Premium"
                  value={formData.nama_produk}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Product Category</label>
                <input
                  type="text"
                  name="kategori_produk"
                  required
                  placeholder="Example: Drink / SaaS / App"
                  value={formData.kategori_produk}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Target Price (IDR / Nominal)</label>
                  <input
                    type="number"
                    name="harga_produk"
                    required
                    placeholder="Example: 150000"
                    value={formData.harga_produk}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Target Market Region</label>
                  <input
                    type="text"
                    name="region_kompetitor"
                    required
                    placeholder="Example: Indonesia / Global"
                    value={formData.region_kompetitor}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-kd px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Product Description</label>
                <textarea
                  rows={3}
                  name="deskripsi_produk"
                  required
                  placeholder="Example: Premium coffee with a distinctive flavor and strong aroma..."
                  value={formData.deskripsi_produk}
                  onChange={handleChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    submitting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <span>🚀 Run the Agent Analysis</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomaProdukList;