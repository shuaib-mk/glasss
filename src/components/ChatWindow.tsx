import { useState, useRef, useEffect } from 'react';
import { Menu, Send, BookOpen, ExternalLink, Sparkles, Camera, Loader2 } from 'lucide-react';
import Tesseract from 'tesseract.js';
import type { Chat, MessageData, Citation, GlassSettings } from '../types';
import GlassSurface from './GlassSurface';

interface ChatWindowProps {
  toggleSidebar: () => void;
  currentChat: Chat | null;
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
  setCurrentChatId: (id: string | null) => void;
  glassSettings: GlassSettings;
  aiModel: string;
}

export default function ChatWindow({ toggleSidebar, currentChat, setChats, setCurrentChatId, glassSettings, aiModel }: ChatWindowProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [viewingDocument, setViewingDocument] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const messages = currentChat ? currentChat.messages : [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isLoading && !isScanning) {
      inputRef.current?.focus();
    }
  }, [isLoading, isScanning]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || isScanning) return;

    const userText = input;
    const currentImage = scannedImage;
    setInput('');
    setScannedImage(null);
    setIsLoading(true);
    
    // Generate IDs synchronously to prevent collisions inside React's deferred callbacks
    let chatIdToUse = currentChat?.id;
    const isNewChat = !chatIdToUse;
    const userMessageId = crypto.randomUUID();
    const aiMessageId = crypto.randomUUID();

    if (isNewChat) {
      chatIdToUse = crypto.randomUUID();
      setCurrentChatId(chatIdToUse);
      setChats(prev => [{
        id: chatIdToUse as string,
        title: userText,
        messages: [{ id: userMessageId, role: 'user', text: userText, image: currentImage || undefined }],
        updatedAt: Date.now()
      }, ...prev]);
    } else {
      setChats(prev => prev.map(c => 
        c.id === chatIdToUse 
          ? { ...c, messages: [...c.messages, { id: userMessageId, role: 'user', text: userText, image: currentImage || undefined }], updatedAt: Date.now() }
          : c
      ));
    }

    const payloadMessages = isNewChat 
      ? [{ role: 'user', text: userText, image: currentImage || undefined }]
      : [...messages, { role: 'user', text: userText, image: currentImage || undefined }];

    // Inject empty AI message
    setChats(prev => prev.map(c => 
      c.id === chatIdToUse 
        ? { ...c, messages: [...c.messages, { id: aiMessageId, role: 'ai', text: '', citations: [] }], updatedAt: Date.now() }
        : c
    ));

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payloadMessages, model: aiModel })
      });

      if (!response.body) throw new Error('ReadableStream not supported in this browser.');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunkStr = decoder.decode(value, { stream: true });
          const lines = chunkStr.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              if (!dataStr) continue;
              try {
                const data = JSON.parse(dataStr);
                if (data.type === 'citations') {
                  setChats(prev => prev.map(c => 
                    c.id === chatIdToUse 
                      ? { ...c, messages: c.messages.map(m => m.id === aiMessageId ? { ...m, citations: data.data } : m) }
                      : c
                  ));
                } else if (data.type === 'chunk') {
                  setChats(prev => prev.map(c => 
                    c.id === chatIdToUse 
                      ? { ...c, messages: c.messages.map(m => m.id === aiMessageId ? { ...m, text: m.text + data.data } : m) }
                      : c
                  ));
                } else if (data.type === 'error') {
                  setChats(prev => prev.map(c => 
                    c.id === chatIdToUse 
                      ? { ...c, messages: c.messages.map(m => m.id === aiMessageId ? { ...m, text: m.text + "\n\n[Error: " + data.data + "]" } : m) }
                      : c
                  ));
                }
              } catch (e) {
                // Ignore incomplete JSON chunks and parse on next pass if needed
              }
            }
          }
        }
      }
    } catch (error: any) {
      setChats(prev => prev.map(c => 
        c.id === chatIdToUse 
          ? { ...c, messages: [...c.messages, { id: Date.now().toString(), role: 'ai', text: `Error: ${error.message}` }] }
          : c
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setScannedImage(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsScanning(true);
    try {
      const result = await Tesseract.recognize(file, 'eng+ara');
      const text = result.data.text.trim();
      if (text) {
        setInput(prev => prev ? `${prev}\n\n${text}` : text);
      }
    } catch (error) {
      console.error('OCR Error:', error);
      alert('Failed to scan text from image. Make sure the text is clear.');
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <main className="chat-container" style={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column', 
      width: '100%',
      position: 'relative',
      transition: 'padding-left 0.3s ease'
    }}>
      
      {/* Top Left Hamburger Button */}
      <div className="md-hidden" style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', zIndex: 11, pointerEvents: 'auto' }}>
        <GlassSurface
            width={48} 
            height={48}
            {...glassSettings}
            borderRadius={50} // Keep it circular
            mixBlendMode="screen"
        >
          <button onClick={toggleSidebar} style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Menu size={20} color="var(--text-primary)" />
          </button>
        </GlassSurface>
      </div>

      {/* Top Floating Glass Header (Centered) */}
      <div style={{
        position: 'absolute',
        top: '1.5rem',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 10,
        pointerEvents: 'none'
      }}>
        <div style={{ pointerEvents: 'auto' }}>
          <GlassSurface 
            width={160} 
            height={48}
            {...glassSettings}
            borderRadius={50} // Keep it a pill
            mixBlendMode="screen"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
              <h1 style={{ fontSize: '1.1rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', margin: 0 }}>
                <Sparkles size={16} color="var(--accent-color)" />
                Hikmah AI
              </h1>
            </div>
          </GlassSurface>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.5rem 120px 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: '768px', display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: messages.length === 0 ? 'auto' : '5rem', marginBottom: messages.length === 0 ? 'auto' : '0' }}>
          
          {messages.length === 0 ? (
            <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', opacity: 0.9 }}>
                <Sparkles size={32} color="white" />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>As-salamu alaykum</h2>
              <p style={{ maxWidth: '400px', lineHeight: '1.6' }}>
                I am your Islamic Knowledge Assistant. Ask me questions about fiqh, history, or aqeedah, and I will reference trusted scholars and sources.
              </p>
            </div>
          ) : (
            <>
              {messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} setViewingDocument={setViewingDocument} />
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="animate-pulse" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '16px', height: '16px', border: '2px solid var(--accent-color)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  searching trusted sources...
                </div>
              )}
              <div ref={endRef} />
            </>
          )}
        </div>
      </div>

      <div className="input-container-wrapper" style={{ 
        position: 'absolute', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        padding: '0.75rem 1rem 1rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'linear-gradient(180deg, transparent, var(--bg-primary) 30%)',
        pointerEvents: 'none'
      }}>
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '768px', pointerEvents: 'auto', display: 'flex', flexDirection: 'column' }}>
          {scannedImage && (
            <div style={{ position: 'relative', width: 'fit-content', marginBottom: '0.75rem', alignSelf: 'flex-start', marginLeft: '1.5rem' }}>
              <img src={scannedImage} alt="Scanned" style={{ height: '64px', borderRadius: '8px', border: '1px solid var(--glass-border)' }} />
              <button 
                type="button" 
                onClick={() => setScannedImage(null)}
                style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '50%', width: '24px', height: '24px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '0.75rem' }}>
            {/* Camera Button */}
            <GlassSurface 
              width={56} 
              height={56}
              {...glassSettings}
              borderRadius={50}
              mixBlendMode="screen"
              style={{ flexShrink: 0 }}
            >
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                style={{ display: 'none' }} 
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isScanning}
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: (isLoading || isScanning) ? 0.5 : 1
                }}
              >
                {isScanning ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
              </button>
            </GlassSurface>
            
            {/* Input Field */}
            <div style={{ flex: 1, height: '56px' }}>
              <GlassSurface 
                width="100%" 
                height={56}
                {...glassSettings}
                borderRadius={50}
                mixBlendMode="screen"
              >
                <input
                  type="text" 
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={isScanning ? "Scanning image..." : "Ask about fiqh, history, aqeedah..."}
                  disabled={isLoading || isScanning}
                  style={{
                    width: '100%',
                    height: '100%',
                    padding: '0 1.5rem',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '1rem'
                  }}
                />
              </GlassSurface>
            </div>

            {/* Send Button */}
            <GlassSurface 
              width={56} 
              height={56}
              {...glassSettings}
              borderRadius={50}
              mixBlendMode="screen"
              style={{ flexShrink: 0 }}
            >
              <button 
                type="submit" 
                disabled={!input.trim() || isLoading || isScanning}
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'transparent',
                  border: 'none',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: (!input.trim() || isLoading || isScanning) ? 'var(--text-muted)' : 'var(--accent-color)',
                  cursor: (!input.trim() || isLoading || isScanning) ? 'not-allowed' : 'pointer',
                  transition: 'color 0.2s'
                }}
              >
                <Send size={20} />
              </button>
            </GlassSurface>
          </div>
        </form>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          For guidance on personal matters, consult a qualified scholar directly.
        </p>
      </div>

      {/* Right Side Document Viewer Panel */}
      <div 
        className="glass-panel"
        style={{
          position: 'absolute',
          top: '1rem',
          bottom: '1rem',
          right: viewingDocument ? '1rem' : '-400px',
          width: '350px',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          transition: 'right 0.3s ease-out',
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {viewingDocument}
          </h3>
          <button onClick={() => setViewingDocument(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
        <div style={{ flex: 1, background: '#fff' }}>
          {viewingDocument && (
            <iframe 
              src={`http://localhost:3001/knowledge_base/${viewingDocument}`}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Document Viewer"
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @media (min-width: 768px) {
          .md-hidden { display: none !important; }
        }
        .arabic-text {
          font-family: 'Amiri', 'Scheherazade New', serif;
          font-size: 1.5rem;
          line-height: 2.2;
          direction: rtl;
          text-align: right;
          color: var(--accent-color);
          background: rgba(147, 51, 234, 0.05);
          padding: 1rem 1.5rem;
          border-right: 4px solid var(--accent-color);
          border-radius: 8px;
          margin: 1rem 0;
        }
        @media (max-width: 767px) {
          .chat-container { padding-left: 0 !important; }
          .input-container-wrapper { padding: 0.5rem 0.5rem 0.5rem 0.5rem !important; }
          .message-bubble { padding: 0.75rem !important; font-size: 0.95rem; }
        }
      `}</style>
    </main>
  );
}

// Sub-components
function MessageBubble({ msg, setViewingDocument }: { msg: MessageData, setViewingDocument: (doc: string) => void }) {
  const isAi = msg.role === 'ai';
  
  return (
    <div className="animate-in" style={{ display: 'flex', justifyContent: isAi ? 'flex-start' : 'flex-end', width: '100%' }}>
      <div style={{ 
        background: isAi ? 'transparent' : 'var(--glass-bg)',
        border: isAi ? 'none' : '1px solid var(--glass-border)',
        padding: isAi ? 0 : '1rem 1.25rem',
        borderRadius: isAi ? 0 : '16px',
        borderTopRightRadius: isAi ? 0 : '4px',
        color: isAi ? 'var(--text-primary)' : 'var(--text-primary)',
        lineHeight: 1.6,
        maxWidth: isAi ? '100%' : '85%'
      }}>
        {msg.image && (
          <img src={msg.image} alt="Uploaded" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', marginBottom: '1rem', border: '1px solid var(--glass-border)', objectFit: 'contain' }} />
        )}
        {isAi ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
            {msg.text.split('\n').map((paragraph, idx) => {
              const isArabic = /[\u0600-\u06FF]/.test(paragraph);
              if (!paragraph.trim()) return <br key={idx} />;
              let cleanText = paragraph;
              if (isArabic && cleanText.startsWith('>')) cleanText = cleanText.replace(/^>\s*/, '');
              return <p key={idx} className={isArabic ? 'arabic-text' : ''} style={{ marginBottom: '1rem' }}>{cleanText}</p>;
            })}
            {msg.citations && msg.citations.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {msg.citations.map((cite, i) => <SourcePill key={i} citation={cite} setViewingDocument={setViewingDocument} />)}
              </div>
            )}
          </div>
        ) : (
          <div>{msg.text}</div>
        )}
      </div>
    </div>
  );
}

function SourcePill({ citation, setViewingDocument }: { citation: Citation, setViewingDocument: (doc: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => setExpanded(!expanded)}
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.4rem 0.75rem',
          borderRadius: '99px',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
        }}
      >
        <BookOpen size={14} color="var(--accent-color)" />
        <span>Source: {citation.scholar || 'Scholar'}</span>
      </button>

      {expanded && (
        <div className="glass-panel animate-in" style={{
          position: 'absolute',
          top: 'calc(100% + 0.5rem)',
          left: 0,
          width: '280px',
          padding: '1rem',
          borderRadius: '12px',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <h4 style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>{citation.source}</h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Category: {citation.category || 'General'}<br/>
            Page: {citation.page || 'N/A'}
          </p>
          <button 
            onClick={(e) => {
              e.preventDefault();
              setViewingDocument(citation.source);
              setExpanded(false);
            }}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.25rem', 
              fontSize: '0.8rem', color: 'var(--accent-color)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
              marginTop: '0.25rem'
            }}>
            View exact passage <ExternalLink size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
