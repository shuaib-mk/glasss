import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import Groq from 'groq-sdk';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Ensure knowledge_base directory exists
const KB_DIR = path.join(__dirname, '../knowledge_base');
if (!fs.existsSync(KB_DIR)) {
  fs.mkdirSync(KB_DIR, { recursive: true });
}

// Static serving for knowledge base documents
app.use('/knowledge_base', express.static(KB_DIR));

// Configure multer storage for uploaded documents
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, KB_DIR),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, safeName);
  }
});
const upload = multer({ storage });

// Initialize Groq SDK client
const getGroqClient = (reqKey) => {
  dotenv.config(); // Dynamic reload of .env in case user updated it live
  const apiKey = (reqKey || process.env.GROQ_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is missing. Please set GROQ_API_KEY in your .env file or enter your API key in Settings.');
  }
  return new Groq({ apiKey });
};

// Helper function to extract text content from documents in knowledge base
async function searchKnowledgeBase(query) {
  const citations = [];
  let contextText = '';

  if (!fs.existsSync(KB_DIR)) return { citations, contextText };

  try {
    const files = fs.readdirSync(KB_DIR);
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    for (const file of files) {
      const filePath = path.join(KB_DIR, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) continue;

      let fileContent = '';
      const ext = path.extname(file).toLowerCase();

      if (ext === '.pdf') {
        try {
          const buffer = fs.readFileSync(filePath);
          const pdfData = await pdfParse(buffer);
          fileContent = pdfData.text || '';
        } catch (err) {
          console.error(`Error parsing PDF ${file}:`, err.message);
        }
      } else if (['.txt', '.md', '.json'].includes(ext)) {
        fileContent = fs.readFileSync(filePath, 'utf-8');
      }

      if (fileContent) {
        const fileContentLower = fileContent.toLowerCase();
        const matchesKeyword = keywords.some(kw => fileContentLower.includes(kw));

        if (matchesKeyword || files.length <= 3) {
          const excerpt = fileContent.slice(0, 1000);
          contextText += `\n--- Document Source: ${file} ---\n${excerpt}\n`;
          citations.push({
            source: file,
            scholar: 'Uploaded Document',
            category: 'Knowledge Base',
            page: '1'
          });
        }
      }
    }
  } catch (err) {
    console.error('Knowledge Base search error:', err.message);
  }

  return { citations, contextText };
}

// GET /api/documents - List documents in knowledge base
app.get('/api/documents', (_req, res) => {
  try {
    if (!fs.existsSync(KB_DIR)) {
      return res.json([]);
    }
    const files = fs.readdirSync(KB_DIR);
    const docs = files.map(file => ({
      filename: file,
      size: fs.statSync(path.join(KB_DIR, file)).size
    }));
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/documents - Upload document to knowledge base
app.post('/api/documents', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ message: 'File uploaded successfully', filename: req.file.filename });
});

class ThinkTagFilter {
  constructor() {
    this.inThink = false;
    this.buffer = '';
  }

  process(chunk) {
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

  flush() {
    if (!this.inThink && this.buffer) {
      const out = this.buffer;
      this.buffer = '';
      return out;
    }
    return '';
  }
}

const VALID_MODELS = [
  'qwen/qwen3.8-27b',
  'qwen/qwen3.6-27b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'allam-2-7b'
];

// POST /api/chat - Stream AI chat responses
app.post('/api/chat', async (req, res) => {
  let { messages = [], model = 'qwen/qwen3.8-27b' } = req.body;
  if (!VALID_MODELS.includes(model)) {
    model = 'qwen/qwen3.8-27b';
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  try {
    const userProvidedKey = req.headers['x-groq-api-key'] || req.body.apiKey;
    const groq = getGroqClient(userProvidedKey);

    let systemPrompt = `You are Sunni AI, a fast, intelligent, and respectful Islamic Knowledge Assistant created by q04ti, a developer and student.
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

    // Query Knowledge Base if user query present
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user' || m.role === 'human');
    if (lastUserMsg && lastUserMsg.text) {
      const { citations, contextText } = await searchKnowledgeBase(lastUserMsg.text);
      if (citations && citations.length > 0) {
        sendEvent('citations', citations);
      }
      if (contextText) {
        systemPrompt += `\n\nRELEVANT KNOWLEDGE BASE CONTEXT:\n${contextText}`;
      }
    }

    // Format chat messages for Groq API
    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => {
        let content = m.text || '';
        if (m.image) {
          content += `\n[Image reference / OCR text attached]`;
        }
        return {
          role: m.role === 'ai' ? 'assistant' : 'user',
          content
        };
      })
    ];

    const candidateModels = Array.from(new Set([
      model || 'openai/gpt-oss-20b',
      'openai/gpt-oss-20b',
      'qwen/qwen3.6-27b',
      'allam-2-7b',
      'openai/gpt-oss-120b'
    ])).filter(Boolean);

    let stream = null;
    let lastError = null;

    for (const targetModel of candidateModels) {
      try {
        stream = await groq.chat.completions.create({
          model: targetModel,
          messages: groqMessages,
          temperature: 0.6,
          max_tokens: 600,
          frequency_penalty: 0.3,
          presence_penalty: 0.2,
          stream: true
        });
        break;
      } catch (err) {
        console.warn(`Model ${targetModel} call failed (${err.status || err.message}). Attempting fallback model...`);
        lastError = err;
      }
    }

    if (!stream) {
      throw lastError || new Error('All candidate model attempts failed.');
    }

    const thinkFilter = new ThinkTagFilter();

    for await (const chunk of stream) {
      let content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        const cleanContent = thinkFilter.process(content);
        if (cleanContent) {
          sendEvent('chunk', cleanContent);
        }
      }
    }

    const finalFlush = thinkFilter.flush();
    if (finalFlush) {
      sendEvent('chunk', finalFlush);
    }

    res.end();
  } catch (err) {
    console.error('Chat endpoint error:', err);
    sendEvent('error', err.message || 'An error occurred while calling the Groq API.');
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Sunni AI Backend Server running on http://localhost:${PORT}`);
});
