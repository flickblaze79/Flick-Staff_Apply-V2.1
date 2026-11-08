import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Mail, User, AlertCircle } from 'lucide-react';

export const OwnerDiagnosticPanel: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  
  if (!currentUser || !userProfile || userProfile.role !== 'OWNER') {
    return <div className="p-4 bg-red-950/20 text-red-300 border border-red-500/20 rounded-xl">Access Denied</div>;
  }

  return (
    <div className="bg-panel border border-secondary/30 rounded-3xl p-6 space-y-4 shadow-xl">
      <h3 className="text-lg font-black text-white uppercase flex items-center gap-2">
        <ShieldCheck className="text-primary" /> Owner Diagnostic Panel
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
        <div className="bg-canvas p-3 rounded-lg border border-secondary/20">
          <span className="text-slate-500 block">UID:</span>
          {currentUser.uid}
        </div>
        <div className="bg-canvas p-3 rounded-lg border border-secondary/20">
          <span className="text-slate-500 block">Email:</span>
          {currentUser.email}
        </div>
        <div className="bg-canvas p-3 rounded-lg border border-secondary/20">
          <span className="text-slate-500 block">Firestore Role:</span>
          <span className="font-bold text-amber-400">{userProfile.role}</span>
        </div>
        <div className="bg-canvas p-3 rounded-lg border border-secondary/20">
          <span className="text-slate-500 block">Owner Status:</span>
          <span className="font-bold text-emerald-400">VERIFIED</span>
        </div>
      </div>
    </div>
  );
};
