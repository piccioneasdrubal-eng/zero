import { BotStats } from './types';

export const INITIAL_STATS: BotStats = {
  connected: 0,
  total: 200,
  tokens: {
    total: 1450,
    valid: 1200,
    inUse: 0,
    expired: 250
  },
  proxies: 312,
  target: 'Connecting...'
};

export const MOCK_LOGS = [
  { id: '1', timestamp: '10:00:01', level: 'INFO', message: 'TokenManager: Loaded 1450 tokens' },
  { id: '2', timestamp: '10:00:02', level: 'INFO', message: 'ProxyManager: Checked 312 proxies' },
  { id: '3', timestamp: '10:00:05', level: 'SUCCESS', message: 'WebSocket Server started on port 8080' },
  { id: '4', timestamp: '10:00:15', level: 'WARN', message: 'Client connected from 127.0.0.1' },
];