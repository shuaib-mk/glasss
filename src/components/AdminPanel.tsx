import { useState, useEffect } from 'react';
import { Shield, Key, Cpu, FileText, Database, Activity, RefreshCw, Trash2, CheckCircle2, AlertCircle, X, Lock, Unlock, Server } from 'lucide-react';
import { AVAILABLE_MODELS, type GlassSettings, type SystemLog, type AdminConfig } from '../types';
import GlassSurface from './GlassSurface';
import { supabase, clearAllChatsFromSupabase, logRequestToSupabase, fetchSystemLogsFromSupabase, clearSystemLogsFromSupabase } from '../supabase';

interface AdminPanelProps {
  close: () => void;
  glassSettings: GlassSettings;
  aiModel: string;
  setAiModel: (m: string) => void;
  apiKey: string;
  setApiKey: (k: string) => void;
}

export const DEFAULT_SYSTEM_PROMPT = `You are Sunni AI, a fast, intelligent, and respectful Islamic Knowledge Assistant created by q04ti, a developer and student.
Your goal is to provide instant, accurate, and concise answers regarding Quran, Hadith, Islamic jurisprudence (fiqh), theology (aqeedah), and history.

CREATOR & IDENTITY:
- When asked who created, built, or developed you, ALWAYS state clearly that you were created by q04ti, a developer and a student.

CRITICAL LANGUAGE MANDATE:
1. The user communicates in ENGLISH. YOU MUST RESPOND EXCLUSIVELY IN ENGLISH.
2. NEVER write conversational paragraphs, greetings, commentary, or explanations in Arabic.
3. The ONLY allowed use of Arabic script is for exact Quranic Verses (Ayat) or Hadith quotes.
4. When providing a Quranic verse or Hadith:
   - Provide the Arabic text first on its own line.
   - Immediately follow it with the English translation and explanation.
5. Match user greetings naturally in English (e.g. if the user says "hi" or "hello", reply in English like "Hello! How can I assist you today?").
6. Do NOT output internal reasoning blocks or <think> tags.`;

// Helper to record an Admin Request Log (Local + Supabase Global Sync)
export function addAdminLog(log: Omit<SystemLog, 'id' | 'timestamp'>) {
  try {
    const existing = localStorage.getItem('sunni-admin-logs');
    const logs: SystemLog[] = existing ? JSON.parse(existing) : [];
    const newLog: SystemLog = {
      id: 'log_' + Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      ...log
    };
    logs.unshift(newLog);
    localStorage.setItem('sunni-admin-logs', JSON.stringify(logs.slice(0, 100)));
  } catch (e) {
    console.warn('Failed to add admin log:', e);
  }

  // Real-time broadcast to Supabase global admin telemetry
  logRequestToSupabase(log);
}

