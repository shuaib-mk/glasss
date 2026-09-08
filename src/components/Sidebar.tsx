import { Plus, MessageSquare, Settings, Trash2, FolderOpen, UploadCloud, Loader2, BookOpen } from 'lucide-react';
import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import type { Chat, GlassSettings } from '../types';
import GlassSurface from './GlassSurface';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  chats: Chat[];
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
  currentChatId: string | null;
  setCurrentChatId: React.Dispatch<React.SetStateAction<string | null>>;
  glassSettings: GlassSettings;
  setGlassSettings: (s: GlassSettings | ((prev: GlassSettings) => GlassSettings)) => void;
  setIsSettingsOpen: (open: boolean) => void;
}

interface KnowledgeDocument {
  filename: string;
  size: number;
}

// Group chats chronologically like Claude AI
function groupChatsByDate(chats: Chat[]) {
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  const today: Chat[] = [];
  const yesterday: Chat[] = [];
  const previous7Days: Chat[] = [];
  const older: Chat[] = [];

  chats.forEach(chat => {
    const diff = now - chat.updatedAt;
    if (diff < ONE_DAY) {
      today.push(chat);
    } else if (diff < 2 * ONE_DAY) {
      yesterday.push(chat);
    } else if (diff < 7 * ONE_DAY) {
      previous7Days.push(chat);
    } else {
      older.push(chat);
    }
  });

  return [
    { label: 'Today', items: today },
    { label: 'Yesterday', items: yesterday },
    { label: 'Previous 7 Days', items: previous7Days },
    { label: 'Older', items: older },
  ].filter(group => group.items.length > 0);
}

