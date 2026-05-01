'use client';

import React, { useState } from 'react';
import { Menu, Sun, Moon, Target, LogOut, ChevronDown, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

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
  onMenuToggle,
}: HeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems = [
    { id: 'today', label: 'Today' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'goals', label: 'Goals' },
    { id: 'habits', label: 'Habits' },
    { id: 'focus', label: 'Focus' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'settings', label: 'Settings' },
  ];

  const getViewTitle = (view: string) => navItems.find(item => item.id === view)?.label || 'GrowthTracker';

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.firstName) return user.firstName[0].toUpperCase();
    if (user?.username) return user.username[0].toUpperCase();
    return 'U';
  };

  const getUserDisplayName = () => {
    if (user?.firstName && user?.lastName) return `${user.firstName} ${user.lastName}`;
    if (user?.firstName) return user.firstName;
    return user?.username || 'User';
  };

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
    router.push('/auth');
  };

  return (
    <header className={cn(
      'bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-4 sticky top-0 z-20',
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
                  {isMobile ? getViewTitle(currentView) : 'GrowthTracker'}
                </h1>
                {!isMobile && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Personal Development Tracker</p>
                )}
              </div>
            </div>
          </div>

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
          <button
            onClick={onThemeToggle}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(prev => !prev)}
              className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {getUserInitials()}
              </div>
              {!isMobile && (
                <>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
                    {getUserDisplayName()}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </>
              )}
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {getUserDisplayName()}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => { setShowUserMenu(false); onViewChange('settings'); }}
                    className="flex items-center space-x-2 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    <span>Profile & Settings</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