export default function AdminPanel({ close, glassSettings, aiModel, setAiModel, apiKey, setApiKey }: AdminPanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('sunni-admin-auth') === 'true';
  });
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'api' | 'prompt' | 'logs' | 'database'>('overview');
  
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; chatCount: number; messageCount: number }>({
    connected: false,
    chatCount: 0,
    messageCount: 0
  });

  const [adminConfig, setAdminConfig] = useState<AdminConfig>(() => {
    const saved = localStorage.getItem('sunni-admin-config');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      customApiKey: apiKey,
      defaultModel: aiModel,
      temperature: 0.6,
      maxTokens: 750,
      systemPrompt: DEFAULT_SYSTEM_PROMPT
    };
  });

  const [saveSuccess, setSaveSuccess] = useState(false);

  // Live polling every 3s when Admin Panel is open
  useEffect(() => {
    if (isAuthenticated) {
      loadLogs();
      fetchDbStats();
      const interval = setInterval(() => {
        loadLogs();
        fetchDbStats();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const loadLogs = async () => {
    try {
      const dbLogs = await fetchSystemLogsFromSupabase();
      if (dbLogs && dbLogs.length > 0) {
        const formatted: SystemLog[] = dbLogs.map(l => ({
          id: l.id,
          timestamp: new Date(l.created_at).getTime(),
          model: l.model,
          promptSnippet: l.prompt_snippet,
          latencyMs: l.latency_ms,
          status: l.status,
          errorDetails: l.error_details || undefined
        }));
        setLogs(formatted);
        return;
      }
    } catch (e) {}

    // Fallback to local logs
    try {
      const saved = localStorage.getItem('sunni-admin-logs');
      if (saved) setLogs(JSON.parse(saved));
    } catch (e) {}
  };

  const fetchDbStats = async () => {
    try {
      const { count: chatCount, error: cErr } = await supabase.from('chats').select('*', { count: 'exact', head: true });
      const { count: messageCount, error: mErr } = await supabase.from('messages').select('*', { count: 'exact', head: true });
      
      setDbStatus({
        connected: !cErr && !mErr,
        chatCount: chatCount || 0,
        messageCount: messageCount || 0
      });
    } catch (e) {
      setDbStatus({ connected: false, chatCount: 0, messageCount: 0 });
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.trim().toLowerCase() === 'q04ti' || passcode.trim() === 'sunni2026' || passcode.trim() === 'admin') {
      setIsAuthenticated(true);
      localStorage.setItem('sunni-admin-auth', 'true');
      setAuthError('');
    } else {
      setAuthError('Invalid passcode. Default passcode is: q04ti');
    }
  };

  const handleSaveConfig = () => {
    localStorage.setItem('sunni-admin-config', JSON.stringify(adminConfig));
    setApiKey(adminConfig.customApiKey);
    setAiModel(adminConfig.defaultModel);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleClearLogs = async () => {
    localStorage.removeItem('sunni-admin-logs');
    await clearSystemLogsFromSupabase();
    setLogs([]);
  };

  const handlePurgeDatabase = async () => {
    if (confirm('Are you sure you want to purge all active Supabase sessions and messages?')) {
      await clearAllChatsFromSupabase();
      await fetchDbStats();
      alert('Supabase sessions purged successfully!');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="animate-in" style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'var(--bg-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem'
      }}>
        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}>
          <button onClick={close} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '0.6rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <GlassSurface width={400} height="auto" {...glassSettings} borderRadius={24}>
          <div style={{ padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textOverflow: 'ellipsis' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '18px',
              background: 'var(--accent-soft)', border: '1px solid rgba(218, 119, 86, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem'
            }}>
              <Lock size={26} color="var(--accent-color)" />
            </div>

            <h2 className="serif-title" style={{ fontSize: '1.8rem', color: 'var(--text-primary)', marginBottom: '0.4rem', textAlign: 'center' }}>
              Sunni AI Admin Hub
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.75rem', textAlign: 'center' }}>
              Enter administrator passcode to access system logs, API config, & database controls.
            </p>

            <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input 
                type="password"
                placeholder="Passcode (Default: q04ti)"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                style={{
                  width: '100%', padding: '0.85rem 1rem',
                  background: 'rgba(20, 19, 17, 0.75)', border: '1px solid var(--glass-border)',
                  borderRadius: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '1rem'
                }}
              />
              {authError && (
                <div style={{ color: '#ef4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertCircle size={15} /> {authError}
                </div>
              )}
              <button 
                type="submit"
                style={{
                  padding: '0.85rem', borderRadius: '12px',
                  background: 'var(--accent-color)', color: '#ffffff',
                  border: 'none', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                }}
              >
                <Unlock size={18} /> Unlock Admin Panel
              </button>
            </form>
          </div>
        </GlassSurface>
      </div>
    );
  }

  return (
    <div className="animate-in" style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto'
    }}>
      {/* Admin Navbar */}
      <header style={{
        padding: '1rem 2rem',
        borderBottom: '1px solid var(--glass-border)',
        background: 'rgba(20, 19, 17, 0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src="/logo.png" alt="Sunni AI Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          <div>
            <h1 className="serif-title" style={{ fontSize: '1.3rem', margin: 0, color: 'var(--text-primary)' }}>
              Sunni AI Admin Control Center
            </h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Managed by q04ti</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={() => {
              localStorage.removeItem('sunni-admin-auth');
              setIsAuthenticated(false);
            }} 
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '0.5rem 0.85rem', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Lock size={14} /> Lock Admin
          </button>

          <button onClick={close} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '0.5rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '2rem 1rem' }}>
        
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', marginBottom: '2rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--glass-border)' }}>
          {[
            { id: 'overview', label: 'Overview & Health', icon: Activity },
            { id: 'api', label: 'API & Model Config', icon: Key },
            { id: 'prompt', label: 'System Prompt Rules', icon: FileText },
            { id: 'logs', label: 'Live Request Logs', icon: Cpu },
            { id: 'database', label: 'Database & Storage', icon: Database }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.65rem 1.15rem', borderRadius: '12px',
                  background: isActive ? 'var(--accent-color)' : 'var(--glass-bg)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  border: isActive ? 'none' : '1px solid var(--glass-border)',
                  fontWeight: 500, fontSize: '0.9rem', cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={16} /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Save success banner */}
        {saveSuccess && (
          <div style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)', color: '#4ade80', padding: '0.85rem 1.25rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <CheckCircle2 size={18} /> Admin configuration saved successfully!
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>API Gateway Status</span>
                  <Activity size={18} color="#4ade80" />
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#4ade80' }}>Operational</div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.3rem' }}>Groq Direct SSE Gateway</p>
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Supabase Storage</span>
                  <Database size={18} color={dbStatus.connected ? '#4ade80' : '#f59e0b'} />
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {dbStatus.connected ? 'Connected' : 'Offline / Standalone'}
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                  {dbStatus.chatCount} Chats | {dbStatus.messageCount} Messages
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Requests Logged</span>
                  <Cpu size={18} color="var(--accent-color)" />
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{logs.length}</div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.3rem' }}>Real-time telemetry</p>
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Primary AI Model</span>
                  <Server size={18} color="var(--accent-color)" />
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {aiModel}
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.3rem' }}>Default engine</p>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={20} color="var(--accent-color)" /> Sunni AI Architecture Status
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                Sunni AI is configured with instant client-side Groq SSE streaming, database auto-purge on page exit, and custom language formatting. All user chats are auto-purged from Supabase on tab closure to maintain 0 MB storage overhead.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: API & MODEL CONFIG */}
        {activeTab === 'api' && (
          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Key size={20} color="var(--accent-color)" /> AI Engine & API Configuration
            </h3>

            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Custom Groq API Key</label>
              <input 
                type="password"
                placeholder="gsk_..."
                value={adminConfig.customApiKey}
                onChange={(e) => setAdminConfig(prev => ({ ...prev, customApiKey: e.target.value }))}
                style={{
                  width: '100%', padding: '0.85rem 1rem',
                  background: 'rgba(20, 19, 17, 0.8)', border: '1px solid var(--glass-border)',
                  borderRadius: '12px', color: 'var(--text-primary)', fontSize: '0.95rem', outline: 'none'
                }}
              />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.4rem' }}>
                Optional. Leave blank to use the built-in fallback key.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Default Model</label>
              <select
                value={adminConfig.defaultModel}
                onChange={(e) => setAdminConfig(prev => ({ ...prev, defaultModel: e.target.value }))}
                style={{
                  width: '100%', padding: '0.85rem 1rem',
                  background: 'rgba(20, 19, 17, 0.8)', border: '1px solid var(--glass-border)',
                  borderRadius: '12px', color: 'var(--text-primary)', fontSize: '0.95rem', outline: 'none', cursor: 'pointer'
                }}
              >
                {AVAILABLE_MODELS.map(m => (
                  <option key={m.id} value={m.id} style={{ background: '#141311', color: '#ffffff' }}>
                    {m.name} ({m.limit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                <span>Temperature (Creativity): {adminConfig.temperature}</span>
              </label>
              <input 
                type="range" min="0" max="1" step="0.1"
                value={adminConfig.temperature}
                onChange={(e) => setAdminConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                <span>Max Generation Tokens: {adminConfig.maxTokens}</span>
              </label>
              <input 
                type="range" min="250" max="2000" step="50"
                value={adminConfig.maxTokens}
                onChange={(e) => setAdminConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>

            <button
              onClick={handleSaveConfig}
              style={{
                alignSelf: 'flex-start', padding: '0.85rem 2rem', borderRadius: '12px',
                background: 'var(--accent-color)', color: '#ffffff', border: 'none',
                fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', marginTop: '1rem'
              }}
            >
              Save Configuration
            </button>
          </div>
        )}

        {/* TAB 3: SYSTEM PROMPT */}
        {activeTab === 'prompt' && (
          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={20} color="var(--accent-color)" /> Global System Prompt Editor
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
              Edit the system prompt rules sent to Groq AI on every request.
            </p>

            <textarea
              rows={16}
              value={adminConfig.systemPrompt}
              onChange={(e) => setAdminConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
              style={{
                width: '100%', padding: '1rem',
                background: 'rgba(20, 19, 17, 0.95)', border: '1px solid var(--glass-border)',
                borderRadius: '12px', color: 'var(--text-primary)', fontSize: '0.9rem',
                fontFamily: 'monospace', lineHeight: 1.6, outline: 'none', resize: 'vertical'
              }}
            />

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={handleSaveConfig}
                style={{
                  padding: '0.85rem 2rem', borderRadius: '12px',
                  background: 'var(--accent-color)', color: '#ffffff', border: 'none',
                  fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer'
                }}
              >
                Save System Prompt
              </button>

              <button
                onClick={() => setAdminConfig(prev => ({ ...prev, systemPrompt: DEFAULT_SYSTEM_PROMPT }))}
                style={{
                  padding: '0.85rem 1.5rem', borderRadius: '12px',
                  background: 'var(--glass-bg)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)',
                  fontWeight: 500, fontSize: '0.9rem', cursor: 'pointer'
                }}
              >
                Reset Default Prompt
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: LIVE REQUEST LOGS */}
        {activeTab === 'logs' && (
          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cpu size={20} color="var(--accent-color)" /> Live System Request Telemetry
              </h3>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={loadLogs} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.5rem 0.85rem', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                  <RefreshCw size={14} /> Refresh
                </button>
                <button onClick={handleClearLogs} style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '0.5rem 0.85rem', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                  <Trash2 size={14} /> Clear Logs
                </button>
              </div>
            </div>

            {logs.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No request logs recorded yet. Send a message to start logging telemetry.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Timestamp</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Model</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Prompt Snippet</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Latency</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}>
                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{log.model}</td>
                        <td style={{ padding: '0.75rem 1rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.promptSnippet}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: log.latencyMs < 1000 ? '#4ade80' : '#f59e0b' }}>
                          {log.latencyMs}ms
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{
                            padding: '0.2rem 0.5rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 600,
                            background: log.status === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: log.status === 'success' ? '#4ade80' : '#ef4444'
                          }}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: DATABASE & STORAGE */}
        {activeTab === 'database' && (
          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={20} color="var(--accent-color)" /> Supabase Database & Storage Management
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div style={{ background: 'rgba(20, 19, 17, 0.6)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Active Database Sessions</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>{dbStatus.chatCount}</div>
              </div>

              <div style={{ background: 'rgba(20, 19, 17, 0.6)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Stored Messages</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>{dbStatus.messageCount}</div>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <h4 style={{ color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '0.5rem' }}>Emergency Database Purge</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Force purge all active sessions and messages in Supabase instantly.
              </p>
              <button
                onClick={handlePurgeDatabase}
                style={{
                  padding: '0.85rem 1.5rem', borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 600,
                  fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}
              >
                <Trash2 size={16} /> Purge Supabase Sessions
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
