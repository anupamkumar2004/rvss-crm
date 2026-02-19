'use client';

import React from 'react';
import Sidebar from './Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto ml-56">
        {children}
      </main>
    </div>
  );
}
