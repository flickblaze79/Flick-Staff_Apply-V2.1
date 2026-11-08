import React, { useState } from 'react';
import { Github, Key, CheckCircle2, AlertCircle, Loader2, Send, RefreshCw, ExternalLink } from 'lucide-react';

export const GitHubSyncCard: React.FC = () => {
  const [repoName, setRepoName] = useState<string>(
    localStorage.getItem('flick_gh_repo') || 'flickblaze79/FLICK-web-STAFF-APPLY-V2'
  );
  const [token, setToken] = useState<string>(
    localStorage.getItem('flick_gh_token') || ''
  );
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSaveConfig = () => {
    localStorage.setItem('flick_gh_repo', repoName.trim());
    localStorage.setItem('flick_gh_token', token.trim());
    setSyncStatus('GitHub configuration saved successfully!');
    setTimeout(() => setSyncStatus(null), 3000);
  };

  const handleManualSync = async () => {
    if (!token.trim()) {
      setErrorMsg('Please enter a valid GitHub Personal Access Token (PAT).');
      return;
    }
    if (!repoName.trim()) {
      setErrorMsg('Please enter your GitHub repository (e.g. username/repo).');
      return;
    }

    setSyncing(true);
    setErrorMsg(null);
    setSyncStatus(null);

    try {
      // Test connection to GitHub API repo endpoint
      const res = await fetch(`https://api.github.com/repos/${repoName.trim()}`, {
        headers: {
          Authorization: `token ${token.trim()}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!res.ok) {
        throw new Error(`GitHub API authentication failed (${res.status}: ${res.statusText}). Check your Token and Repository name.`);
      }

      const repoData = await res.json();
      setSyncStatus(`Successfully connected to ${repoData.full_name}! (Default branch: ${repoData.default_branch})`);
      
      // Prompt user to download complete ZIP for seamless deployment or trigger GitHub Pages rebuild
      setTimeout(() => {
        setSyncStatus('Repository verified! You can also download the complete project ZIP below to upload anytime.');
      }, 2000);
    } catch (err: any) {
      console.error('GitHub sync error:', err);
      setErrorMsg(err?.message || 'Failed to connect to GitHub. Verify your Personal Access Token permissions (repo scope required).');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-panel border border-secondary/30 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
      <div className="flex items-center justify-between border-b border-secondary/20 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl border border-purple-500/30">
            <Github className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-white uppercase tracking-wider">GitHub Repository Sync</h3>
            <p className="text-xs text-slate-400 font-medium">Connect via Personal Access Token (PAT) for direct updates</p>
          </div>
        </div>
        <a
          href="https://github.com/settings/tokens"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-canvas hover:bg-slate-800 text-slate-300 border border-secondary/30 rounded-xl text-xs font-bold transition-all"
        >
          <span>Get Token</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="space-y-4">
        {errorMsg && (
          <div className="p-3.5 bg-red-950/80 border border-red-700/80 rounded-xl text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="font-semibold leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {syncStatus && (
          <div className="p-3.5 bg-emerald-950/80 border border-emerald-700/80 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold leading-relaxed">{syncStatus}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">GitHub Repository (Owner/Repo)</label>
          <input
            type="text"
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            placeholder="e.g. flickblaze79/FLICK-web-STAFF-APPLY-V2"
            className="w-full bg-canvas border border-secondary/30 rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-purple-500 font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-300 uppercase tracking-wider block flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-purple-400" /> Personal Access Token (PAT)
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="w-full bg-canvas border border-secondary/30 rounded-2xl py-3 px-4 text-xs text-white outline-none focus:border-purple-500 font-mono"
          />
          <p className="text-[10px] text-slate-500 font-medium">Requires 'repo' scope permissions in GitHub developer settings.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleSaveConfig}
            className="px-5 py-3 bg-canvas hover:bg-slate-800 text-slate-200 border border-secondary/30 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md"
          >
            Save Token
          </button>
          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="flex-1 py-3 px-5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Verifying & Syncing with GitHub...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4 text-white" />
                <span>Test Connection & Sync Repository</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
