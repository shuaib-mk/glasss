import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import SettingsPage from './components/SettingsPage';
import AdminPanel from './components/AdminPanel';
import Noise from './components/Noise';
import './index.css';
import { AVAILABLE_MODELS, type Chat, type GlassSettings } from './types';
import { fetchChatsFromSupabase, saveChatToSupabase, purgeSessionOnUnload } from './supabase';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(() => {
    return window.location.pathname.toLowerCase().startsWith('/admin');
  });

  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname.toLowerCase().startsWith('/admin')) {
        setIsAdminOpen(true);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [glassSettings, setGlassSettings] = useState<GlassSettings>({
    saturation: 0,
    opacity: 0.93,
    distortionScale: -180,
    blueOffset: 20,
    borderRadius: 50,
    borderWidth: 0,
    blur: 4,
    redOffset: 0,
    backgroundOpacity: 0.1,
    brightness: 50,
    displace: 0.5,
    greenOffset: 10
  });
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  // Automatically delete Supabase session data and local cache when user leaves/closes tab
  useEffect(() => {
    const handleLeave = () => {
      purgeSessionOnUnload();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        purgeSessionOnUnload();
      }
    };

    window.addEventListener('beforeunload', handleLeave);
    window.addEventListener('pagehide', handleLeave);
    window.addEventListener('unload', handleLeave);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleLeave);
      window.removeEventListener('pagehide', handleLeave);
      window.removeEventListener('unload', handleLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Sync from Supabase on mount for current session
  useEffect(() => {
    async function loadSupabaseData() {
      const dbChats = await fetchChatsFromSupabase();
      if (dbChats && dbChats.length > 0) {
        setChats(dbChats);
      } else {
        setChats([]);
      }
    }
    loadSupabaseData();
  }, []);

  // Sync to Supabase on chat change
  useEffect(() => {
    if (chats.length > 0) {
      chats.forEach(chat => {
        saveChatToSupabase(chat);
      });
    }
  }, [chats]);

  const [aiModel, setAiModel] = useState(() => {
    const saved = localStorage.getItem('islamic-chatbot-model');
    // Ensure the saved model is one of the available models, otherwise fallback
    const isValid = AVAILABLE_MODELS.some(m => m.id === saved);
    return isValid && saved ? saved : 'allam-2-7b';
  });

  useEffect(() => {
    localStorage.setItem('islamic-chatbot-model', aiModel);
  }, [aiModel]);

  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('islamic-chatbot-apikey') || '';
  });

  useEffect(() => {
    localStorage.setItem('islamic-chatbot-apikey', apiKey);
  }, [apiKey]);

  const currentChat = chats.find(c => c.id === currentChatId) || null;

  return (
    <>
      <Noise
        patternSize={250}
        patternScaleX={1}
        patternScaleY={1}
        patternRefreshInterval={2}
        patternAlpha={15}
      />
      
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div 
          className="mobile-overlay"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      <Sidebar 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen}
        chats={chats}
        setChats={setChats}
        currentChatId={currentChatId}
        setCurrentChatId={setCurrentChatId}
        glassSettings={glassSettings}
        setGlassSettings={setGlassSettings}
        setIsSettingsOpen={setIsSettingsOpen}
      />

      {isAdminOpen && (
        <AdminPanel
          close={() => {
            setIsAdminOpen(false);
            if (window.location.pathname.toLowerCase().startsWith('/admin')) {
              window.history.pushState({}, '', '/');
            }
          }}
          glassSettings={glassSettings}
          aiModel={aiModel}
          setAiModel={setAiModel}
          apiKey={apiKey}
          setApiKey={setApiKey}
        />
      )}

      {isSettingsOpen ? (
        <SettingsPage 
          close={() => setIsSettingsOpen(false)}
          glassSettings={glassSettings}
          setGlassSettings={setGlassSettings}
          aiModel={aiModel}
          setAiModel={setAiModel}
          apiKey={apiKey}
          setApiKey={setApiKey}
        />
      ) : (
        <ChatWindow 
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
          currentChat={currentChat}
          setChats={setChats}
          setCurrentChatId={setCurrentChatId}
          glassSettings={glassSettings}
          aiModel={aiModel}
          setAiModel={setAiModel}
          apiKey={apiKey}
        />
      )}
    </>
  );
}

export default App;
