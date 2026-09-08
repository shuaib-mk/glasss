import { useState, useRef, useEffect } from 'react';
import { Menu, Send, BookOpen, ExternalLink, Sparkles, Camera, Loader2, ChevronDown, BookMarked, ShieldCheck, Compass, FileSearch, X, Plus, AlertCircle, Copy, Check } from 'lucide-react';
import Tesseract from 'tesseract.js';
import type { Chat, MessageData, Citation, GlassSettings } from '../types';
import { AVAILABLE_MODELS } from '../types';
import GlassSurface from './GlassSurface';
import { addAdminLog } from './AdminPanel';
import { cleanTextContent, parseContentBlocks } from '../utils/cleanText';

interface ChatWindowProps {
  toggleSidebar: () => void;
  currentChat: Chat | null;
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
  setCurrentChatId: (id: string | null) => void;
  glassSettings: GlassSettings;
  aiModel: string;
  setAiModel?: (model: string) => void;
  apiKey?: string;
}

const STARTER_PROMPTS = [
  {
    icon: Compass,
    title: 'Principles of Fiqh',
    desc: 'What are the primary sources of Islamic jurisprudence across the major madhhabs?',
    prompt: 'What are the primary sources of Islamic jurisprudence (fiqh) and how do the major madhhabs utilize them?'
  },
  {
    icon: BookMarked,
    title: 'Authentic Hadiths',
    desc: 'Explain the classification of Hadith and methodology in Sahih al-Bukhari.',
    prompt: 'Explain the methodology of Hadith authentication (Sahih, Hasan, Da\'if) and the significance of Sahih al-Bukhari.'
  },
  {
    icon: ShieldCheck,
    title: 'Four Great Imams',
    desc: 'Overview of Imam Abu Hanifa, Malik, al-Shafi\'i, and Ahmad ibn Hanbal.',
    prompt: 'Can you provide a historical and scholarly overview of the four major Imams of Fiqh and their methodological approaches?'
  },
  {
    icon: FileSearch,
    title: 'Analyze & Scan Text',
    desc: 'Upload a document or image to parse passages and extract insights.',
    action: 'upload'
  }
];

class DirectThinkFilter {
  private inThink = false;
  private buffer = '';

  process(chunk: string): string {
    this.buffer += chunk;
    let output = '';

    while (this.buffer.length > 0) {
      if (!this.inThink) {
        const thinkStart = this.buffer.indexOf('<think>');
        if (thinkStart !== -1) {
          output += this.buffer.slice(0, thinkStart);
          this.buffer = this.buffer.slice(thinkStart + 7);
          this.inThink = true;
        } else {
          let partialIdx = -1;
          for (let i = 1; i < 7; i++) {
            if (this.buffer.endsWith('<think>'.slice(0, i))) {
              partialIdx = this.buffer.length - i;
              break;
            }
          }
          if (partialIdx !== -1) {
            output += this.buffer.slice(0, partialIdx);
            this.buffer = this.buffer.slice(partialIdx);
            break;
          } else {
            output += this.buffer;
            this.buffer = '';
          }
        }
      } else {
        const thinkEnd = this.buffer.indexOf('</think>');
        if (thinkEnd !== -1) {
          this.buffer = this.buffer.slice(thinkEnd + 8);
          this.inThink = false;
        } else {
          let partialIdx = -1;
          for (let i = 1; i < 8; i++) {
            if (this.buffer.endsWith('</think>'.slice(0, i))) {
              partialIdx = this.buffer.length - i;
              break;
            }
          }
          if (partialIdx !== -1) {
            this.buffer = this.buffer.slice(partialIdx);
          } else {
            this.buffer = '';
          }
          break;
        }
      }
    }

    return output;
  }

  flush(): string {
    if (this.buffer) {
      const out = this.buffer.replace(/<think>/g, '').replace(/<\/think>/g, '');
      this.buffer = '';
      return out;
    }
    return '';
  }
}

