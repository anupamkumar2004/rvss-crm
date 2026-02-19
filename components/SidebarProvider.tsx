'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface SidebarContextType {
  isOpen: boolean;
  isPinned: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  pin: () => void;
  unpin: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  const [isPinned, setIsPinned] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedPinned = localStorage.getItem('sidebarPinned');
    const savedOpen = localStorage.getItem('sidebarOpen');

    if (savedPinned !== null) {
      setIsPinned(savedPinned === 'true');
    }
    if (savedOpen !== null) {
      setIsOpen(savedOpen === 'true');
    }

    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('sidebarPinned', String(isPinned));
    }
  }, [isPinned, mounted]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('sidebarOpen', String(isOpen));
    }
  }, [isOpen, mounted]);

  const toggle = () => setIsOpen(!isOpen);
  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const pin = () => {
    setIsPinned(true);
    setIsOpen(true);
  };
  const unpin = () => setIsPinned(false);

  const value = {
    isOpen,
    isPinned,
    toggle,
    open,
    close,
    pin,
    unpin,
  };

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarContext() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebarContext must be used within SidebarProvider');
  }
  return context;
}
