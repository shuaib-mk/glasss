import { Plus, MessageSquare, Settings, Trash2, FolderOpen, UploadCloud, FileText, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

export default function Sidebar({ isOpen, setIsOpen, chats, setChats, currentChatId, setCurrentChatId, glassSettings, setIsSettingsOpen }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'chats'|'knowledge'>('chats');
  const [documents, setDocuments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/documents`);
      const data = await res.json();
      setDocuments(data);
    } catch (e) {
      console.error('Failed to fetch documents', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'knowledge') {
      fetchDocuments();
    }
  }, [activeTab]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/documents`, {
        method: 'POST',
        body: formData
      });
      await fetchDocuments();
    } catch (error) {
      console.error('Upload failed', error);
      alert('Failed to upload document');
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
    borderRadius: '16px',
    padding: 0,
    background: 'transparent',
    border: 'none',
    margin: 0
  };

  const springPhysics = {
    type: 'spring' as const,
    stiffness: 380,
    damping: 26,
    mass: 0.9
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

  return (
    <>
      {/* Layered Backdrop Fade */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'black',
              zIndex: 45
            }}
          />
        )}
      </AnimatePresence>

      <motion.aside 
        className="sidebar" 
        style={sidebarStyle}
        initial={false}
        animate={{ x: isOpen ? 0 : '-120%' }}
        transition={springPhysics}
        drag="x"
        dragConstraints={{ left: -300, right: 0 }}
        dragElastic={0.1}
        onDragEnd={(_e, { offset, velocity }) => {
          if (offset.x < -100 || velocity.x < -500) {
            setIsOpen(false);
          } else {
            // Snap back open
            setIsOpen(true);
          }
        }}
      >
      <GlassSurface
        width="100%" 
        height="100%"
        {...glassSettings}
        borderRadius={16} // Keep the sidebar border radius fixed
        mixBlendMode="screen"
      >
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '1.5rem', position: 'relative', zIndex: 1 }}>
          <button 
        onClick={handleNewChat}
        className="new-chat-btn" 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          borderRadius: '12px',
          background: 'rgba(20, 20, 20, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: 'var(--text-primary)',
          fontWeight: 500,
          marginBottom: '2rem'
        }}
      >
        <Plus size={18} />
        <span>New Chat</span>
      </button>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', padding: '0.25rem', background: 'rgba(0,0,0,0.6)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <button 
          onClick={() => setActiveTab('chats')}
          style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', background: activeTab === 'chats' ? 'rgba(40, 40, 40, 0.9)' : 'transparent', color: activeTab === 'chats' ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          <MessageSquare size={14} /> Chats
        </button>
        <button 
          onClick={() => setActiveTab('knowledge')}
          style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', background: activeTab === 'knowledge' ? 'rgba(40, 40, 40, 0.9)' : 'transparent', color: activeTab === 'knowledge' ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          <FolderOpen size={14} /> Knowledge
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'chats' ? (
          <>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem' }}>
              Recent
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {chats.map(chat => (
                <button 
                  key={chat.id}
                  onClick={() => { setCurrentChatId(chat.id); setIsOpen(false); }}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.75rem', 
                    color: currentChatId === chat.id ? 'var(--text-primary)' : 'var(--text-secondary)', 
                    background: currentChatId === chat.id ? 'rgba(40, 40, 40, 0.9)' : 'rgba(20, 20, 20, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    padding: '0.75rem', 
                    borderRadius: '8px', 
                    textAlign: 'left',
                    justifyContent: 'space-between'
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                    <MessageSquare size={16} />
                    <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {chat.title}
                    </span>
                  </div>
                  <Trash2 size={14} color="var(--text-muted)" onClick={(e) => deleteChat(e, chat.id)} style={{ cursor: 'pointer', flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input type="file" accept=".pdf,.txt" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem',
                border: '1px dashed rgba(255, 255, 255, 0.2)', borderRadius: '12px', background: 'rgba(20, 20, 20, 0.85)',
                color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer', transition: 'background 0.2s'
              }}
            >
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} color="var(--accent-color)" />}
              {isUploading ? 'Uploading & Learning...' : 'Upload Document'}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              {documents.map(doc => (
                <div key={doc.filename} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(20, 20, 20, 0.75)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <FileText size={16} color="var(--accent-color)" />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {doc.filename}
                  </span>
                </div>
              ))}
              {documents.length === 0 && !isUploading && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '1rem' }}>No documents in knowledge base.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
        <button 
          onClick={() => setIsSettingsOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)', padding: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', width: '100%' }}>
          <Settings size={18} />
          <span style={{ fontSize: '0.9rem' }}>Settings</span>
        </button>
      </div>
        </div>
      </GlassSurface>
      </motion.aside>
    </>
  );
}
