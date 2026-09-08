import { ArrowLeft, Cpu } from 'lucide-react';
import type { GlassSettings } from '../types';
import { AVAILABLE_MODELS } from '../types';

interface SettingsPageProps {
  close: () => void;
  glassSettings?: GlassSettings;
  setGlassSettings?: (s: GlassSettings | ((prev: GlassSettings) => GlassSettings)) => void;
  aiModel: string;
  setAiModel: (m: string) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
}

export default function SettingsPage({ close, aiModel, setAiModel, apiKey, setApiKey }: SettingsPageProps) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', padding: '2rem', overflowY: 'auto' }}>
      <button 
        onClick={close} 
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '2rem', width: 'fit-content' }}
      >
        <ArrowLeft size={20} /> Back to Chat
      </button>

      <h1 style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2rem' }}>Settings</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px' }}>
        {/* AI Model Section */}
        <section className="glass-panel" style={{ padding: '2rem', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Cpu size={24} color="var(--accent-color)" />
            <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-primary)' }}>AI Configuration & Models</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Groq API Key (Optional override)</label>
              <input 
                type="password"
                placeholder="gsk_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--glass-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--glass-border)',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  outline: 'none'
                }}
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                If left empty, Sunni AI uses the server environment key. A key entered here is kept only for this browser tab and sent through your own backend, never bundled into the app.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Selected AI Model</label>
              <select 
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--glass-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--glass-border)',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {AVAILABLE_MODELS.map(model => (
                  <option key={model.id} value={model.id} style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                    {model.name} — {model.limit}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Placeholder for future settings */}
        <section className="glass-panel" style={{ padding: '2rem', borderRadius: '16px', opacity: 0.5 }}>
          <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-primary)', marginBottom: '1rem' }}>Account (Coming Soon)</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Account preferences and data export.</p>
        </section>
      </div>
    </div>
  );
}
