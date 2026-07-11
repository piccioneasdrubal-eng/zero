import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import BotControl from './components/BotControl';
import Console from './components/Console';
import AIChat from './components/AIChat';
import { View } from './types';
import { Settings } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <BotControl />;
      case 'console':
        return <Console />;
      case 'ai':
        return <AIChat />;
      case 'settings':
        return (
          <div className="p-6 bg-gray-800 rounded-lg border border-gray-700 h-full">
            <h2 className="text-2xl font-bold mb-4 text-neon-blue">Configuration</h2>
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Server Port</label>
                <input type="number" defaultValue={8080} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-neon-blue outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Proxy List (Path)</label>
                <input type="text" defaultValue="./config/proxies.txt" className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white focus:border-neon-blue outline-none" />
              </div>
              <div className="flex items-center mt-4">
                <button className="bg-neon-blue text-black font-bold py-2 px-4 rounded hover:bg-cyan-400 transition-colors">
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return <BotControl />;
    }
  };

  return (
    <div className="flex w-full h-full bg-gray-950 text-gray-200">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <main className="flex-1 p-4 bg-gray-900 relative overflow-y-auto h-full">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          <header className="mb-6 flex justify-between items-center shrink-0">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent">
                XevBots <span className="text-gray-500 text-sm font-mono">v1.0.0</span>
              </h1>
              <p className="text-gray-400 text-xs mt-0.5">Advanced Agar.io Helper</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
                <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse"></div>
                <span className="text-xs text-gray-300 font-mono">System Operational</span>
              </div>
            </div>
          </header>
          
          <div className="flex-1 min-h-0">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;