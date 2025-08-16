'use client';

import React from 'react';
import { Menu, Bell, Settings, Sun, Moon, User, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  currentView: string;
  onViewChange: (view: string) => void;
  isDarkMode: boolean;
  onThemeToggle: () => void;
  isMobile: boolean;
  onMenuToggle?: () => void;
}

export function Header({ 
  currentView, 
  onViewChange, 
  isDarkMode, 
  onThemeToggle, 
  isMobile,
  onMenuToggle 
}: HeaderProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'goals', label: 'Goals' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'settings', label: 'Settings' }
  ];

  const getViewTitle = (view: string) => {
    const item = navItems.find(item => item.id === view);
    return item?.label || 'DevTracker';
  };

  return (
    <header className={cn(
      'bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-4 sticky top-0 z-20',
      isMobile && 'pb-safe'
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 md:space-x-8">
          <div className="flex items-center space-x-3">
            {isMobile && onMenuToggle && (
              <button
                onClick={onMenuToggle}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors md:hidden"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                  {isMobile ? getViewTitle(currentView) : 'DevTracker'}
                </h1>
                {!isMobile && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Personal Development Tracker
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          {!isMobile && (
            <nav className="hidden lg:flex space-x-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    currentView === item.id
                      ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center space-x-2 md:space-x-3">
          <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Bell className={cn('transition-all', isMobile ? 'w-5 h-5' : 'w-5 h-5')} />
          </button>
          
          <button
            onClick={onThemeToggle}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {isDarkMode ? (
              <Sun className={cn('transition-all', isMobile ? 'w-5 h-5' : 'w-5 h-5')} />
            ) : (
              <Moon className={cn('transition-all', isMobile ? 'w-5 h-5' : 'w-5 h-5')} />
            )}
          </button>

          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>
    </header>
  );
}