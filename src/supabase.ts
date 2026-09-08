import { createClient } from '@supabase/supabase-js';
import type { Chat, MessageData } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nezhorrdujbpermsimfx.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lemhvcnJkdWpicGVybXNpbWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MTA2MjgsImV4cCI6MjEwNDI4NjYyOH0.kCmgzK1lGQxjzNkEB9CRKBcDY4iij_RBHO6-zaP519A';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Retrieve or generate a persistent session ID for public users
export const getSessionId = (): string => {
  let sessionId = localStorage.getItem('sunni-session-id');
  if (!sessionId) {
    sessionId = 'session_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    localStorage.setItem('sunni-session-id', sessionId);
  }
  return sessionId;
};

// Generate a fresh session ID for new browser sessions
export const renewSessionId = (): string => {
  const newSessionId = 'session_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
  localStorage.setItem('sunni-session-id', newSessionId);
  return newSessionId;
};

/**
 * Automatically delete session and all messages from Supabase on tab close, reload, or navigate away.
 * Uses fetch with keepalive: true for 100% reliable execution during page unload/hide events.
 */
export function purgeSessionOnUnload(targetSessionId?: string) {
  const sessionId = targetSessionId || localStorage.getItem('sunni-session-id');
  if (!sessionId) return;

  const restEndpointChats = `${supabaseUrl}/rest/v1/chats?session_id=eq.${encodeURIComponent(sessionId)}`;
  const restEndpointMessages = `${supabaseUrl}/rest/v1/messages?session_id=eq.${encodeURIComponent(sessionId)}`;
  
  try {
    fetch(restEndpointChats, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      },
      keepalive: true
    });

    fetch(restEndpointMessages, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      },
      keepalive: true
    });
  } catch (err) {
    console.warn('Purge session on unload error:', err);
  }

  // Clear local browser cache
  try {
    localStorage.removeItem('islamic-chatbot-history');
    localStorage.removeItem('sunni-session-id');
  } catch (e) {}
}

/**
 * Universal Master Purge: Wipes ALL database records from Supabase (chats, messages, system_logs)
 * to reset storage strictly to 0 MB.
 */
export async function universalMasterPurgeSupabase(): Promise<{ success: boolean; message: string }> {
  try {
    const { error: msgErr } = await supabase.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error: chatErr } = await supabase.from('chats').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('system_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    localStorage.removeItem('islamic-chatbot-history');
    localStorage.removeItem('sunni-session-id');
    localStorage.removeItem('sunni-admin-logs');

    if (msgErr || chatErr) {
      return { success: false, message: `Purge warning: ${msgErr?.message || chatErr?.message}` };
    }

    return { success: true, message: 'Supabase storage reset to 0 MB successfully across all tables!' };
  } catch (e: any) {
    return { success: false, message: `Master purge failed: ${e.message}` };
  }
}

/**
 * Fetch all chats for the current session from Supabase
 */
export async function fetchChatsFromSupabase(): Promise<Chat[] | null> {
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
        role: m.role,
        text: m.text,
        image: m.image || null,
        citations: m.citations ? JSON.stringify(m.citations) : null,
        created_at: new Date().toISOString()
      }));

      const { error: msgErr } = await supabase
        .from('messages')
        .upsert(formattedMessages, { onConflict: 'id' });

      if (msgErr) {
        console.warn('Supabase upsert messages error:', msgErr.message);
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
  try {
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
  try {
    const sessionId = getSessionId();
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
  } catch (e) {
    return [];
  }
}

/**
 * Clear all system logs from Supabase
 */
export async function clearSystemLogsFromSupabase(): Promise<boolean> {
  try {
    await supabase.from('system_logs').delete().neq('session_id', 'none');
    return true;
  } catch (e) {
    return false;
  }
}