export default function Sidebar({ isOpen, setIsOpen, chats, setChats, currentChatId, setCurrentChatId, glassSettings, setIsSettingsOpen }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'chats'|'knowledge'>('chats');
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      if (!res.ok) throw new Error(`The server returned status ${res.status}.`);
      const data = await res.json();
      setDocuments(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch documents', e);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'knowledge') {
      fetchDocuments();
    }
  }, [activeTab, fetchDocuments]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Please choose a document smaller than 10 MB.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || `The server returned status ${response.status}.`);
      }
      await fetchDocuments();
    } catch (error) {
      console.error('Upload failed', error);
      alert(error instanceof Error ? error.message : 'Failed to upload document.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const sidebarStyle: CSSProperties = {
    position: 'fixed',
    top: '1rem',
    bottom: '1rem',
    left: '1rem',
    width: '260px',
    zIndex: 50,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '20px',
    padding: 0,
    background: 'transparent',
    border: 'none',
    margin: 0,
    transform: isOpen ? 'translateX(0)' : 'translateX(-120%)',
    opacity: isOpen ? 1 : 0,
    visibility: isOpen ? 'visible' : 'hidden',
    pointerEvents: isOpen ? 'auto' : 'none',
    willChange: 'transform, opacity',
    transition: 'transform 0.36s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease, visibility 0.36s'
  };

  const handleNewChat = () => {
    setCurrentChatId(null);
    setIsOpen(false);
  };

  const deleteChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setChats(prev => prev.filter(c => c.id !== id));
    if (currentChatId === id) setCurrentChatId(null);
  };

  const groupedChatHistory = groupChatsByDate(chats);

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`} style={sidebarStyle}>
        <GlassSurface
          width="100%" 
          height="100%"
          {...glassSettings}
          borderRadius={20}
          mixBlendMode="screen"
        >
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '1.25rem', position: 'relative', zIndex: 1 }}>
            
            {/* Branding Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ 
                  width: '28px', height: '28px', borderRadius: '8px', 
                  background: 'var(--accent-soft)', border: '1px solid rgba(218, 119, 86, 0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <img src="/logo.png" alt="Sunni AI" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                </div>
                <span className="serif-title" style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Sunni AI</span>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-color)', background: 'var(--accent-soft)', padding: '0.2rem 0.5rem', borderRadius: '99px', fontWeight: 600 }}>
                v2.0
              </span>
            </div>

            {/* New Chat Button */}
            <button 
              onClick={handleNewChat}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                background: 'var(--accent-color)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.9rem',
                marginBottom: '1.25rem',
                boxShadow: '0 4px 14px rgba(218, 119, 86, 0.35)',
                transition: 'all 0.2s ease'
              }}
            >
              <Plus size={18} />
              <span>New Chat</span>
            </button>

            {/* Tab Switcher */}
            <div style={{ 
              display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', padding: '0.25rem', 
              background: 'rgba(20, 18, 16, 0.6)', borderRadius: '12px', border: '1px solid var(--glass-border)' 
            }}>
              <button 
                onClick={() => setActiveTab('chats')}
                style={{ 
                  flex: 1, padding: '0.45rem', borderRadius: '8px', 
                  background: activeTab === 'chats' ? 'rgba(44, 40, 36, 0.9)' : 'transparent', 
                  color: activeTab === 'chats' ? 'var(--text-primary)' : 'var(--text-muted)', 
                  fontSize: '0.82rem', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' 
                }}
              >
                <MessageSquare size={13} /> Chats
              </button>
              <button 
                onClick={() => setActiveTab('knowledge')}
                style={{ 
                  flex: 1, padding: '0.45rem', borderRadius: '8px', 
                  background: activeTab === 'knowledge' ? 'rgba(44, 40, 36, 0.9)' : 'transparent', 
                  color: activeTab === 'knowledge' ? 'var(--text-primary)' : 'var(--text-muted)', 
                  fontSize: '0.82rem', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' 
                }}
              >
                <FolderOpen size={13} /> Knowledge
              </button>
            </div>

            {/* Main Section Content */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.2rem' }}>
              {activeTab === 'chats' ? (
                chats.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>No conversations yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {groupedChatHistory.map(group => (
                      <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, paddingLeft: '0.4rem' }}>
                          {group.label}
                        </span>
                        {group.items.map(chat => (
                          <button 
                            key={chat.id}
                            onClick={() => { setCurrentChatId(chat.id); setIsOpen(false); }}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '0.65rem', 
                              color: currentChatId === chat.id ? 'var(--text-primary)' : 'var(--text-secondary)', 
                              background: currentChatId === chat.id ? 'rgba(44, 40, 36, 0.95)' : 'rgba(32, 29, 26, 0.4)',
                              border: currentChatId === chat.id ? '1px solid rgba(218, 119, 86, 0.3)' : '1px solid transparent',
                              padding: '0.65rem 0.75rem', 
                              borderRadius: '10px', 
                              textAlign: 'left',
                              justifyContent: 'space-between',
                              transition: 'all 0.15s ease'
                            }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', overflow: 'hidden' }}>
                              <MessageSquare size={14} color={currentChatId === chat.id ? "var(--accent-color)" : "var(--text-muted)"} />
                              <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {chat.title}
                              </span>
                            </div>
                            <Trash2 size={13} color="var(--text-muted)" onClick={(e) => deleteChat(e, chat.id)} style={{ cursor: 'pointer', flexShrink: 0, opacity: 0.7 }} />
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* Knowledge Base Tab */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <input type="file" accept=".pdf,.txt,.md,.json" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1.25rem',
                      border: '1.5px dashed rgba(218, 119, 86, 0.3)', borderRadius: '14px', background: 'rgba(218, 119, 86, 0.05)',
                      color: 'var(--text-primary)', fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    {isUploading ? <Loader2 size={20} className="animate-spin" color="var(--accent-color)" /> : <UploadCloud size={20} color="var(--accent-color)" />}
                    <span>{isUploading ? 'Uploading & Indexing...' : 'Upload Knowledge File'}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>PDF, TXT, MD, JSON · max 10 MB</span>
                  </button>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, paddingLeft: '0.4rem' }}>
                      Indexed Documents ({documents.length})
                    </span>
                    {documents.map(doc => (
                      <div key={doc.filename} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.65rem 0.75rem', borderRadius: '10px', background: 'rgba(32, 29, 26, 0.6)', border: '1px solid var(--glass-border)' }}>
                        <BookOpen size={14} color="var(--accent-color)" />
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {doc.filename}
                        </span>
                      </div>
                    ))}
                    {documents.length === 0 && !isUploading && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '1rem' }}>No documents uploaded yet.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Settings Button */}
            <div style={{ marginTop: 'auto', paddingTop: '0.85rem', borderTop: '1px solid var(--glass-border)' }}>
              <button 
                onClick={() => {
                  setIsOpen(false);
                  setIsSettingsOpen(true);
                }}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '0.75rem', 
                  color: 'var(--text-secondary)', padding: '0.6rem 0.75rem', 
                  borderRadius: '10px', background: 'transparent', width: '100%', cursor: 'pointer' 
                }}
              >
                <Settings size={16} />
                <span style={{ fontSize: '0.88rem' }}>Settings & API</span>
              </button>
            </div>

          </div>
        </GlassSurface>
      </aside>
    </>
  );
}
