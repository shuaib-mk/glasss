import type { SystemLog } from '../types';
import { logRequestToSupabase } from '../supabase';

export function addAdminLog(log: Omit<SystemLog, 'id' | 'timestamp'>) {
  try {
    const existing = localStorage.getItem('sunni-admin-logs');
    const logs: SystemLog[] = existing ? JSON.parse(existing) : [];
    const newLog: SystemLog = {
      id: `log_${crypto.randomUUID()}`,
      timestamp: Date.now(),
      ...log
    };
    logs.unshift(newLog);
    localStorage.setItem('sunni-admin-logs', JSON.stringify(logs.slice(0, 100)));
  } catch (error) {
    console.warn('Failed to add admin log:', error);
  }

  void logRequestToSupabase(log);
}
