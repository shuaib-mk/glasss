export interface Citation {
  source: string;
  scholar?: string;
  category?: string;
  page?: string;
}

export interface GlassSettings {
  saturation: number;
  opacity: number;
  distortionScale: number;
  blueOffset: number;
  borderRadius: number;
  borderWidth: number;
  blur: number;
  redOffset: number;
  backgroundOpacity: number;
  brightness: number;
  displace: number;
  greenOffset: number;
}

export interface MessageData {
  id: string;
  role: 'user' | 'ai';
  text: string;
  image?: string;
  citations?: Citation[];
}

export interface Chat {
  id: string;
  title: string;
  messages: MessageData[];
  updatedAt: number;
}

export interface AIModel {
  id: string;
  name: string;
  limit: string;
}

export const AVAILABLE_MODELS: AIModel[] = [
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', limit: '500K tokens / day' },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', limit: '100K tokens / day' },
  { id: 'qwen/qwen3.6-27b', name: 'Qwen 3.6 27B', limit: '200K tokens / day' },
  { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B', limit: '200K tokens / day' },
  { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', limit: '200K tokens / day' },
  { id: 'allam-2-7b', name: 'Allam 2 7B', limit: '500K tokens / day' },
  { id: 'groq/compound', name: 'Groq Compound', limit: 'No limit' },
  { id: 'groq/compound-mini', name: 'Groq Compound Mini', limit: 'No limit' }
];
