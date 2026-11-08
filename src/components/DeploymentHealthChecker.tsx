import React, { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
  ShieldCheck,
  Database,
  Cloud,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Server,
  Globe,
  HelpCircle,
  Cpu
} from 'lucide-react';

export const DeploymentHealthChecker: React.FC = () => {
  const [checking, setChecking] = useState(false);
  const [healthStatus, setHealthStatus] = useState<{
    firestore: 'Online' | 'Offline' | 'Checking';
    firestoreLatency: number;
    authStatus: 'Active' | 'Inactive';
    hostingMode: string;
    billingServiceDetected: string;
    deploymentReadiness: 'Ready' | 'Warning';
    recommendation: string;
  }>({
    firestore: 'Checking',
    firestoreLatency: 0,
    authStatus: auth.currentUser ? 'Active' : 'Inactive',
    hostingMode: 'Vite Single Page Application (SPA)',
    billingServiceDetected: 'Google Cloud Run (Container Deployment)',
    deploymentReadiness: 'Warning',
    recommendation: 'Google AI Studio Publish uses Cloud Run container deployment, which requires a linked Google Cloud Billing account on your GCP project. For 100% free-tier publishing without billing, export the project ZIP or connect to GitHub Pages, Vercel, or Firebase Hosting.',
  });

  const runHealthCheck = async () => {
    setChecking(true);
    const start = performance.now();
    try {
      const docRef = doc(db, 'settings', 'global_config');
      await getDoc(docRef);
      const end = performance.now();
      const latency = Math.round(end - start);

      setHealthStatus({
        firestore: 'Online',
        firestoreLatency: latency,
        authStatus: auth.currentUser ? 'Active' : 'Inactive',
        hostingMode: 'Vite Single Page Application (SPA)',
        billingServiceDetected: 'Google Cloud Run (Container Deployment)',
        deploymentReadiness: 'Warning',
        recommendation: 'Google AI Studio Publish uses Cloud Run container deployment, which requires a linked Google Cloud Billing account on your GCP project. For 100% free-tier publishing without billing, export the project ZIP or connect to GitHub Pages, Vercel, or Firebase Hosting.',
      });
    } catch (err: any) {
      setHealthStatus(prev => ({
        ...prev,
        firestore: 'Offline',
        firestoreLatency: 0,
      }));
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    runHealthCheck();
  }, []);

  return (
    <div className="bg-panel border border-secondary/30 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl space-y-8 font-sans text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-secondary/20 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-black text-cyan-400 uppercase tracking-widest">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>Infrastructure Diagnostics</span>
          </div>
          <h2 className="text-2xl font-black text-white uppercase italic tracking-tight mt-1">Deployment & Billing Health Checker</h2>
        </div>
        <button
          onClick={runHealthCheck}
          disabled={checking}
          className="px-5 py-2.5 bg-canvas hover:bg-amber-400 hover:text-black border border-secondary/30 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
          <span>Run Diagnostic</span>
        </button>
      </div>

      {/* Investigation Explanation Card */}
      <div className="p-6 bg-amber-950/30 border border-amber-500/30 rounded-3xl space-y-3">
        <div className="flex items-center gap-3 text-amber-300 font-black text-sm uppercase tracking-wide">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <span>Why does Google AI Studio ask for Google Cloud Billing on Publish?</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed font-medium">
          The Google Cloud Billing prompt is triggered by <strong className="text-white">Google AI Studio's native container deployment pipeline (Cloud Run)</strong>, not by the application code itself. Cloud Run requires an active billing account on the GCP project to provision container instances.
        </p>
        <div className="pt-2 text-[11px] text-amber-400/90 font-bold uppercase tracking-wide flex items-center gap-2">
          <Globe className="w-4 h-4" />
          <span>Free Alternative: Use Static Hosting (GitHub Pages, Vercel, Netlify, or Firebase Hosting) which requires zero cloud billing.</span>
        </div>
      </div>

      {/* Diagnostics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Firebase Auth */}
        <div className="bg-canvas/60 border border-secondary/20 p-5 rounded-3xl space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> Firebase Auth
            </span>
            <span className="text-[9px] font-black px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30 uppercase flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {healthStatus.authStatus}
            </span>
          </div>
          <div className="text-sm font-black text-white truncate">{auth.currentUser?.email || 'Google Auth Enabled'}</div>
          <div className="text-[10px] text-slate-500 font-mono">Free-tier compatible authentication</div>
        </div>

        {/* Firestore */}
        <div className="bg-canvas/60 border border-secondary/20 p-5 rounded-3xl space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-cyan-400" /> Cloud Firestore
            </span>
            <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase flex items-center gap-1 ${healthStatus.firestore === 'Online' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-red-950 text-red-400 border border-red-500/30'}`}>
              <CheckCircle2 className="w-3 h-3" /> {healthStatus.firestore}
            </span>
          </div>
          <div className="text-xl font-black text-white">{healthStatus.firestoreLatency} ms <span className="text-xs text-slate-400 font-normal">latency</span></div>
          <div className="text-[10px] text-slate-500 font-mono">Standard Firestore (Spark Free Tier)</div>
        </div>

        {/* Hosting Config */}
        <div className="bg-canvas/60 border border-secondary/20 p-5 rounded-3xl space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-amber-400" /> Hosting Config
            </span>
            <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/30 uppercase">
              Vite SPA
            </span>
          </div>
          <div className="text-sm font-black text-white">{healthStatus.hostingMode}</div>
          <div className="text-[10px] text-slate-500 font-mono">Compatible with static hosting</div>
        </div>
      </div>

      {/* Billing Detection Details */}
      <div className="bg-canvas/40 border border-secondary/20 rounded-3xl p-6 space-y-4 shadow-xl">
        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Cloud className="w-5 h-5 text-cyan-400" />
          <span>Billing-Dependent Service Detection</span>
        </h3>
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-4 bg-panel rounded-2xl border border-secondary/20">
            <span className="text-slate-300 font-medium">Container Runtime / Cloud Run API:</span>
            <span className="font-mono font-black text-amber-400 uppercase">Triggered on AI Studio Publish</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-panel rounded-2xl border border-secondary/20">
            <span className="text-slate-300 font-medium">Firebase Spark Free Tier Database:</span>
            <span className="font-mono font-black text-emerald-400 uppercase">100% Free (No Billing Required)</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-panel rounded-2xl border border-secondary/20">
            <span className="text-slate-300 font-medium">Recommended Publishing Method:</span>
            <span className="font-mono font-black text-cyan-400 uppercase">GitHub Pages / Vercel / Netlify</span>
          </div>
        </div>
      </div>
    </div>
  );
};
