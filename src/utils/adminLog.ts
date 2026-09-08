import type { SystemLog } from '../types';

export function addAdminLog(log: Omit<SystemLog, 'id' | 'timestamp'>) {
  try {
    const existing = sessionStorage.getItem('sunni-admin-logs');
    const logs: SystemLog[] = existing ? JSON.parse(existing) : [];
    const newLog: SystemLog = {
      id: `log_${crypto.randomUUID()}`,
      timestamp: Date.now(),
      ...log
    };
    logs.unshift(newLog);
    sessionStorage.setItem('sunni-admin-logs', JSON.stringify(logs.slice(0, 50)));
  } catch (error) {
    console.warn('Failed to add admin log:', error);
  }
}
