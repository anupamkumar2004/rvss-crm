'use client';

import React from 'react';
import { SidebarProvider } from './SidebarProvider';
import AppLayout from './AppLayout';
import { usePathname } from 'next/navigation'; // Add this

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith('/auth');
  
  // If on auth pages, don't wrap with SidebarProvider and AppLayout
  if (isAuthPage) {
    return <>{children}</>;
  }
  
  // Only wrap non-auth pages with the CRM layout
  return (
    <SidebarProvider>
      <AppLayout>
        {children}
      </AppLayout>
    </SidebarProvider>
  );
}