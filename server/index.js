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

const VALID_MODELS = [
  'allam-2-7b',
  'qwen/qwen3.6-27b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'groq/compound',
  'groq/compound-mini'
];

// POST /api/chat - Stream AI chat responses
app.post('/api/chat', async (req, res) => {
  let { messages = [], model = 'allam-2-7b' } = req.body;
  if (!VALID_MODELS.includes(model)) {
    model = 'allam-2-7b';
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

    const systemPrompt = `You are Hikmah AI, a fast, intelligent, and respectful Islamic Knowledge Assistant.
Your goal is to provide instant, accurate, and concise answers regarding Quran, Hadith, Islamic jurisprudence (fiqh), theology (aqeedah), and history.

Guidelines:
1. Respond instantly and directly.
2. Match the user's greeting naturally. Do NOT say 'Wa alaykum as-salam' unless the user specifically greets you with 'As-salamu alaykum'.
3. Format Quranic verses or Arabic text nicely.
4. Do NOT output internal reasoning blocks or <think> tags.`;

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

    // Call Groq API with streaming
    const stream = await groq.chat.completions.create({
      model: model || 'allam-2-7b',
      messages: groqMessages,
      temperature: 0.6,
      max_tokens: 750,
      stream: true
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        sendEvent('chunk', content);
      }
    }

    res.end();
  } catch (err) {
    console.error('Chat endpoint error:', err);
    sendEvent('error', err.message || 'An error occurred while calling the Groq API.');
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Hikmah AI Backend Server running on http://localhost:${PORT}`);
});
