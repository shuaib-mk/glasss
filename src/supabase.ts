import { createClient } from '@supabase/supabase-js';
import type { Chat, MessageData } from './types';

const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const configuredSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const isSupabaseConfigured = Boolean(configuredSupabaseUrl && configuredSupabaseAnonKey);
const supabaseUrl = configuredSupabaseUrl || 'https://example.invalid';
const supabaseAnonKey = configuredSupabaseAnonKey || 'supabase-disabled';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Retrieve or generate a persistent session ID for public users
export const getSessionId = (): string => {
  let sessionId = localStorage.getItem('sunni-session-id');
  if (!sessionId) {
    sessionId = `session_${crypto.randomUUID()}`;
    localStorage.setItem('sunni-session-id', sessionId);
  }
  return sessionId;
};

/**
 * Fetch all chats for the current session from Supabase
 */
export async function fetchChatsFromSupabase(): Promise<Chat[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const sessionId = getSessionId();
    const { data: chatsData, error: chatsErr } = await supabase
      .from('chats')
      .select('*')
      .eq('session_id', sessionId)
      .order('updated_at', { ascending: false });

    if (chatsErr) {
      console.warn('Supabase fetch chats warning:', chatsErr.message);
      return null;
    }

    if (!chatsData || chatsData.length === 0) {
      return [];
    }

    const chatIds = chatsData.map(c => c.id);
    const { data: messagesData, error: msgErr } = await supabase
      .from('messages')
      .select('*')
      .in('chat_id', chatIds)
      .order('created_at', { ascending: true });

    if (msgErr) {
      console.warn('Supabase fetch messages warning:', msgErr.message);
    }

    const messagesByChat: Record<string, MessageData[]> = {};
    (messagesData || []).forEach(m => {
      if (!messagesByChat[m.chat_id]) {
        messagesByChat[m.chat_id] = [];
      }
      messagesByChat[m.chat_id].push({
        id: m.id,
        role: m.role as 'user' | 'ai',
        text: m.text,
        createdAt: new Date(m.created_at).getTime(),
        image: m.image || undefined,
        citations: m.citations ? JSON.parse(typeof m.citations === 'string' ? m.citations : JSON.stringify(m.citations)) : undefined
      });
    });

    return chatsData.map(c => ({
      id: c.id,
      title: c.title || 'New Chat',
      updatedAt: new Date(c.updated_at).getTime(),
      messages: messagesByChat[c.id] || []
    }));
  } catch (err) {
    console.error('Error fetching from Supabase:', err);
    return null;
  }
}

/**
 * Save or update a chat in Supabase
 */
export async function saveChatToSupabase(chat: Chat): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const sessionId = getSessionId();
    
    // Upsert chat record
    const { error: chatErr } = await supabase
      .from('chats')
      .upsert({
        id: chat.id,
        session_id: sessionId,
        title: chat.title,
        updated_at: new Date(chat.updatedAt).toISOString()
      }, { onConflict: 'id' });

    if (chatErr) {
      console.warn('Supabase upsert chat error:', chatErr.message);
      return false;
    }

    // Upsert messages
    if (chat.messages && chat.messages.length > 0) {
      const formattedMessages = chat.messages.map(m => ({
        id: m.id,
        chat_id: chat.id,
        session_id: sessionId,
        role: m.role,
        text: m.text,
        // OCR source images can exceed database and browser storage limits.
        image: null,
        citations: m.citations ? JSON.stringify(m.citations) : null,
        created_at: new Date(m.createdAt || chat.updatedAt).toISOString()
      }));

      const { error: msgErr } = await supabase
        .from('messages')
        .upsert(formattedMessages, { onConflict: 'id' });

      if (msgErr) {
        console.warn('Supabase upsert messages error:', msgErr.message);
        return false;
      }
    }

    return true;
  } catch (err) {
    console.error('Error saving to Supabase:', err);
    return false;
  }
}

/**
 * Delete a single chat from Supabase
 */
export async function deleteChatFromSupabase(chatId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error: messageError } = await supabase
      .from('messages')
      .delete()
      .eq('chat_id', chatId);
    if (messageError) {
      console.warn('Supabase delete messages error:', messageError.message);
      return false;
    }

    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', chatId);

    if (error) {
      console.warn('Supabase delete chat error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error deleting from Supabase:', err);
    return false;
  }
}

/**
 * Delete all chats for current session from Supabase
 */
export async function clearAllChatsFromSupabase(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const sessionId = getSessionId();
    const { error: messageError } = await supabase
      .from('messages')
      .delete()
      .eq('session_id', sessionId);
    if (messageError) {
      console.warn('Supabase clear messages error:', messageError.message);
      return false;
    }

    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('session_id', sessionId);

    if (error) {
      console.warn('Supabase clear all chats error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error clearing chats from Supabase:', err);
    return false;
  }
}

/**
 * Log user request telemetry to Supabase system_logs table for global live admin monitoring
 */
export async function logRequestToSupabase(log: {
  model: string;
  promptSnippet: string;
  latencyMs: number;
  status: 'success' | 'error';
  errorDetails?: string;
  fullPrompt?: string;
  fullResponse?: string;
}) {
  if (!isSupabaseConfigured || import.meta.env.VITE_ENABLE_REMOTE_TELEMETRY !== 'true') return;
  try {
    const sessionId = getSessionId();
    await supabase.from('system_logs').insert({
      session_id: sessionId,
      model: log.model,
      prompt_snippet: log.promptSnippet,
      latency_ms: log.latencyMs,
      status: log.status,
      error_details: log.errorDetails || null,
      full_prompt: log.fullPrompt || null,
      full_response: log.fullResponse || null
    });
  } catch (e) {
    console.warn('Supabase system log insert warning:', e);
  }
}

/**
 * Fetch latest 100 live request logs across all users from Supabase
 */
export async function fetchSystemLogsFromSupabase(): Promise<any[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.warn('Supabase fetch logs warning:', error.message);
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}
