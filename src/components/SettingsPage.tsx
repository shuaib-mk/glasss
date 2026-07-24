import { ArrowLeft, Monitor, Cpu } from 'lucide-react';
import type { GlassSettings } from '../types';
import { AVAILABLE_MODELS } from '../types';
import GlassSurface from './GlassSurface';

interface SettingsPageProps {
  close: () => void;
  glassSettings: GlassSettings;
  setGlassSettings: (s: GlassSettings | ((prev: GlassSettings) => GlassSettings)) => void;
  aiModel: string;
  setAiModel: (m: string) => void;
}

export default function SettingsPage({ close, glassSettings, setGlassSettings, aiModel, setAiModel }: SettingsPageProps) {
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
            <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-primary)' }}>AI Model Selection</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Select the AI model that powers the chatbot. Some models have higher limits or different capabilities.</p>
            <select 
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              style={{
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
        </section>

        {/* Appearance / Glass Settings Section */}
        <section className="glass-panel" style={{ padding: '2rem', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Monitor size={24} color="var(--accent-color)" />
            <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-primary)' }}>Appearance (Glass Effect)</h2>
            <button 
              onClick={() => setGlassSettings({
                saturation: 0, opacity: 0.93, distortionScale: -180, blueOffset: 20,
                borderRadius: 50, borderWidth: 0, blur: 4, redOffset: 0,
                backgroundOpacity: 0.1, brightness: 50, displace: 0.5, greenOffset: 10
              })} 
              style={{ marginLeft: 'auto', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer', color: 'var(--text-primary)' }}
            >
              Reset to Default
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            {Object.entries({
              saturation: { min: 0, max: 2, step: 0.1 },
              opacity: { min: 0, max: 1, step: 0.01 },
              distortionScale: { min: -500, max: 500, step: 10 },
              blueOffset: { min: -100, max: 100, step: 1 },
              blur: { min: 0, max: 50, step: 1 },
              redOffset: { min: -100, max: 100, step: 1 },
              backgroundOpacity: { min: 0, max: 1, step: 0.05 },
              brightness: { min: 0, max: 150, step: 1 },
              displace: { min: 0, max: 5, step: 0.1 },
              greenOffset: { min: -100, max: 100, step: 1 },
            }).map(([key, config]) => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}</span>
                  <span>{glassSettings[key as keyof GlassSettings]}</span>
                </label>
                <input 
                  type="range" 
                  min={config.min} max={config.max} step={config.step}
                  value={glassSettings[key as keyof GlassSettings]}
                  onChange={(e) => setGlassSettings(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                  style={{ width: '100%' }}
                />
              </div>
            ))}
          </div>

          {/* Live Preview area inside Settings */}
          <div style={{ marginTop: '3rem', padding: '2rem', background: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--glass-border)', position: 'relative', overflow: 'hidden' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', textAlign: 'center' }}>Live Preview</p>
            <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 2, color: 'var(--accent-color)' }}>
               <h1 style={{ fontSize: '3rem', margin: 0, filter: 'blur(2px)' }}>Hikmah AI</h1>
            </div>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10, pointerEvents: 'none' }}>
              <GlassSurface 
                {...glassSettings}
                width={300}
                height={150}
                borderRadius={20}
                mixBlendMode="screen"
              >
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Glass Surface</span>
                </div>
              </GlassSurface>
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
