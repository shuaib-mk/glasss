import { useState, useEffect, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import SettingsPage from './components/SettingsPage';
import Noise from './components/Noise';
import './index.css';
import { AVAILABLE_MODELS, type Chat, type GlassSettings } from './types';

const AdminPanel = lazy(() => import('./components/AdminPanel'));

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
  const [chats, setChats] = useState<Chat[]>(() => {
    try {
      const saved = sessionStorage.getItem('islamic-chatbot-history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  // Session-only history keeps Supabase usage at zero and disappears with the tab.
  useEffect(() => {
    try {
      const lightweightChats = chats.slice(0, 20).map(chat => ({
        ...chat,
        messages: chat.messages.slice(-20).map(message => ({ ...message, image: undefined }))
      }));
      sessionStorage.setItem('islamic-chatbot-history', JSON.stringify(lightweightChats));
    } catch (error) {
      console.warn('Unable to keep session history:', error);
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

  useEffect(() => {
    // Remove keys persisted by older versions of the app.
    localStorage.removeItem('islamic-chatbot-apikey');
    sessionStorage.removeItem('islamic-chatbot-apikey');
    localStorage.removeItem('islamic-chatbot-history');
  }, []);

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
      
      {/* Click-away overlay for the sidebar on every screen size. */}
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
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
        <Suspense fallback={null}>
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
          />
        </Suspense>
      )}

      {isSettingsOpen ? (
        <SettingsPage 
          close={() => setIsSettingsOpen(false)}
          glassSettings={glassSettings}
          setGlassSettings={setGlassSettings}
          aiModel={aiModel}
          setAiModel={setAiModel}
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
        />
      )}
    </>
  );
}

export default App;
