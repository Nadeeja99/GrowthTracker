'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  position?: 'left' | 'right' | 'bottom';
}

export function MobileDrawer({ 
  isOpen, 
  onClose, 
  children, 
  title, 
  position = 'bottom' 
}: MobileDrawerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const drawerClasses = {
    left: 'left-0 top-0 h-full w-80 max-w-[80vw] translate-x-0',
    right: 'right-0 top-0 h-full w-80 max-w-[80vw] translate-x-0',
    bottom: 'bottom-0 left-0 right-0 max-h-[80vh] translate-y-0 rounded-t-2xl'
  };

  const transformClasses = {
    left: isOpen ? 'translate-x-0' : '-translate-x-full',
    right: isOpen ? 'translate-x-0' : 'translate-x-full',
    bottom: isOpen ? 'translate-y-0' : 'translate-y-full'
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/50 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed z-50 bg-white dark:bg-gray-900 shadow-xl transition-transform duration-300 ease-out',
          position === 'bottom' && 'bottom-0 left-0 right-0 max-h-[80vh] rounded-t-2xl',
          position === 'left' && 'left-0 top-0 h-full w-80 max-w-[80vw]',
          position === 'right' && 'right-0 top-0 h-full w-80 max-w-[80vw]',
          transformClasses[position]
        )}
      >
        {/* Handle for bottom drawer */}
        {position === 'bottom' && (
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
          </div>
        )}

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className={cn(
          'overflow-y-auto',
          position === 'bottom' ? 'max-h-[calc(80vh-4rem)]' : 'h-full',
          title ? 'p-4' : 'p-4'
        )}>
          {children}
        </div>
      </div>
    </>
  );
}