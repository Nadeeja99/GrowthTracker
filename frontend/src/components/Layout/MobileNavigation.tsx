'use client';

import React from 'react';
import { Home, Target, Calendar, CheckSquare, BarChart3, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileNavigationProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export function MobileNavigation({ currentView, onViewChange }: MobileNavigationProps) {
  const navItems = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-2 py-1 safe-area-pb">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                'flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-200 min-w-0 flex-1',
                isActive
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
            >
              <Icon className={cn(
                'transition-all duration-200',
                isActive ? 'w-6 h-6' : 'w-5 h-5'
              )} />
              <span className={cn(
                'text-xs font-medium mt-1 truncate',
                isActive ? 'text-blue-600 dark:text-blue-400' : ''
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}