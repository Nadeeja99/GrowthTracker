'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Sun, Moon, Monitor, Clock, Save, CheckCircle, AlertCircle, ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { apiClient } from '@/lib/api';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { AppSettings } from '@/types';
import { cn } from '@/lib/utils';
import { CoachSettings } from '@/components/Coach/CoachSettings';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  notifications: true,
  workingHours: { start: '09:00', end: '18:00' },
  pomodoroSettings: {
    workDuration: 25,
    breakDuration: 5,
    longBreakDuration: 15,
    cyclesBeforeLongBreak: 4,
  },
};

export function Settings() {
  const { user, updateUser, logoutEverywhere } = useAuth();
  const { isDark: isDarkMode, preference: themePreference, setPreference: setThemePreference } = useTheme();
  const router = useRouter();
  const [signingOutEverywhere, setSigningOutEverywhere] = useState(false);
  const [appSettings, setAppSettings] = useLocalStorage<AppSettings>('dev-tracker-settings', DEFAULT_SETTINGS);

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'UTC');

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [profileError, setProfileError] = useState('');

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileStatus('idle');
    setProfileError('');
    try {
      const response = await apiClient.updateProfile({ firstName, lastName, timezone });
      if (response.success && response.data?.user) {
        setProfileStatus('success');
        updateUser(response.data.user);
        setTimeout(() => setProfileStatus('idle'), 3000);
      } else {
        throw new Error(response.error || 'Failed to save profile');
      }
    } catch (err) {
      setProfileStatus('error');
      setProfileError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const updatePomodoro = (key: keyof AppSettings['pomodoroSettings'], value: number) => {
    setAppSettings(prev => ({
      ...prev,
      pomodoroSettings: { ...prev.pomodoroSettings, [key]: value },
    }));
  };

  const updateWorkingHours = (key: 'start' | 'end', value: string) => {
    setAppSettings(prev => ({
      ...prev,
      workingHours: { ...prev.workingHours, [key]: value },
    }));
  };

  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezones = Array.from(new Set([
    detectedTimezone, timezone,
    'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Europe/London', 'Europe/Dublin', 'Europe/Paris', 'Europe/Berlin', 'Asia/Colombo', 'Asia/Kolkata',
    'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney',
  ]));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Profile</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
              <input aria-label="First name"
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="First name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
              <input aria-label="Last name"
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Last name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
            <input aria-label="Username"
              type="text"
              value={user?.username || ''}
              disabled
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Timezone</label>
            <select aria-label="Timezone"
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {timezones.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          {profileStatus === 'error' && (
            <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          {profileStatus === 'success' && (
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 text-sm">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Profile saved successfully</span>
            </div>
          )}

          <button
            onClick={handleSaveProfile}
            disabled={profileSaving}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{profileSaving ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </div>
      </div>

      {/* Appearance */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {isDarkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Appearance</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">System follows your device&apos;s light/dark setting</p>
          </div>
        </div>

        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2 bg-gray-100 dark:bg-gray-900 rounded-lg p-1">
          {([
            { value: 'light', label: 'Light', icon: Sun },
            { value: 'dark', label: 'Dark', icon: Moon },
            { value: 'system', label: 'System', icon: Monitor },
          ] as const).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              role="radio"
              aria-checked={themePreference === value}
              onClick={() => setThemePreference(value)}
              className={cn(
                'flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                themePreference === value
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Working Hours */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            <Clock className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Working Hours</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Time</label>
            <input aria-label="Working hours start"
              type="time"
              value={appSettings.workingHours.start}
              onChange={e => updateWorkingHours('start', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Time</label>
            <input aria-label="Working hours end"
              type="time"
              value={appSettings.workingHours.end}
              onChange={e => updateWorkingHours('end', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Pomodoro */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Pomodoro Timer</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Durations in minutes</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'workDuration' as const, label: 'Work Session' },
            { key: 'breakDuration' as const, label: 'Short Break' },
            { key: 'longBreakDuration' as const, label: 'Long Break' },
            { key: 'cyclesBeforeLongBreak' as const, label: 'Cycles Before Long Break' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
              <input aria-label={label}
                type="number"
                min={1}
                max={120}
                value={appSettings.pomodoroSettings[key]}
                onChange={e => updatePomodoro(key, Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">Settings are saved automatically</p>
      </div>

      <CoachSettings />

      {/* Security */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <ShieldCheck className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Security</h2>
        </div>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Lost a device or signed in somewhere public? End every session, including this one.
          </p>
          <button
            type="button"
            disabled={signingOutEverywhere}
            onClick={async () => {
              setSigningOutEverywhere(true);
              try {
                await logoutEverywhere();
                router.push('/auth');
              } finally {
                setSigningOutEverywhere(false);
              }
            }}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60"
          >
            <LogOut className="w-4 h-4" />
            {signingOutEverywhere ? 'Signing out…' : 'Sign out everywhere'}
          </button>
        </div>
      </div>
    </div>
  );
}
