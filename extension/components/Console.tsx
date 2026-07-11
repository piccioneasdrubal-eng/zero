import React, { useState, useEffect, useRef } from 'react';
import { MOCK_LOGS } from '../constants';
import { LogEntry, LogLevel } from '../types';

const Console: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize with some mock logs and add random ones
  useEffect(() => {
    const formattedMockLogs = MOCK_LOGS.map(l => ({ ...l, level: l.level as LogLevel }));
    setLogs(formattedMockLogs);

    const interval = setInterval(() => {
      const messages = [
        "Packet received: ID 42 (UpdatePosition)",
        "Bot #24 disconnected (Timeout)",
        "Bot #15 connected",
        "Proxy 192.168.1.5 rotated",
        "Handshake failed for token abc...123",
        "Heartbeat sent to server"
      ];
      const levels = [LogLevel.INFO, LogLevel.INFO, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.SUCCESS];
      const randomIdx = Math.floor(Math.random() * messages.length);
      
      const newLog: LogEntry = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        level: levels[randomIdx],
        message: messages[randomIdx]
      };

      setLogs(prev => [...prev.slice(-49), newLog]); // Keep last 50
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case LogLevel.INFO: return 'text-blue-400';
      case LogLevel.WARN: return 'text-yellow-400';
      case LogLevel.ERROR: return 'text-red-500';
      case LogLevel.SUCCESS: return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="bg-black rounded-lg border border-gray-800 font-mono text-sm h-[600px] flex flex-col shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 rounded-t-lg">
        <div className="flex space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <span className="text-gray-500 text-xs">root@xevbots:~</span>
      </div>
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-1 scroll-smooth"
      >
        {logs.map((log) => (
          <div key={log.id} className="flex hover:bg-gray-900/50 -mx-2 px-2 py-0.5 rounded">
            <span className="text-gray-600 mr-3">[{log.timestamp}]</span>
            <span className={`font-bold mr-3 w-16 ${getLevelColor(log.level)}`}>
              {log.level}
            </span>
            <span className="text-gray-300">{log.message}</span>
          </div>
        ))}
        <div className="animate-pulse text-neon-blue mt-2">_</div>
      </div>
    </div>
  );
};

export default Console;