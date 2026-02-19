'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSidebar } from '@/hooks/useSidebar';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Settings,
  Package,
  DollarSign,
  Calendar,
  Headphones,
  LogOut,
  Pin,
  PinOff,
  ChevronRight,
  Activity,
} from 'lucide-react';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}

const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    color: 'from-blue-500 to-blue-600',
  },
  {
    id: 'leads',
    label: 'Leads & Enquiry',
    icon: Users,
    color: 'from-purple-500 to-purple-600',
  },
  {
    id: 'payment',
    label: 'Payments',
    icon: CreditCard,
    color: 'from-green-500 to-green-600',
  },
  {
    id: 'amc',
    label: 'AMC Management',
    icon: Settings,
    color: 'from-orange-500 to-orange-600',
  },
  {
    id: 'retail',
    label: 'Retail Records',
    icon: Package,
    color: 'from-pink-500 to-pink-600',
  },
  {
    id: 'pricing',
    label: 'Pricing',
    icon: DollarSign,
    color: 'from-teal-500 to-teal-600',
  },
  {
    id: 'todolist',
    label: 'Daily Tasks',
    icon: Calendar,
    color: 'from-indigo-500 to-indigo-600',
  },
  {
    id: 'servicedevice',
    label: 'Service Center',
    icon: Headphones,
    color: 'from-red-500 to-red-600',
  },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen, isPinned, pin, unpin } = useSidebar();
  const { signOut } = useAuth();

  const handleNavigation = (id: string) => {
    router.push(`/${id}`);
  };

  const getCurrentPage = () => {
    const path = pathname.split('/')[1] || 'dashboard';
    return path;
  };

  const currentPage = getCurrentPage();

  if (!isOpen) return null;

  return (
    
     
      <aside className="fixed inset-y-0 left-0 w-56 bg-gradient-to-b from-gray-900 via-gray-800 to-black shadow-2xl z-40 flex flex-col">

        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl flex items-center justify-center shadow-lg">
                <Activity size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">RVSS</h2>
                <p className="text-xs text-gray-400">Business Portal</p>
              </div>
            </div>

            {/* Pin/Unpin Button */}
            <button
              onClick={isPinned ? unpin : pin}
              className={`p-2 rounded-lg transition-all ${
                isPinned
                  ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                  : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
              }`}
              title={isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}
            >
              {isPinned ? <Pin size={18} /> : <PinOff size={18} />}
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent mt-4" />

        {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

          <div className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.id)}
                  className={`
                    group w-full flex items-center justify-between px-4 py-3.5 rounded-xl
                    transition-all duration-200
                    ${
                      isActive
                        ? `bg-gradient-to-r ${item.color} shadow-lg scale-105`
                        : 'hover:bg-white/10 hover:scale-105'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg transition-colors ${
                        isActive ? 'bg-white/20' : 'bg-white/10 group-hover:bg-white/20'
                      }`}
                    >
                      <Icon size={20} className="text-white" />
                    </div>
                    <span className="font-medium text-white text-sm">
                      {item.label}
                    </span>
                  </div>
                  <div
                    className={`text-white transition-all ${
                      isActive
                        ? 'translate-x-1 opacity-100'
                        : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-1'
                    }`}
                  >
                    <ChevronRight size={16} />
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={signOut}
            className="group w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-200 hover:bg-red-500/20 hover:scale-105"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20 group-hover:bg-red-500/30 transition-colors">
                <LogOut size={20} className="text-red-400" />
              </div>
              <span className="font-medium text-red-400 text-sm">Logout</span>
            </div>
          </button>
        </div>
      </aside>
  );
}
