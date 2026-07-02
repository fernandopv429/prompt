/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Prompt } from './types';
import PromptEditor from './components/PromptEditor';
import { Database } from 'lucide-react';

export default function App() {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [isDbConfigured, setIsDbConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        setIsDbConfigured(data.hasDatabase);
        if (data.hasDatabase) {
          fetchPrompt();
        }
      })
      .catch(() => {
        setIsDbConfigured(false);
      });
  }, []);

  const fetchPrompt = async () => {
    try {
      const res = await fetch('/api/prompt');
      if (res.ok) {
        const data = await res.json();
        setPrompt(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (isDbConfigured === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-400 font-medium">Checking system state...</div>
      </div>
    );
  }

  if (isDbConfigured === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center space-y-4">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Database className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Database Connection Required</h1>
          <p className="text-slate-600 text-sm">
            Please configure your PostgreSQL connection string in the Secrets panel as <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-mono">DATABASE_URL</code>.
          </p>
          <div className="pt-4 text-xs text-slate-400">
            Once configured, the app will connect automatically.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {prompt ? (
        <PromptEditor 
          prompt={prompt}
          onSaveSuccess={(updatedPrompt) => {
            setPrompt(updatedPrompt);
          }}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-3">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center animate-pulse">
            <Database className="w-5 h-5 text-slate-300" />
          </div>
          <p>Loading prompt...</p>
        </div>
      )}
    </div>
  );
}
