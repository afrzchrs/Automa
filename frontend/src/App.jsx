import React, { useState, useEffect } from 'react';
import AutomaProdukList from './components/AutomaProdukList';
import AutomaDashboard from './components/AutomaDashboard';
import AgentWorkspace from './components/AgentWorkspace';

function App() {
  const [currentView, setCurrentView] = useState('list'); // 'list' | 'workspace' | 'dashboard'
  const [selectedDraftId, setSelectedDraftId] = useState(null);
  const [activeProdukData, setActiveProdukData] = useState(null);
  const [isBackgroundAnalyzing, setIsBackgroundAnalyzing] = useState(false);
  const [globalLogs, setGlobalLogs] = useState([]);
  const [activeAgentIndex, setActiveAgentIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  // Listener SSE tunggal & terpusat
  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_BASE_URL;
    const eventSource = new EventSource(`${API_URL}/api/stream-logs`);

    eventSource.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      setGlobalLogs((prev) => [...prev, data]);

      const lower = data.toLowerCase();
      if (lower.includes("intelligence") || lower.includes("scraping") || lower.includes("crawler") || lower.includes("meriset")) {
        setActiveAgentIndex(0);
        setIsBackgroundAnalyzing(true);
        setIsCompleted(false);
      } else if (lower.includes("strategy") || lower.includes("harga") || lower.includes("ppp") || lower.includes("margin")) {
        setActiveAgentIndex(1);
      } else if (lower.includes("creative") || lower.includes("copywriting") || lower.includes("banner") || lower.includes("gambar") || lower.includes("imagen")) {
        setActiveAgentIndex(2);
      } else if (lower.includes("executor") || lower.includes("audit") || lower.includes("firestore") || lower.includes("disimpan")) {
        setActiveAgentIndex(3);
      }

      if (lower.includes("pipeline finished") || lower.includes("pipeline selesai") || lower.includes("berhasil disimpan") || lower.includes("berhasil diperbarui")) {
        setIsCompleted(true);
        setActiveAgentIndex(3);
        setIsBackgroundAnalyzing(false);
      }
    };

    return () => eventSource.close();
  }, []);

  // 2. Tambah Produk Baru
  const handleStartNewAnalysis = async (formData) => {
    setActiveProdukData(formData);
    setSelectedDraftId(null);
    setGlobalLogs([]);
    setActiveAgentIndex(0);
    setIsCompleted(false);
    setIsBackgroundAnalyzing(true);
    setCurrentView('workspace');

    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/analisis-produk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
    } catch (err) {
      console.error("Gagal memulai analisis:", err);
    }
  };

// 3. Klik Produk Lama di List (Hanya Lihat Dasbor)
  const handleSelectExistingProduk = (draftId, draftData) => {
    setSelectedDraftId(draftId);
    setActiveProdukData(draftData);
    
    // Pastikan tidak ada status loading/analyzing yang menyala
    setIsBackgroundAnalyzing(false); 
    
    // Langsung pindah ke view Dasbor tanpa memanggil API /analisis-produk
    setCurrentView('dashboard');
  };

  // 4. Buka Layar Workspace (Hanya ganti view, log & progress tetap berjalan)
  const handleOpenWorkspaceView = (draftData) => {
    if (draftData) setActiveProdukData(draftData);
    setCurrentView('workspace');
  };

  // 5. Jalankan Ulang Agen Manual
  const handleReanalyzeManual = async (draftData) => {
    setActiveProdukData(draftData);
    setGlobalLogs([]);
    setActiveAgentIndex(0);
    setIsCompleted(false);
    setIsBackgroundAnalyzing(true);
    setCurrentView('workspace');

    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/analisis-produk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftData),
      });
    } catch (err) {
      console.error("Gagal reanalisis:", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* List View */}
      {currentView === 'list' && (
        <AutomaProdukList
          onSelectProduk={handleSelectExistingProduk}
          onStartAnalysis={handleStartNewAnalysis}
        />
      )}

      {/* Workspace View - mounted agar proses & log tidak ter-reset */}
      <div className={currentView === 'workspace' ? 'block' : 'hidden'}>
        <AgentWorkspace
          produkInfo={activeProdukData}
          selectedDraftId={selectedDraftId}
          logs={globalLogs}
          activeAgentIndex={activeAgentIndex}
          isCompleted={isCompleted}
          onFinish={() => {
            if (selectedDraftId) {
              setCurrentView('dashboard');
            } else {
              setCurrentView('dashboard');
            }
          }}
          onCancel={() => {
            if (selectedDraftId) {
              setCurrentView('dashboard');
            } else {
              setCurrentView('list');
            }
          }}
        />
      </div>

      {/* Dashboard View */}
      {currentView === 'dashboard' && (
        <AutomaDashboard
          draftId={selectedDraftId}
          isBackgroundAnalyzing={isBackgroundAnalyzing}
          onBack={() => setCurrentView('list')}
          onViewWorkspace={handleOpenWorkspaceView}
          onReanalyze={handleReanalyzeManual}
        />
      )}
    </div>
  );
}

export default App;