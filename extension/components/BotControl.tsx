import React, { useState, useEffect } from 'react';
import Card from './Card';
import { INITIAL_STATS } from '../constants';
import { BotStats } from '../types';
import { Play, Square, Users, Globe, Database, ShieldCheck, Activity } from 'lucide-react';

const BotControl: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<BotStats>(INITIAL_STATS);

  // Mock live updates for tokens and bots
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setStats(prev => {
        // Simulate bots connecting
        const newConnected = Math.min(prev.connected + Math.floor(Math.random() * 5), prev.total);
        
        // Simulate token usage based on connected bots + some decay
        const newInUse = newConnected; 
        const newExpired = Math.min(prev.tokens.expired + (Math.random() > 0.8 ? 1 : 0), prev.tokens.total);
        const newValid = prev.tokens.total - newInUse - newExpired;

        return {
          ...prev,
          connected: newConnected,
          tokens: {
            ...prev.tokens,
            valid: Math.max(0, newValid),
            inUse: newInUse,
            expired: newExpired
          },
          proxies: Math.max(prev.proxies - (Math.random() > 0.9 ? 1 : 0), 300)
        };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const toggleBots = () => {
    setIsRunning(!isRunning);
    if (!isRunning) {
      // Reset connected when starting
      setStats(prev => ({ 
        ...prev, 
        connected: 0,
        tokens: { ...prev.tokens, inUse: 0, valid: prev.tokens.total - prev.tokens.expired } 
      }));
    } else {
        // Reset inUse when stopping
        setStats(prev => ({
            ...prev,
            tokens: { ...prev.tokens, inUse: 0, valid: prev.tokens.total - prev.tokens.expired }
        }));
    }
  };

  // Calculate percentages for the progress bar
  const validPercent = (stats.tokens.valid / stats.tokens.total) * 100;
  const inUsePercent = (stats.tokens.inUse / stats.tokens.total) * 100;
  const expiredPercent = (stats.tokens.expired / stats.tokens.total) * 100;

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <Card 
          title="Active Bots" 
          value={stats.connected} 
          subtext={`/ ${stats.total}`}
          icon={<Users size={48} />}
          color="neon-blue"
        />
        
        {/* Detailed Token Health Card */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4 relative overflow-hidden group hover:border-gray-600 transition-all col-span-1">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity text-purple-400">
                <Database size={48} />
            </div>
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wider">Token Health</h3>
                <div className="flex items-center space-x-1">
                    <Activity size={12} className="text-neon-green" />
                    <span className="text-[10px] text-neon-green animate-pulse">LIVE</span>
                </div>
            </div>
            
            <div className="flex items-end space-x-2 mb-2">
                <span className="text-2xl font-bold text-white font-mono">{stats.tokens.total}</span>
                <span className="text-gray-500 text-xs mb-1">Total</span>
            </div>

            {/* Token Progress Bar */}
            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden flex mb-2">
                <div style={{ width: `${validPercent}%` }} className="h-full bg-neon-green shadow-[0_0_10px_rgba(10,255,0,0.5)]" title="Valid"></div>
                <div style={{ width: `${inUsePercent}%` }} className="h-full bg-neon-blue shadow-[0_0_10px_rgba(0,243,255,0.5)]" title="In Use"></div>
                <div style={{ width: `${expiredPercent}%` }} className="h-full bg-red-500" title="Expired"></div>
            </div>

            {/* Token Legend */}
            <div className="flex justify-between text-[10px] font-mono">
                <div className="text-neon-green">
                    V: {stats.tokens.valid}
                </div>
                <div className="text-neon-blue">
                    U: {stats.tokens.inUse}
                </div>
                <div className="text-red-400">
                    E: {stats.tokens.expired}
                </div>
            </div>
        </div>

        <Card 
          title="Live Proxies" 
          value={stats.proxies} 
          icon={<Globe size={48} />}
          color="green"
        />
        <Card 
          title="Security Status" 
          value="SECURE" 
          icon={<ShieldCheck size={48} />}
          color="red"
        />
      </div>

      {/* Main Control Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Controls */}
        <div className="lg:col-span-2 bg-gray-800 rounded-xl border border-gray-700 p-5 flex flex-col">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center shrink-0">
            <span className="w-1.5 h-5 bg-neon-blue rounded mr-3"></span>
            Bot Controller
          </h3>
          
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-900/50 p-4 rounded-lg border border-gray-800 mb-4 shrink-0">
            <div className="flex flex-col w-full md:w-auto">
              <span className="text-gray-400 text-xs mb-1">Target Server</span>
              <div className="font-mono text-sm md:text-base text-white truncate">ws://live-arena-1.agar.io:443</div>
            </div>
            
            <button
              onClick={toggleBots}
              className={`
                w-full md:w-auto relative group overflow-hidden px-6 py-3 rounded-lg font-bold text-sm tracking-wide transition-all duration-300
                ${isRunning 
                  ? 'bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500 hover:text-white' 
                  : 'bg-neon-blue/10 text-neon-blue border border-neon-blue/50 hover:bg-neon-blue hover:text-black'
                }
              `}
            >
              <span className="relative z-10 flex items-center justify-center">
                {isRunning ? <><Square size={16} className="mr-2" /> STOP ATTACK</> : <><Play size={16} className="mr-2" /> START BOTS</>}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 overflow-y-auto pr-1">
             <div className="bg-gray-900 p-3 rounded border border-gray-800">
               <label className="text-gray-500 text-[10px] uppercase font-bold">Spawn Delay</label>
               <input type="range" className="w-full mt-2 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-neon-blue" />
               <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                 <span>10ms</span>
                 <span>500ms</span>
               </div>
             </div>
             <div className="bg-gray-900 p-3 rounded border border-gray-800">
               <label className="text-gray-500 text-[10px] uppercase font-bold">Movement Speed</label>
               <input type="range" className="w-full mt-2 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" />
               <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                 <span>Slow</span>
                 <span>Fast</span>
               </div>
             </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 flex flex-col">
          <h3 className="text-lg font-bold text-white mb-4 shrink-0">Quick Actions</h3>
          <div className="space-y-2 flex-1 overflow-y-auto pr-1">
            <button className="w-full text-left px-3 py-2 bg-gray-700/50 hover:bg-gray-700 rounded text-gray-300 transition-colors text-xs font-mono border border-gray-600 truncate">
              $ check_proxies --force
            </button>
            <button className="w-full text-left px-3 py-2 bg-gray-700/50 hover:bg-gray-700 rounded text-gray-300 transition-colors text-xs font-mono border border-gray-600 truncate">
              $ tokens reload --all
            </button>
            <button className="w-full text-left px-3 py-2 bg-gray-700/50 hover:bg-gray-700 rounded text-gray-300 transition-colors text-xs font-mono border border-gray-600 truncate">
              $ server restart
            </button>
            <button className="w-full text-left px-3 py-2 bg-gray-700/50 hover:bg-gray-700 rounded text-gray-300 transition-colors text-xs font-mono border border-gray-600 truncate">
              $ flush_dns
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BotControl;