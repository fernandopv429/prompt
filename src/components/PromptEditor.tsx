import React, { useState, useEffect } from 'react';
import { Save, History, Clock, Trash2 } from 'lucide-react';
import { Prompt, PromptVersion } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface PromptEditorProps {
  prompt: Prompt;
  onSaveSuccess: (prompt: Prompt) => void;
}

export default function PromptEditor({ prompt, onSaveSuccess }: PromptEditorProps) {
  const [content, setContent] = useState(prompt.latest_content || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Sync initial content if prompt changes
  useEffect(() => {
    setContent(prompt.latest_content || '');
    setIsHistoryOpen(false);
  }, [prompt.id]);

  const fetchVersions = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/prompts/${prompt.id}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const toggleHistory = () => {
    if (!isHistoryOpen) {
      fetchVersions();
    }
    setIsHistoryOpen(!isHistoryOpen);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/prompts/${prompt.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const newVersion = await res.json();
        onSaveSuccess({ ...prompt, latest_content: newVersion.content });
        if (isHistoryOpen) {
          fetchVersions();
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestore = (versionContent: string) => {
    setContent(versionContent);
    // Note: We don't save immediately, we just load it into the editor so the user can review and save.
  };

  const handleDeleteVersion = async (versionId: string) => {
    try {
      const res = await fetch(`/api/prompt_versions/${versionId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setVersions(versions.filter(v => v.id !== versionId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (hasChanges && !isSaving) {
        handleSave();
      }
    }
  };

  const hasChanges = content !== prompt.latest_content;

  return (
    <div className="flex h-full w-full">
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold text-slate-800">Prompt Editor</h1>
            <span className="text-xs text-slate-400 mt-0.5">
              {hasChanges ? 'Unsaved changes' : 'All changes saved'}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleHistory}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isHistoryOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <History className="w-4 h-4" />
              <span>History</span>
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="flex items-center space-x-2 px-4 py-1.5 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Save (Ctrl+Enter or Cmd+Enter)"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Version'}</span>
            </button>
          </div>
        </header>
        
        <div className="flex-1 p-6 bg-slate-50/50">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-full p-4 rounded-lg border border-slate-200 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none font-mono text-sm leading-relaxed text-slate-800 bg-white"
            placeholder="Type your prompt here... (Press Cmd+Enter or Ctrl+Enter to save)"
          />
        </div>
      </div>

      {isHistoryOpen && (
        <div className="w-80 border-l border-slate-200 bg-slate-50 flex flex-col h-full shrink-0">
          <div className="p-4 border-b border-slate-200 bg-slate-100/50 flex justify-between items-center">
            <h3 className="font-medium text-slate-800 text-sm">Version History</h3>
            <span className="text-xs font-medium text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
              {versions.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isLoadingHistory ? (
              <div className="text-center text-sm text-slate-400 py-4">Loading history...</div>
            ) : versions.length === 0 ? (
              <div className="text-center text-sm text-slate-400 py-4">No versions found.</div>
            ) : (
              versions.map((version, index) => (
                <div key={version.id} className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 relative group">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-1.5 text-xs font-medium text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatDistanceToNow(new Date(version.created_at))} ago</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {index === 0 && (
                        <span className="text-[10px] font-bold tracking-wide uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                          Latest
                        </span>
                      )}
                      <button
                        onClick={() => handleDeleteVersion(version.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                        title="Delete version"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 font-mono line-clamp-3 bg-slate-50 p-2 rounded border border-slate-100">
                    {version.content || <span className="text-slate-400 italic">Empty content</span>}
                  </div>
                  <button
                    onClick={() => handleRestore(version.content)}
                    className="mt-3 w-full text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded py-1.5 transition-colors"
                  >
                    Restore to Editor
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
