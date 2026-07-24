import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import SettingsPage from './components/SettingsPage';
import Noise from './components/Noise';
import './index.css';
import { AVAILABLE_MODELS, type Chat, type GlassSettings } from './types';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
    const saved = localStorage.getItem('islamic-chatbot-history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [currentChatId, setCurrentChatId] = useState<string | null>(chats.length > 0 ? chats[0].id : null);

  useEffect(() => {
    localStorage.setItem('islamic-chatbot-history', JSON.stringify(chats));
  }, [chats]);

  const [aiModel, setAiModel] = useState(() => {
    const saved = localStorage.getItem('islamic-chatbot-model');
    // Ensure the saved model is one of the available models, otherwise fallback
    const isValid = AVAILABLE_MODELS.some(m => m.id === saved);
    return isValid && saved ? saved : 'llama-3.1-8b-instant';
  });

  useEffect(() => {
    localStorage.setItem('islamic-chatbot-model', aiModel);
  }, [aiModel]);

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
        />
      )}
    </>
  );
}

export default App;
