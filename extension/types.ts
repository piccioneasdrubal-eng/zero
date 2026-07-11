export type View = 'dashboard' | 'console' | 'ai' | 'settings';

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS'
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
}

export interface TokenStats {
  total: number;
  valid: number;
  inUse: number;
  expired: number;
}

export interface BotStats {
  connected: number;
  total: number;
  tokens: TokenStats;
  proxies: number;
  target: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}