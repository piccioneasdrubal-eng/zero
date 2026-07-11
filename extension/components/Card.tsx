import React from 'react';

interface CardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string; // Tailwind class part e.g., 'blue', 'green'
  subtext?: string;
}

const Card: React.FC<CardProps> = ({ title, value, icon, color = 'blue', subtext }) => {
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 relative overflow-hidden group hover:border-gray-600 transition-all">
      <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-${color}-400`}>
        {icon}
      </div>
      <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">{title}</h3>
      <div className="flex items-end space-x-2">
        <span className={`text-4xl font-bold text-white font-mono tracking-tight`}>{value}</span>
        {subtext && <span className="text-gray-500 text-sm mb-1">{subtext}</span>}
      </div>
      <div className={`absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-${color}-500 to-transparent opacity-50`}></div>
    </div>
  );
};

export default Card;