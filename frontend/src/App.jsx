import React, { useState, useEffect } from 'react';
import AutomaProdukList from './components/AutomaProdukList';
import AutomaDashboard from './components/AutomaDashboard';
import AgentWorkspace from './components/AgentWorkspace';

function App() {
  const [currentView, setCurrentView] = useState('list');
  const [selectedDraftId, setSelectedDraftId] = useState(null);
  const [activeProdukData, setActiveProdukData] = useState(null);
  const [isBackgroundAnalyzing, setIsBackgroundAnalyzing] = useState(false);
  const [globalLogs, setGlobalLogs] = useState([]);
  const [activeAgentIndex, setActiveAgentIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_BASE_URL;
    const eventSource = new EventSource(`${API_URL}/api/stream-logs`);

    eventSource.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      setGlobalLogs((prev) => [...prev, data]);

      if (data.includes("ID:") || data.toLowerCase().includes("firestore")) {
        const match = data.match(/ID:\s*([A-Za-z0-9_-]+)/);
        if (match && match[1]) {
          setSelectedDraftId(match[1]);
        }
      }

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

  const handleStartNewAnalysis = async (formData) => {
    setActiveProdukData(formData);
    setSelectedDraftId(null); 
    setGlobalLogs([]);
    setActiveAgentIndex(0);
    setIsCompleted(false);
    setIsBackgroundAnalyzing(true);
    setCurrentView('workspace');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/analisis-produk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const json = await res.json();
        if (json?.draft_id || json?.id) {
          setSelectedDraftId(json.draft_id || json.id);
        }
      }
    } catch (err) {
      console.error("Gagal memulai analisis:", err);
    }
  };

  const handleSelectExistingProduk = (draftId, draftData) => {
    setSelectedDraftId(draftId);
    setActiveProdukData(draftData);
    setIsBackgroundAnalyzing(false); 
    setCurrentView('dashboard');
  };

  const handleOpenWorkspaceView = (draftData) => {
    if (draftData) setActiveProdukData(draftData);
    setCurrentView('workspace');
  };

  const handleReanalyzeManual = async (draftData) => {
    setActiveProdukData(draftData);
    setGlobalLogs([]);
    setActiveAgentIndex(0);
    setIsCompleted(false);
    setIsBackgroundAnalyzing(true);
    setCurrentView('workspace');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/analisis-produk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftData),
      });
      
      if (res.ok) {
        const json = await res.json();
        if (json?.draft_id || json?.id) {
          setSelectedDraftId(json.draft_id || json.id);
        }
      }
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

      {/* Workspace View */}
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
              setCurrentView('list');
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