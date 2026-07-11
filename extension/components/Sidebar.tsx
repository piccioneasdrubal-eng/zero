import React from 'react';
import { View } from '../types';
import { LayoutDashboard, Terminal, Bot, Settings } from 'lucide-react';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'console', label: 'Live Console', icon: Terminal },
    { id: 'ai', label: 'AI Strategy', icon: Bot },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <aside className="w-20 md:w-64 bg-gray-950 border-r border-gray-800 flex flex-col items-center md:items-stretch py-6 z-20">
      <div className="mb-10 px-4 md:px-6 flex items-center justify-center md:justify-start">
        <div className="w-10 h-10 bg-gradient-to-br from-neon-blue to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
          <span className="text-white font-bold text-xl">X</span>
        </div>
        <span className="hidden md:block ml-3 text-xl font-bold tracking-wider text-gray-100">XEV</span>
      </div>

      <nav className="flex-1 w-full space-y-2 px-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 group
                ${isActive 
                  ? 'bg-gray-800 text-neon-blue shadow-[0_0_15px_rgba(0,243,255,0.1)] border border-gray-700' 
                  : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'
                }`}
            >
              <Icon size={24} className={`${isActive ? 'text-neon-blue' : 'text-gray-500 group-hover:text-gray-300'}`} />
              <span className={`hidden md:block ml-4 font-medium ${isActive ? 'text-neon-blue' : ''}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="hidden md:block ml-auto w-1.5 h-1.5 rounded-full bg-neon-blue shadow-[0_0_8px_#00f3ff]"></div>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-6 pb-4 hidden md:block">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-xs text-gray-500 mb-2">SERVER STATUS</p>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-300 font-mono">Running</span>
          </div>
          <p className="text-xs text-gray-600 mt-2 font-mono">Uptime: 04:20:59</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;