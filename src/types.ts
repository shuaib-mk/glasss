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
  { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B', limit: 'Ultra Fast & High Quota' },
  { id: 'qwen/qwen3.6-27b', name: 'Qwen 3.6 27B', limit: 'High Accuracy Reasoning' },
  { id: 'allam-2-7b', name: 'Allam 2 7B', limit: 'Islamic & Arabic Specialized' },
  { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', limit: 'Large Capability' },
  { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B', limit: 'Fast Preview' }
];

export interface SystemLog {
  id: string;
  timestamp: number;
  model: string;
  promptSnippet: string;
  latencyMs: number;
  status: 'success' | 'error';
  errorDetails?: string;
  fullPrompt?: string;
  fullResponse?: string;
  sessionId?: string;
}

export interface AdminConfig {
  customApiKey: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