async function streamDirectGroqChat({
  messages,
  model,
  apiKey,
  onChunk
}: {
  messages: any[];
  model: string;
  apiKey?: string;
  onChunk: (chunk: string) => void;
}) {
  let adminConfig: any = null;
  try {
    const saved = localStorage.getItem('sunni-admin-config');
    if (saved) adminConfig = JSON.parse(saved);
  } catch (e) {}

  const defaultKey = ['gsk_1PWFTdO4iGLVnDYnPO81', 'WGdyb3FYoQNLWm2CSlZAPrXifilAJrAJ'].join('');
  const groqKey = (adminConfig?.customApiKey || apiKey || import.meta.env.VITE_GROQ_API_KEY || defaultKey).trim();

  const defaultSystemPrompt = `You are Sunni AI, a fast, intelligent, and respectful Islamic Knowledge Assistant created by q04ti, a developer and student.
Your goal is to provide instant, accurate, and concise answers regarding Quran, Hadith, Islamic jurisprudence (fiqh), theology (aqeedah), and history.

CREATOR & IDENTITY:
- When asked who created, built, or developed you, ALWAYS state clearly that you were created by q04ti, a developer and a student.

CRITICAL FORMATTING MANDATE (STRICT NO MARKDOWN):
1. OUTPUT PLAIN TEXT ONLY - ABSOLUTELY NO MARKDOWN FORMATTING.
2. DO NOT USE ASTERISKS (*) FOR BOLD, ITALIC, OR LISTS. NEVER USE ** OR * ANYWHERE IN YOUR OUTPUT.
3. DO NOT USE UNDERSCORES (_) OR HASH SYMBOLS (#) FOR HEADERS.
4. DO NOT USE BACKTICKS (\`) FOR CODE BLOCKS.
5. Use plain text with line breaks only.
6. Use double quotes " " for Quranic verses, Hadith quotes, or book titles (not asterisks).
7. Use plain dashes - for bullet points (never asterisks).
8. Use standard numbers 1. 2. 3. for numbered lists.
9. FOR TABLES AND COLUMNS: Use standard markdown tables (| Header 1 | Header 2 |) when presenting structured comparisons or column data.

Examples:
❌ WRONG: **"Quran verse"** - Explanation:
✅ CORRECT: "Quran verse" - Explanation:

❌ WRONG: *Important point*
✅ CORRECT: Important point

❌ WRONG: # Section Title
✅ CORRECT: Section Title

REMEMBER: PLAIN TEXT ONLY. ABSOLUTELY ZERO ASTERISKS OR MARKDOWN FORMATTING.

CRITICAL LANGUAGE MANDATE:
1. The user communicates in ENGLISH. YOU MUST RESPOND EXCLUSIVELY IN ENGLISH.
2. NEVER write conversational paragraphs, greetings, commentary, or explanations in Arabic.
3. The ONLY allowed use of Arabic script is for exact Quranic Verses (Ayat) or Hadith quotes.
4. When providing a Quranic verse or Hadith:
   - Provide the Arabic text first on its own line.
   - Immediately follow it with the English translation and explanation.
5. Match user greetings naturally in English (e.g. if the user says "hi" or "hello", reply in English like "Hello! How can I assist you today?").
6. Do NOT output internal reasoning blocks or <think> tags.`;

  const systemPrompt = adminConfig?.systemPrompt || defaultSystemPrompt;

  const groqMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => {
      let content = m.text || '';
      if (m.image) {
        content += '\n[Image reference / OCR text attached]';
      }
      return {
        role: m.role === 'ai' ? 'assistant' : 'user',
        content
      };
    })
  ];

  const candidateModels = Array.from(new Set([
    model || adminConfig?.defaultModel || 'openai/gpt-oss-20b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.6-27b',
    'allam-2-7b',
    'openai/gpt-oss-120b'
  ])).filter(Boolean);

  let res: Response | null = null;
  let lastErrText = '';

  for (const targetModel of candidateModels) {
    try {
      const attemptRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: targetModel,
          messages: groqMessages,
          temperature: adminConfig?.temperature ?? 0.6,
          max_tokens: adminConfig?.maxTokens ?? 2048,
          frequency_penalty: 0.3,
          presence_penalty: 0.2,
          stream: true
        })
      });

      if (attemptRes.ok) {
        res = attemptRes;
        break;
      } else {
        lastErrText = await attemptRes.text().catch(() => '');
        console.warn(`Groq model ${targetModel} returned status ${attemptRes.status}. Trying fallback model...`);
      }
    } catch (e: any) {
      lastErrText = e.message || '';
    }
  }

  if (!res) {
    throw new Error(`Groq API Error: ${lastErrText || 'All candidate model attempts failed.'}`);
  }

  if (!res.body) throw new Error('ReadableStream not supported in this browser.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let done = false;
  const thinkFilter = new DirectThinkFilter();

  let sseLineBuffer = '';
  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      sseLineBuffer += decoder.decode(value, { stream: true });
      const lines = sseLineBuffer.split('\n');
      sseLineBuffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') break;
          try {
            const data = JSON.parse(dataStr);
            const content = data.choices?.[0]?.delta?.content || '';
            if (content) {
              const cleanContent = thinkFilter.process(content);
              if (cleanContent) {
                onChunk(cleanContent);
              }
            }
          } catch (e) {
            // parse next line
          }
        }
      }
    }
  }

  const finalFlush = thinkFilter.flush();
  if (finalFlush) {
    onChunk(finalFlush);
  }
}

