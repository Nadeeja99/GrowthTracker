'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: {
    icon: React.ReactNode;
    color: string;
    label: string;
  };
  rightAction?: {
    icon: React.ReactNode;
    color: string;
    label: string;
  };
  className?: string;
  disabled?: boolean;
}

export function SwipeableCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  className,
  disabled = false
}: SwipeableCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [startX, setStartX] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const threshold = 100; // Minimum distance to trigger action

  const handleStart = (clientX: number) => {
    if (disabled) return;
    setIsDragging(true);
    setStartX(clientX);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || disabled) return;
    const offset = clientX - startX;
    setDragOffset(offset);
  };

  const handleEnd = () => {
    if (!isDragging || disabled) return;
    
    if (Math.abs(dragOffset) > threshold) {
      if (dragOffset > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (dragOffset < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }
    
    setIsDragging(false);
    setDragOffset(0);
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX);
  };

  const handleMouseUp = () => {
    handleEnd();
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => handleMove(e.clientX);
      const handleGlobalMouseUp = () => handleEnd();

      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, startX]);

  const showLeftAction = dragOffset > threshold / 2 && rightAction;
  const showRightAction = dragOffset < -threshold / 2 && leftAction;

  return (
    <div className="relative overflow-hidden">
      {/* Background Actions */}
      {rightAction && (
        <div
          className={cn(
            'absolute inset-y-0 left-0 flex items-center justify-start pl-4 transition-opacity duration-200',
            rightAction.color,
            showLeftAction ? 'opacity-100' : 'opacity-0'
          )}
          style={{ width: Math.max(0, dragOffset) }}
        >
          <div className="flex items-center space-x-2 text-white">
            {rightAction.icon}
            <span className="font-medium">{rightAction.label}</span>
          </div>
        </div>
      )}

      {leftAction && (
        <div
          className={cn(
            'absolute inset-y-0 right-0 flex items-center justify-end pr-4 transition-opacity duration-200',
            leftAction.color,
            showRightAction ? 'opacity-100' : 'opacity-0'
          )}
          style={{ width: Math.max(0, -dragOffset) }}
        >
          <div className="flex items-center space-x-2 text-white">
            <span className="font-medium">{leftAction.label}</span>
            {leftAction.icon}
          </div>
        </div>
      )}

      {/* Main Card */}
      <div
        ref={cardRef}
        className={cn(
          'relative bg-white dark:bg-gray-800 transition-transform duration-200 ease-out',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
          className
        )}
        style={{
          transform: `translateX(${dragOffset}px)`,
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}