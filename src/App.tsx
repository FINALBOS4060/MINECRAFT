import React, { useState } from 'react';
import FallingBlocksCanvas from './components/FallingBlocksCanvas';
import { PYTHON_SCRIPT } from './pythonScript';
import { Code2, Play, Download, Copy, Check } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(PYTHON_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([PYTHON_SCRIPT], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'falling_blocks.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Play size={18} className="text-white ml-0.5" />
          </div>
          <span className="text-slate-100 font-bold tracking-tight">Falling Blocks Stream</span>
        </div>

        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'preview' 
                ? 'bg-slate-800 text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Play size={16} />
            Live Web Preview
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'code' 
                ? 'bg-slate-800 text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Code2 size={16} />
            Python Script
          </button>
        </div>

        <div className="w-32 flex justify-end">
          {activeTab === 'code' && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Download size={16} />
              Download .py
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden">
        {activeTab === 'preview' ? (
          <FallingBlocksCanvas />
        ) : (
          <div className="h-full w-full bg-[#1e1e1e] flex flex-col">
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800/50 bg-[#252526]">
              <span className="text-slate-300 font-mono text-sm">falling_blocks.py</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
              >
                {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <pre className="font-mono text-sm text-slate-300 leading-relaxed">
                <code>{PYTHON_SCRIPT}</code>
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