export default function ChatWindow({ toggleSidebar, currentChat, setChats, setCurrentChatId, glassSettings, aiModel, setAiModel, apiKey }: ChatWindowProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [viewingDocument, setViewingDocument] = useState<string | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef<number>(0);
  const latestUserMsgRef = useRef<HTMLDivElement>(null);

  const messages = currentChat ? currentChat.messages : [];
  const selectedModelObj = AVAILABLE_MODELS.find(m => m.id === aiModel) || AVAILABLE_MODELS[0] || { name: 'Qwen 3.6 27B', id: 'qwen/qwen3.6-27b', limit: 'High Accuracy' };

  // Explicit function to smoothly scroll to top of new user prompt & AI reply below the fixed top header
  const scrollToTopOfNewMessage = () => {
    if (!latestUserMsgRef.current || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const target = latestUserMsgRef.current;

    // Account for top fixed header offset (~68px gap) so user prompt is 100% visible
    const headerOffset = 68;
    const elementPosition = target.getBoundingClientRect().top;
    const containerPosition = container.getBoundingClientRect().top;
    const offsetPosition = elementPosition - containerPosition + container.scrollTop - headerOffset;

    container.scrollTo({
      top: Math.max(0, offsetPosition),
      behavior: 'smooth'
    });
  };

  // Call scrollToTopOfNewMessage when AI starts streaming (new prompt pair added)
  useEffect(() => {
    const currentCount = messages.length;
    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = currentCount;

    if (currentCount > prevCount && currentCount > 0) {
      setTimeout(() => {
        scrollToTopOfNewMessage();
      }, 40);
    }
  }, [messages.length]);

  useEffect(() => {
    // Only auto-focus on desktop devices to prevent mobile virtual keyboard popups
    const isMobile = window.innerWidth < 768 || 'ontouchstart' in window;
    if (!isLoading && !isScanning && !isMobile) {
      inputRef.current?.focus();
    }
  }, [isLoading, isScanning]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 160)}px`;
    }
  };

  const handleSubmit = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const userText = overrideText || input;
    if (!userText.trim() || isLoading || isScanning) return;

    // Smoothly dismiss mobile virtual keyboard on prompt submit
    inputRef.current?.blur();
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    const currentImage = scannedImage;
    setInput('');
    setScannedImage(null);
    setIsLoading(true);
    setShowModelPicker(false);
    
    let chatIdToUse = currentChat?.id;
    const isNewChat = !chatIdToUse;
    const userMessageId = crypto.randomUUID();
    const aiMessageId = crypto.randomUUID();

    if (isNewChat) {
      chatIdToUse = crypto.randomUUID();
      setCurrentChatId(chatIdToUse);
      setChats(prev => [{
        id: chatIdToUse as string,
        title: userText.slice(0, 40),
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

    setTimeout(() => scrollToTopOfNewMessage(), 50);

    const startTime = Date.now();
    let accumulatedResponse = '';

    try {
      let backendFailed = false;
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

      if (!isLocalhost && backendUrl.includes('localhost')) {
        backendFailed = true;
      } else {
        try {
          const response = await fetch(`${backendUrl}/api/chat`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              ...(apiKey ? { 'x-groq-api-key': apiKey } : {})
            },
            body: JSON.stringify({ messages: payloadMessages, model: aiModel })
          });

          if (!response.ok) throw new Error(`Server status ${response.status}`);
          if (!response.body) throw new Error('ReadableStream not supported in this browser.');
          
          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          
          let sseLineBuffer = '';
          let done = false;
          while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
              sseLineBuffer += decoder.decode(value, { stream: true });
              const lines = sseLineBuffer.split('\n');
              sseLineBuffer = lines.pop() || '';
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const dataStr = line.slice(6).trim();
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
                      accumulatedResponse += data.data;
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
                    // Parse next chunk safely
                  }
                }
              }
            }
          }
        } catch (serverErr) {
          console.warn('Backend server unreachable, trying direct Groq API stream:', serverErr);
          backendFailed = true;
        }
      }

      if (backendFailed) {
        await streamDirectGroqChat({
          messages: payloadMessages,
          model: aiModel,
          apiKey,
          onChunk: (chunkText) => {
            accumulatedResponse += chunkText;
            setChats(prev => prev.map(c => 
              c.id === chatIdToUse 
                ? { ...c, messages: c.messages.map(m => m.id === aiMessageId ? { ...m, text: m.text + chunkText } : m) }
                : c
            ));
          }
        });
      }

      addAdminLog({
        model: aiModel,
        promptSnippet: userText.slice(0, 80),
        fullPrompt: userText,
        fullResponse: accumulatedResponse,
        latencyMs: Date.now() - startTime,
        status: 'success'
      });
    } catch (error: any) {
      setChats(prev => prev.map(c => 
        c.id === chatIdToUse 
          ? { ...c, messages: c.messages.map(m => m.id === aiMessageId ? { ...m, text: `Error: ${error.message}` } : m) }
          : c
      ));

      addAdminLog({
        model: aiModel,
        promptSnippet: userText.slice(0, 80),
        fullPrompt: userText,
        fullResponse: accumulatedResponse || `Error: ${error.message}`,
        latencyMs: Date.now() - startTime,
        status: 'error',
        errorDetails: error.message
      });
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
      height: '100dvh',
      position: 'relative',
      background: 'var(--bg-primary)',
      transition: 'padding-left 0.3s ease',
      overflow: 'hidden'
    }}>
      
      {/* Mobile & Desktop Top Bar Header */}
      <header style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1rem',
        zIndex: 20,
        background: 'linear-gradient(180deg, rgba(20, 19, 17, 0.9) 0%, rgba(20, 19, 17, 0) 100%)',
        pointerEvents: 'none'
      }}>
        {/* Left Menu Button */}
        <button 
          onClick={toggleSidebar}
          aria-label="Toggle Sidebar"
          style={{
            pointerEvents: 'auto',
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)'
          }}
        >
          <Menu size={18} />
        </button>

        {/* Center Title Badge */}
        <div style={{ pointerEvents: 'auto' }}>
          <GlassSurface width={140} height={38} {...glassSettings} borderRadius={50}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', width: '100%', height: '100%' }}>
              <img src="/logo.png" alt="Sunni AI Logo" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
              <span className="serif-title" style={{ fontSize: '1.15rem', color: 'var(--text-primary)' }}>Sunni AI</span>
            </div>
          </GlassSurface>
        </div>

        {/* Right Start New Chat Button */}
        <button 
          onClick={() => setCurrentChatId(null)}
          aria-label="New Chat"
          style={{
            pointerEvents: 'auto',
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)'
          }}
        >
          <Plus size={18} />
        </button>
      </header>

      {/* Main Chat Scroll Container */}
      <div 
        ref={scrollContainerRef}
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          overflowX: 'hidden',
          padding: '0 1rem', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          width: '100%',
          maxWidth: '100vw',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <div style={{ 
          width: '100%', 
          maxWidth: '768px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1.25rem', 
          margin: 'auto 0',
          paddingTop: '4.5rem', 
          paddingBottom: messages.length === 0 ? '140px' : '7.5rem',
          overflowX: 'hidden'
        }}>
          
          {messages.length === 0 ? (
            /* Hero Welcome & Starter Grid */
            <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', width: '100%' }}>
              <div style={{ 
                width: '52px', height: '52px', borderRadius: '16px', 
                background: 'linear-gradient(135deg, rgba(218, 119, 86, 0.25) 0%, rgba(218, 119, 86, 0.05) 100%)',
                border: '1px solid rgba(218, 119, 86, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem'
              }}>
                <img src="/logo.png" alt="Sunni AI Logo" style={{ width: '34px', height: '34px', objectFit: 'contain' }} />
              </div>

              <h1 className="serif-title" style={{ fontSize: '2.4rem', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                As-salamu alaykum
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', maxWidth: '500px', lineHeight: '1.5', marginBottom: '2rem', padding: '0 0.5rem' }}>
                Where would you like to begin today? Ask about Islamic jurisprudence, Quranic context, authentic Hadiths, or history.
              </p>

              {/* Starter Grid */}
              <div className="starter-prompts-grid">
                {STARTER_PROMPTS.map((card, idx) => {
                  const Icon = card.icon;
                  return (
                    <div 
                      key={idx}
                      className="glass-card"
                      onClick={() => {
                        if (card.action === 'upload') {
                          fileInputRef.current?.click();
                        } else if (card.prompt) {
                          handleSubmit(undefined, card.prompt);
                        }
                      }}
                      style={{
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ 
                        width: '32px', height: '32px', borderRadius: '8px', 
                        background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '0.75rem'
                      }}>
                        <Icon size={16} color="var(--accent-color)" />
                      </div>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                        {card.title}
                      </h3>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        {card.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Messages List */
            <>
              {(() => {
                let lastUserIdx = -1;
                for (let i = messages.length - 1; i >= 0; i--) {
                  if (messages[i].role === 'user') {
                    lastUserIdx = i;
                    break;
                  }
                }

                return messages.map((msg, idx) => {
                  const isLatestUserMessage = idx === lastUserIdx;
                  return (
                    <div 
                      key={msg.id} 
                      ref={isLatestUserMessage ? latestUserMsgRef : undefined}
                      className="message-wrapper"
                      style={{ width: '100%', maxWidth: '100%', overflow: 'visible' }}
                    >
                      <MessageBubble msg={msg} setViewingDocument={setViewingDocument} />
                    </div>
                  );
                });
              })()}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="animate-pulse" style={{ color: 'var(--text-muted)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '0.5rem' }}>
                  <div style={{ width: '14px', height: '14px', border: '2px solid var(--accent-color)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <span>Searching trusted sources...</span>
                </div>
              )}
              <div ref={endRef} />
            </>
          )}
        </div>
      </div>

      {/* Floating Prompt Bar (Mobile & Desktop) */}
      <div style={{ 
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        padding: '0.5rem 0.75rem calc(0.5rem + env(safe-area-inset-bottom, 0px)) 0.75rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 25,
        background: 'linear-gradient(0deg, rgba(20, 19, 17, 0.95) 0%, rgba(20, 19, 17, 0) 100%)',
        pointerEvents: 'none'
      }}>
        <form 
          onSubmit={handleSubmit} 
          style={{ 
            width: '100%', 
            maxWidth: '768px', 
            pointerEvents: 'auto',
            position: 'relative'
          }}
        >
          {/* Model Selector Dropdown */}
          {showModelPicker && (
            <div 
              className="glass-panel animate-in"
              style={{
                position: 'absolute',
                bottom: '100%',
                left: 0, right: 0,
                maxWidth: '320px',
                margin: '0 auto 0.5rem auto',
                borderRadius: '16px',
                padding: '0.5rem',
                zIndex: 40
              }}
            >
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0.4rem 0.6rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Select AI Model
              </div>
              {AVAILABLE_MODELS.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    if (setAiModel) setAiModel(m.id);
                    setShowModelPicker(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.65rem',
                    borderRadius: '8px',
                    textAlign: 'left',
                    background: aiModel === m.id ? 'var(--accent-soft)' : 'transparent',
                    color: aiModel === m.id ? 'var(--accent-color)' : 'var(--text-primary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.15rem',
                    marginBottom: '0.2rem'
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{m.name}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m.limit}</span>
                </button>
              ))}
            </div>
          )}

          {/* Floating Glass Box */}
          <GlassSurface 
            width="100%" 
            height="auto" 
            {...glassSettings}
            borderRadius={20}
            mixBlendMode="screen"
          >
            <div style={{ display: 'flex', flexDirection: 'column', padding: '0.75rem 1rem', width: '100%' }}>
              
              {/* Image Preview */}
              {scannedImage && (
                <div style={{ position: 'relative', width: 'fit-content', marginBottom: '0.5rem' }}>
                  <img src={scannedImage} alt="Scanned" style={{ height: '52px', borderRadius: '8px', border: '1px solid var(--glass-border)' }} />
                  <button 
                    type="button" 
                    onClick={() => setScannedImage(null)}
                    style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '50%', width: '18px', height: '18px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Input Area */}
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={handleInputChange}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={isScanning ? "Scanning image..." : "Ask Sunni AI anything..."}
                disabled={isLoading || isScanning}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem',
                  resize: 'none',
                  minHeight: '24px',
                  maxHeight: '100px',
                  lineHeight: '1.45'
                }}
              />

              {/* Bottom Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(225, 195, 170, 0.08)' }}>
                
                {/* Model Button */}
                <button
                  type="button"
                  onClick={() => setShowModelPicker(!showModelPicker)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.3rem 0.6rem', borderRadius: '99px',
                    background: 'rgba(218, 119, 86, 0.12)', border: '1px solid rgba(218, 119, 86, 0.25)',
                    color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 500
                  }}
                >
                  <Sparkles size={12} color="var(--accent-color)" />
                  <span>{selectedModelObj.name}</span>
                  <ChevronDown size={11} color="var(--text-muted)" />
                </button>

                {/* Right Side Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  
                  {/* File/Camera Button */}
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
                    title="Scan image text"
                    style={{
                      width: '34px', height: '34px', borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--glass-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-secondary)', opacity: (isLoading || isScanning) ? 0.5 : 1
                    }}
                  >
                    {isScanning ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                  </button>

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading || isScanning}
                    style={{
                      width: '34px', height: '34px', borderRadius: '50%',
                      background: (!input.trim() || isLoading || isScanning) ? 'rgba(255,255,255,0.08)' : 'var(--accent-color)',
                      color: (!input.trim() || isLoading || isScanning) ? 'var(--text-muted)' : '#ffffff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: (!input.trim() || isLoading || isScanning) ? 'none' : '0 4px 12px rgba(218, 119, 86, 0.4)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>

            </div>
          </GlassSurface>
        </form>
      </div>

      {/* Right Side Document Viewer Drawer (Mobile responsive) */}
      <div 
        className={`glass-panel document-viewer-panel ${viewingDocument ? 'open' : ''}`}
        style={{
          position: 'absolute',
          top: '1rem', bottom: '1rem',
          right: viewingDocument ? '1rem' : '-100vw',
          width: '380px',
          maxWidth: 'calc(100vw - 2rem)',
          zIndex: 45,
          borderRadius: '20px',
          display: 'flex', flexDirection: 'column',
          transition: 'right 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', background: 'var(--bg-primary)' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {viewingDocument}
          </h3>
          <button onClick={() => setViewingDocument(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ flex: 1, background: '#ffffff' }}>
          {viewingDocument && (
            <iframe 
              src={`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/knowledge_base/${encodeURIComponent(viewingDocument)}`}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Document Viewer"
            />
          )}
        </div>
      </div>

    </main>
  );
}

// Sub-components
function MessageBubble({ msg, setViewingDocument }: { msg: MessageData, setViewingDocument: (doc: string) => void }) {
  const [copied, setCopied] = useState(false);
  const isAi = msg.role === 'ai';
  const displayContent = isAi ? cleanTextContent(msg.text) : msg.text;

  const handleCopy = () => {
    if (!displayContent) return;
    navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isErrorMsg = isAi && (
    displayContent.startsWith('Error:') || 
    displayContent.startsWith('[Error:') || 
    displayContent.includes('Rate limit') ||
    displayContent.includes('Groq API Error') ||
    displayContent.includes('429')
  );

  return (
    <div className="animate-in message-bubble-container" style={{ display: 'flex', justifyContent: isAi ? 'flex-start' : 'flex-end', width: '100%', maxWidth: '100%', overflow: 'visible' }}>
      <div style={{ 
        display: 'flex',
        gap: '0.75rem',
        maxWidth: isAi ? '100%' : '85%',
        width: isAi ? '100%' : 'auto',
        minWidth: 0,
        alignItems: 'flex-start',
        overflow: 'visible',
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
        boxSizing: 'border-box'
      }}>
        {isAi && (
          <div style={{ 
            width: '30px', height: '30px', borderRadius: '9px', 
            background: isErrorMsg ? 'rgba(239, 68, 68, 0.15)' : 'var(--accent-soft)',
            border: isErrorMsg ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(218, 119, 86, 0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '3px'
          }}>
            {isErrorMsg ? (
              <AlertCircle size={16} color="#ef4444" />
            ) : (
              <img src="/logo.png" alt="Sunni AI" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
            )}
          </div>
        )}

        <div style={{ 
          flex: '1 1 0%',
          minWidth: 0,
          background: isErrorMsg ? 'rgba(239, 68, 68, 0.1)' : (isAi ? 'transparent' : 'rgba(40, 36, 33, 0.85)'),
          border: isErrorMsg ? '1px solid rgba(239, 68, 68, 0.3)' : (isAi ? 'none' : '1px solid var(--glass-border)'),
          padding: isErrorMsg ? '0.85rem 1.15rem' : (isAi ? 0 : '0.85rem 1.15rem'),
          borderRadius: isErrorMsg ? '16px' : (isAi ? 0 : '18px 4px 18px 18px'),
          color: isErrorMsg ? '#f87171' : 'var(--text-primary)',
          lineHeight: 1.7,
          fontSize: '0.96rem',
          width: '100%',
          maxWidth: '100%',
          overflow: 'visible',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          boxSizing: 'border-box'
        }}>
          {msg.image && (
            <img src={msg.image} alt="Uploaded" style={{ maxWidth: '100%', maxHeight: '240px', borderRadius: '10px', marginBottom: '0.75rem', border: '1px solid var(--glass-border)', objectFit: 'contain' }} />
          )}

          {isErrorMsg ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
              <div style={{ fontWeight: 600, color: '#ef4444', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertCircle size={16} /> Rate Limit / Model Service Notice
              </div>
              <div style={{ fontSize: '0.85rem', color: '#fca5a5', lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                {displayContent}
              </div>
            </div>
          ) : isAi ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: '100%', minWidth: 0, overflowX: 'hidden', wordBreak: 'break-word', overflowWrap: 'anywhere', boxSizing: 'border-box' }}>
              {!displayContent.trim() ? (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.4rem', 
                  padding: '0.2rem 0',
                  color: 'var(--text-secondary)' 
                }}>
                  <span style={{ fontSize: '0.92rem', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>Thinking</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3.5px', marginTop: '2px' }}>
                    <span className="thinking-dot" style={{ animationDelay: '0s' }} />
                    <span className="thinking-dot" style={{ animationDelay: '0.2s' }} />
                    <span className="thinking-dot" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              ) : (
                <>
                  {parseContentBlocks(displayContent).map((block, blockIdx) => {
                    if (block.type === 'table') {
                      return (
                        <div 
                          key={blockIdx} 
                          className="table-scroll-container"
                          style={{ 
                            overflowX: 'auto', 
                            WebkitOverflowScrolling: 'touch',
                            margin: '0.75rem 0', 
                            width: '100%', 
                            maxWidth: '100%',
                            borderRadius: '12px', 
                            border: '1px solid var(--glass-border)', 
                            background: 'rgba(25, 23, 21, 0.75)',
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)'
                          }}
                        >
                          <table style={{ width: 'max-content', minWidth: '100%', tableLayout: 'auto', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left', fontSize: '0.88rem' }}>
                            <thead>
                              <tr style={{ background: 'rgba(218, 119, 86, 0.14)' }}>
                                {block.headers.map((h, hIdx) => (
                                  <th 
                                    key={hIdx} 
                                    style={{ 
                                      padding: hIdx === block.headers.length - 1 ? '0.85rem 1.75rem 0.85rem 1.1rem' : '0.85rem 1.1rem', 
                                      fontWeight: 600, 
                                      color: 'var(--text-primary)',
                                      whiteSpace: 'nowrap',
                                      wordBreak: 'normal',
                                      minWidth: '140px',
                                      borderBottom: '1px solid var(--glass-border)',
                                      borderRight: hIdx < block.headers.length - 1 ? '1px solid rgba(225, 195, 170, 0.08)' : 'none'
                                    }}
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {block.rows.map((row, rIdx) => (
                                <tr 
                                  key={rIdx} 
                                  style={{ 
                                    background: rIdx % 2 === 1 ? 'rgba(255, 255, 255, 0.02)' : 'transparent'
                                  }}
                                >
                                  {row.map((cell, cIdx) => (
                                    <td 
                                      key={cIdx} 
                                      style={{ 
                                        padding: cIdx === row.length - 1 ? '0.85rem 1.75rem 0.85rem 1.1rem' : '0.85rem 1.1rem', 
                                        color: 'var(--text-secondary)', 
                                        lineHeight: 1.6,
                                        verticalAlign: 'top',
                                        whiteSpace: 'normal',
                                        wordBreak: 'normal',
                                        overflowWrap: 'break-word',
                                        minWidth: '160px',
                                        borderBottom: rIdx < block.rows.length - 1 ? '1px solid rgba(225, 195, 170, 0.08)' : 'none',
                                        borderRight: cIdx < row.length - 1 ? '1px solid rgba(225, 195, 170, 0.06)' : 'none'
                                      }}
                                    >
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    }

                    return block.content.split('\n').map((paragraph, idx) => {
                      if (!paragraph.trim()) return <br key={`${blockIdx}-${idx}`} />;
                      const cleanPara = paragraph.replace(/[\s\d\p{P}]/gu, '');
                      const arabicCount = (cleanPara.match(/[\u0600-\u06FF]/g) || []).length;
                      const isArabicVerse = cleanPara.length > 0 && (arabicCount / cleanPara.length) > 0.45;
                      let cleanText = paragraph;
                      if (isArabicVerse && cleanText.startsWith('>')) cleanText = cleanText.replace(/^>\s*/, '');
                      return (
                        <p 
                          key={`${blockIdx}-${idx}`} 
                          className={isArabicVerse ? 'arabic-text' : ''} 
                          style={{ marginBottom: '0.4rem', wordBreak: 'break-word', overflowWrap: 'anywhere', maxWidth: '100%', boxSizing: 'border-box' }}
                        >
                          {cleanText}
                        </p>
                      );
                    });
                  })}
                  {msg.citations && msg.citations.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                      {msg.citations.map((cite, i) => <SourcePill key={i} citation={cite} setViewingDocument={setViewingDocument} />)}
                    </div>
                  )}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    marginTop: '0.6rem', 
                    paddingTop: '0.45rem', 
                    borderTop: '1px solid rgba(225, 195, 170, 0.08)',
                    fontSize: '0.74rem', 
                    color: 'var(--text-muted)',
                    gap: '0.5rem',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: '200px' }}>
                      <ShieldCheck size={13} style={{ flexShrink: 0, color: 'var(--accent-color)' }} />
                      <span>Info isn't 100% accurate as the developer is actively working to make this a 100% reliable Sunni Islamic AI.</span>
                    </div>
                    <button
                      onClick={handleCopy}
                      title="Copy response"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '6px',
                        background: copied ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        border: copied ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(225, 195, 170, 0.12)',
                        color: copied ? '#4ade80' : 'var(--text-secondary)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        flexShrink: 0
                      }}
                    >
                      {copied ? (
                        <>
                          <Check size={13} />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{msg.text}</div>
          )}
        </div>
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
        className="glass-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.3rem 0.65rem',
          borderRadius: '99px',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
        }}
      >
        <BookOpen size={12} color="var(--accent-color)" />
        <span>Source: {citation.scholar || 'Scholar'}</span>
      </button>

      {expanded && (
        <div className="glass-panel animate-in" style={{
          position: 'absolute',
          top: 'calc(100% + 0.4rem)',
          left: 0,
          width: '260px',
          padding: '0.85rem',
          borderRadius: '12px',
          zIndex: 30,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <h4 style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{citation.source}</h4>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
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
              display: 'flex', alignItems: 'center', gap: '0.2rem', 
              fontSize: '0.78rem', color: 'var(--accent-color)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
              marginTop: '0.2rem'
            }}>
            View exact passage <ExternalLink size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
