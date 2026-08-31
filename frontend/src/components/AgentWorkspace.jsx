import React, { useEffect, useRef } from 'react';

const AGENTS = [
  { id: 'intelligence', name: 'Intelligence Agent', role: 'Scraping, Kurs & Riset Pasar', icon: '🌐' },
  { id: 'strategy', name: 'Strategy Agent', role: 'Pricing Engine & Kampanye Direktif', icon: '🧠' },
  { id: 'creative', name: 'Creative Agent', role: 'Copywriting & Generasi Banner AI', icon: '🎨' },
  { id: 'executor', name: 'Executor Agent', role: 'Safety Audit & Firestore Commit', icon: '⚡' },
];

const AgentWorkspace = ({ produkInfo, selectedDraftId, logs, activeAgentIndex, isCompleted, onFinish, onCancel }) => {
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const namaProduk = produkInfo?.nama_produk || "Produk";
  const kategoriProduk = produkInfo?.kategori_produk || "Umum";

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-10 pt-8 font-sans pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-indigo-500 animate-ping"></span>
            <h1 className="text-2xl font-black tracking-tight text-white uppercase">
              Autonomous Multi-Agent Workspace
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Analysis Objectives: <span className="text-indigo-400 font-semibold">{namaProduk}</span> ({kategoriProduk})
          </p>
        </div>

        <div>
          {isCompleted ? (
            <button
              onClick={onFinish}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-600/30 transition animate-bounce"
            >
              Done & Open Dashboard &rarr;
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-indigo-950/60 border border-indigo-800 px-3.5 py-2 rounded-xl text-xs font-mono text-indigo-300">
              <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Multi-Agent is Currently Operating...</span>
            </div>
          )}
        </div>
      </div>

      {/* Agent Node Architecture*/}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6 shadow-2xl">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-6">
          Agent Execution Architecture
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {AGENTS.map((agent, index) => {
            const isActive = activeAgentIndex === index && !isCompleted;
            const isDone = activeAgentIndex > index || isCompleted;

            return (
              <div
                key={agent.id}
                className={`relative p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                  isActive
                    ? 'bg-slate-950 border-indigo-500 shadow-xl shadow-indigo-500/20 scale-105'
                    : isDone
                    ? 'bg-slate-950/50 border-slate-800 opacity-90'
                    : 'bg-slate-950/30 border-slate-800/60 opacity-40'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-2xl">{agent.icon}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                      isActive
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse'
                        : isDone
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-500'
                    }`}>
                      {isActive ? '● WORKING' : isDone ? 'DONE' : 'WAITING'}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white mb-1">{agent.name}</h3>
                  <p className="text-xs text-slate-400">{agent.role}</p>
                </div>

                {isActive && (
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
                    <div className="bg-linear-to-r from-indigo-500 to-pink-500 h-full w-full animate-pulse"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Terminal Live Stream Console Box */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 font-mono text-xs shadow-2xl">
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800 text-slate-400">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="font-bold text-slate-200 uppercase tracking-wide">
              Live Inter-Agent Execution & Cloud Stream Log
            </span>
          </div>
          <span className="text-[10px] bg-slate-900 border border-slate-800 px-2.5 py-1 rounded text-indigo-400 font-semibold">
            SSE Stream Active
          </span>
        </div>

        <div className="h-64 overflow-y-auto space-y-1.5 text-slate-300 pr-2">
          {logs.length === 0 ? (
            <p className="text-slate-600 italic">Connecting to the live agent stream...</p>
          ) : (
            logs.map((log, i) => (
              <p key={i} className="leading-relaxed">
                {log}
              </p>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="flex justify-between items-center mt-6">
         {/* Left Buttonv */}
        {!selectedDraftId ? (
          <div>
            <button
              onClick={onCancel}
              className="text-xs text-slate-400 hover:text-slate-200 transition bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl"
            >
              &larr; {selectedDraftId ? "Back to the Product Dashboard" : "Back to the Catalog"}
            </button>
          </div>
        ):(
          <div></div>
        )
        }

        {/* Right Button*/}
        <button
          onClick={onFinish}
          disabled={!isCompleted && !selectedDraftId}
          className={`text-xs font-bold px-6 py-2.5 rounded-xl transition ${
            isCompleted
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 animate-bounce cursor-pointer'
              : selectedDraftId
              ? 'bg-slate-800 text-slate-300 hover:text-white cursor-pointer'
              : 'bg-slate-900 text-slate-600 border border-slate-800/60 cursor-not-allowed opacity-50'
          }`}
        >
          {isCompleted
            ? "✓ View the Latest Dashboard Results →"
            : selectedDraftId
            ? "Go to the Dashboard Now →"
            : "⏳ Waiting for the Process to Finish..."}
        </button>
      </div>
    </div>
  );
};

export default AgentWorkspace;