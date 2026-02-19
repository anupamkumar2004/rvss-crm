"use client";

import { useRouter } from 'next/navigation';
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  CheckCircle, Clock, AlertTriangle, TrendingUp, Phone, CreditCard, Settings, Users,
  Calendar, Bell, RotateCcw, AlertCircle, Info, X, Activity, LogOut, Headphones, Package,
  DollarSign, Wrench, ChevronRight
} from 'lucide-react';

interface DashboardStats {
  tasks: {
    today: number;
    pending: number;
    completed: number;
    urgent: number;
  };
  leads: {
    total: number;
    thisMonth: number;
    hotLeads: number;
    pendingFollowups: number;
  };
  payments: {
    receivedThisMonth: number;
    pending: number;
    partial: number;
    totalDueAmount: number;
  };
  products: {
    total: number;
    categories: number;
  };
  retail: {
    total: number;
    open: number;
    closed: number;
    totalRevenue: number;
  };
  services: {
    total: number;
    inRepair: number;
    readyForDelivery: number;
    pendingDelivery: number;
  };
  amc: {
    active: number;
    expired: number;
    upcoming: number;
  };
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export default function DashboardPage() {
  // ========== HOOKS AT THE TOP ==========
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const hasInitialized = useRef(false);
  
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    tasks: { today: 0, pending: 0, completed: 0, urgent: 0 },
    leads: { total: 0, thisMonth: 0, hotLeads: 0, pendingFollowups: 0 },
    payments: { receivedThisMonth: 0, pending: 0, partial: 0, totalDueAmount: 0 },
    products: { total: 0, categories: 0 },
    retail: { total: 0, open: 0, closed: 0, totalRevenue: 0 },
    services: { total: 0, inRepair: 0, readyForDelivery: 0, pendingDelivery: 0 },
    amc: { active: 0, expired: 0, upcoming: 0 },
  });

  // ========== EFFECTS ==========
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && !hasInitialized.current) {
      hasInitialized.current = true;
      fetchDashboardData();
    }
  }, [user]);

  // ========== UTILITY FUNCTIONS ==========
  
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(toast => toast.id !== id)), 4000);
  };

  const getDateRange = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    return {
      today: today.toISOString().split('T')[0],
      monthStart: startOfMonth.toISOString().split('T')[0],
      monthEnd: endOfMonth.toISOString().split('T')[0],
    };
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (!currentUser) {
        showToast('Please login to continue', 'error');
        router.push('/auth/login');
        return;
      }

      const dateRange = getDateRange();
      const newStats: DashboardStats = {
        tasks: { today: 0, pending: 0, completed: 0, urgent: 0 },
        leads: { total: 0, thisMonth: 0, hotLeads: 0, pendingFollowups: 0 },
        payments: { receivedThisMonth: 0, pending: 0, partial: 0, totalDueAmount: 0 },
        products: { total: 0, categories: 0 },
        retail: { total: 0, open: 0, closed: 0, totalRevenue: 0 },
        services: { total: 0, inRepair: 0, readyForDelivery: 0, pendingDelivery: 0 },
        amc: { active: 0, expired: 0, upcoming: 0 },
      };

      // ========== TASKS QUERIES ==========
      // Total tasks today
      const { count: tasksToday } = await supabase
        .from('daily_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('deleted', false)
        .eq('task_date', dateRange.today);

      // Pending tasks
      const { count: tasksPending } = await supabase
        .from('daily_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('deleted', false)
        .eq('task_date', dateRange.today)
        .neq('status', 'Completed');

      // Completed tasks
      const { count: tasksCompleted } = await supabase
        .from('daily_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('deleted', false)
        .eq('task_date', dateRange.today)
        .eq('status', 'Completed');

      // Urgent tasks
      const { count: tasksUrgent } = await supabase
        .from('daily_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('deleted', false)
        .eq('task_date', dateRange.today)
        .in('priority', ['Urgent', 'High']);

      newStats.tasks = {
        today: tasksToday || 0,
        pending: tasksPending || 0,
        completed: tasksCompleted || 0,
        urgent: tasksUrgent || 0,
      };

      // ========== LEADS QUERIES ==========
      // Total leads (all-time)
      const { count: leadsTotal } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('deleted', false);

      // Leads this month
      const { count: leadsThisMonth } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('deleted', false)
        .gte('created_at', dateRange.monthStart)
        .lte('created_at', dateRange.monthEnd);

      // Hot leads (Very High interest)
      const { count: hotLeads } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('deleted', false)
        .eq('interest', 'Very High');

      // Pending follow-ups
      const { count: pendingFollowups } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('deleted', false)
        .neq('status', 'Converted')
        .neq('status', 'Lost');

      newStats.leads = {
        total: leadsTotal || 0,
        thisMonth: leadsThisMonth || 0,
        hotLeads: hotLeads || 0,
        pendingFollowups: pendingFollowups || 0,
      };

      // ========== PAYMENTS QUERIES ==========
      // Payments received this month
      const { data: paymentsReceivedData } = await supabase
        .from('payments')
        .select('paid_amount')
        .eq('deleted', false)
        .eq('status', 'Received')
        .gte('payment_date', dateRange.monthStart)
        .lte('payment_date', dateRange.monthEnd);

      const receivedThisMonth = paymentsReceivedData?.reduce((sum, p) => sum + (p.paid_amount || 0), 0) || 0;

      // Pending payments count
      const { count: pendingPaymentsCount } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('deleted', false)
        .eq('status', 'Pending');

      // Partial payments count
      const { count: partialPaymentsCount } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('deleted', false)
        .eq('status', 'Partial');

      // Total due amount
      const { data: paymentsDueData } = await supabase
        .from('payments')
        .select('due_amount')
        .eq('deleted', false)
        .in('status', ['Pending', 'Partial']);

      const totalDueAmount = paymentsDueData?.reduce((sum, p) => sum + (p.due_amount || 0), 0) || 0;

      newStats.payments = {
        receivedThisMonth: receivedThisMonth,
        pending: pendingPaymentsCount || 0,
        partial: partialPaymentsCount || 0,
        totalDueAmount: totalDueAmount,
      };

      // ========== PRODUCTS (PRICING) QUERIES ==========
      // Total products
      const { count: productsTotal } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('deleted', false);

      // Distinct categories
      const { data: categoriesData } = await supabase
        .from('products')
        .select('category')
        .eq('deleted', false)
        .neq('category', null);

      const uniqueCategories = new Set(categoriesData?.map(p => p.category));

      newStats.products = {
        total: productsTotal || 0,
        categories: uniqueCategories.size,
      };

      // ========== RETAIL QUERIES ==========
      // Total retail records
      const { count: retailTotal } = await supabase
        .from('retail_records')
        .select('*', { count: 'exact', head: true })
        .eq('deleted', false);

      // Open records
      const { count: retailOpen } = await supabase
        .from('retail_records')
        .select('*', { count: 'exact', head: true })
        .eq('deleted', false)
        .eq('record_status', 'Open');

      // Closed records
      const { count: retailClosed } = await supabase
        .from('retail_records')
        .select('*', { count: 'exact', head: true })
        .eq('deleted', false)
        .eq('record_status', 'Closed');

      // Total revenue from retail
      const { data: retailRevenueData } = await supabase
        .from('retail_records')
        .select('amount')
        .eq('deleted', false)
        .eq('charges_applied', 'Yes');

      const totalRetailRevenue = retailRevenueData?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;

      newStats.retail = {
        total: retailTotal || 0,
        open: retailOpen || 0,
        closed: retailClosed || 0,
        totalRevenue: totalRetailRevenue,
      };

      // ========== SERVICE DEVICES QUERIES ==========
      // Total devices
      const { count: servicesTotal } = await supabase
        .from('services')
        .select('*', { count: 'exact', head: true })
        .eq('deleted', false);

      // Devices in repair
      const { count: inRepair } = await supabase
        .from('services')
        .select('*', { count: 'exact', head: true })
        .eq('deleted', false)
        .in('status', ['Received', 'Under Checking', 'In Repair']);

      // Ready for delivery
      const { count: readyForDelivery } = await supabase
        .from('services')
        .select('*', { count: 'exact', head: true })
        .eq('deleted', false)
        .eq('status', 'Ready for Delivery');

      // Pending delivery
      const { count: pendingDelivery } = await supabase
        .from('services')
        .select('*', { count: 'exact', head: true })
        .eq('deleted', false)
        .eq('status', 'Pending Delivery');

      newStats.services = {
        total: servicesTotal || 0,
        inRepair: inRepair || 0,
        readyForDelivery: readyForDelivery || 0,
        pendingDelivery: pendingDelivery || 0,
      };

      // ========== AMC QUERIES ==========
      // Active AMCs
      const { count: amcActive } = await supabase
        .from('amcs')
        .select('*', { count: 'exact', head: true })
        .eq('deleted', false)
        .eq('amc_status', 'Active');

      // Expired AMCs
      const { count: amcExpired } = await supabase
        .from('amcs')
        .select('*', { count: 'exact', head: true })
        .eq('deleted', false)
        .eq('amc_status', 'Expired');

      // Upcoming AMCs (next 30 days)
      const upcoming30Days = new Date();
      upcoming30Days.setDate(upcoming30Days.getDate() + 30);

      const { count: amcUpcoming } = await supabase
        .from('amcs')
        .select('*', { count: 'exact', head: true })
        .eq('deleted', false)
        .eq('amc_status', 'Upcoming')
        .lte('start_date', upcoming30Days.toISOString().split('T')[0]);

      newStats.amc = {
        active: amcActive || 0,
        expired: amcExpired || 0,
        upcoming: amcUpcoming || 0,
      };

      setStats(newStats);
      showToast('Dashboard updated successfully', 'success');

    } catch (error: any) {
      console.error('Dashboard fetch error:', error);
      showToast(error?.message || 'Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ========== LOADING STATE ==========
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-slate-600 mx-auto"></div>
          <p className="mt-4 text-slate-700 font-semibold">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-slate-600 mx-auto"></div>
            <div className="animate-ping absolute inset-0 rounded-full h-16 w-16 border-4 border-slate-300 mx-auto"></div>
          </div>
          <p className="mt-6 text-slate-700 font-semibold">Loading Dashboard...</p>
          <p className="text-slate-500 text-sm mt-2">Fetching your data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(100px); } to { opacity: 1; transform: translateX(0); } }
        .animate-fade-in { animation: fadeIn 0.15s ease-out; }
        .animate-slide-in-right { animation: slideInRight 0.3s ease-out; }
      `}</style>

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-[100] space-y-3 max-w-md">
        {toasts.map((toast) => (
          <div key={toast.id} className={`flex items-start gap-3 px-5 py-4 rounded-xl shadow-lg animate-slide-in-right border-l-4 ${
            toast.type === 'success' ? 'bg-green-50 border-green-500 text-green-900' :
            toast.type === 'error' ? 'bg-red-50 border-red-500 text-red-900' :
            toast.type === 'warning' ? 'bg-yellow-50 border-yellow-500 text-yellow-900' :
            'bg-blue-50 border-blue-500 text-blue-900'
          }`}>
            <div className="flex-shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle size={18} />}
              {toast.type === 'error' && <AlertCircle size={18} />}
              {toast.type === 'warning' && <AlertTriangle size={18} />}
              {toast.type === 'info' && <Info size={18} />}
            </div>
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="flex-shrink-0 hover:opacity-70">
              <X size={18} />
            </button>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="p-4 md:p-6">
        <div className="max-w-7xl mx-auto">

          {/* HEADER */}
          <div className="bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 rounded-2xl shadow-lg p-6 md:p-8 mb-8 border border-slate-600/30">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-4xl font-bold text-white mb-1">Dashboard</h1>
                <p className="text-slate-200">RVSS CRM Management System</p>
                <div className="flex items-center gap-2 mt-3 text-sm text-slate-200">
                  <Calendar size={16} />
                  <span>{new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { showToast('Refreshing...', 'info'); fetchDashboardData(); }}
                  className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition">
                  <RotateCcw size={18} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <button
                  onClick={signOut}
                  className="flex items-center gap-2 px-5 py-3 bg-red-500/90 hover:bg-red-600 text-white rounded-lg font-semibold transition">
                  <LogOut size={18} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>
          </div>

          {/* 7 MODULE CARDS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
            
            {/* 1. DAILY TASKS */}
            <div onClick={() => router.push('/todolist')} className="bg-white rounded-xl shadow-md hover:shadow-lg border border-slate-200 p-6 cursor-pointer transition-all hover:scale-105 hover:border-blue-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Calendar size={24} className="text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Daily Tasks</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Today</span>
                  <span className="text-2xl font-bold text-blue-600">{stats.tasks.today}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-green-50 p-2 rounded">
                    <p className="text-green-700 font-semibold">{stats.tasks.completed}</p>
                    <p className="text-green-600">Completed</p>
                  </div>
                  <div className="bg-yellow-50 p-2 rounded">
                    <p className="text-yellow-700 font-semibold">{stats.tasks.pending}</p>
                    <p className="text-yellow-600">Pending</p>
                  </div>
                </div>
                <div className="bg-red-50 p-2 rounded text-xs">
                  <p className="text-red-700 font-semibold">{stats.tasks.urgent}</p>
                  <p className="text-red-600">Urgent/High</p>
                </div>
              </div>
              <button className="w-full mt-4 py-2 text-blue-600 font-semibold text-sm hover:bg-blue-50 rounded transition flex items-center justify-center gap-1">
                View All <ChevronRight size={16} />
              </button>
            </div>

            {/* 2. LEADS & ENQUIRY */}
            <div onClick={() => router.push('/leads')} className="bg-white rounded-xl shadow-md hover:shadow-lg border border-slate-200 p-6 cursor-pointer transition-all hover:scale-105 hover:border-purple-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users size={24} className="text-purple-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Leads</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Total (All-time)</span>
                  <span className="text-2xl font-bold text-purple-600">{stats.leads.total}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-red-50 p-2 rounded">
                    <p className="text-red-700 font-semibold">{stats.leads.hotLeads}</p>
                    <p className="text-red-600">Hot Leads</p>
                  </div>
                  <div className="bg-orange-50 p-2 rounded">
                    <p className="text-orange-700 font-semibold">{stats.leads.thisMonth}</p>
                    <p className="text-orange-600">This Month</p>
                  </div>
                </div>
                <div className="bg-blue-50 p-2 rounded text-xs">
                  <p className="text-blue-700 font-semibold">{stats.leads.pendingFollowups}</p>
                  <p className="text-blue-600">Pending Follow-ups</p>
                </div>
              </div>
              <button className="w-full mt-4 py-2 text-purple-600 font-semibold text-sm hover:bg-purple-50 rounded transition flex items-center justify-center gap-1">
                View All <ChevronRight size={16} />
              </button>
            </div>

            {/* 3. PAYMENTS */}
            <div onClick={() => router.push('/payment')} className="bg-white rounded-xl shadow-md hover:shadow-lg border border-slate-200 p-6 cursor-pointer transition-all hover:scale-105 hover:border-green-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CreditCard size={24} className="text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Payments</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">This Month</span>
                  <span className="text-2xl font-bold text-green-600">₹{(stats.payments.receivedThisMonth / 1000).toFixed(1)}K</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-red-50 p-2 rounded">
                    <p className="text-red-700 font-semibold">{stats.payments.pending}</p>
                    <p className="text-red-600">Pending</p>
                  </div>
                  <div className="bg-yellow-50 p-2 rounded">
                    <p className="text-yellow-700 font-semibold">{stats.payments.partial}</p>
                    <p className="text-yellow-600">Partial</p>
                  </div>
                </div>
                <div className="bg-red-50 p-2 rounded text-xs">
                  <p className="text-red-700 font-semibold">₹{(stats.payments.totalDueAmount / 1000).toFixed(1)}K</p>
                  <p className="text-red-600">Total Due</p>
                </div>
              </div>
              <button className="w-full mt-4 py-2 text-green-600 font-semibold text-sm hover:bg-green-50 rounded transition flex items-center justify-center gap-1">
                View All <ChevronRight size={16} />
              </button>
            </div>

            {/* 4. PRICING CATALOG */}
            <div onClick={() => router.push('/pricing')} className="bg-white rounded-xl shadow-md hover:shadow-lg border border-slate-200 p-6 cursor-pointer transition-all hover:scale-105 hover:border-amber-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                  <DollarSign size={24} className="text-amber-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Pricing</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Products</span>
                  <span className="text-2xl font-bold text-amber-600">{stats.products.total}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-blue-50 p-2 rounded">
                    <p className="text-blue-700 font-semibold">{stats.products.categories}</p>
                    <p className="text-blue-600">Categories</p>
                  </div>
                  <div className="bg-slate-100 p-2 rounded">
                    <p className="text-slate-700 font-semibold">Catalog</p>
                    <p className="text-slate-600">Active</p>
                  </div>
                </div>
                <div className="bg-amber-50 p-2 rounded text-xs">
                  <p className="text-amber-700 font-semibold">All-time</p>
                  <p className="text-amber-600">Listed Products</p>
                </div>
              </div>
              <button className="w-full mt-4 py-2 text-amber-600 font-semibold text-sm hover:bg-amber-50 rounded transition flex items-center justify-center gap-1">
                View All <ChevronRight size={16} />
              </button>
            </div>

            {/* 5. RETAIL RECORDS */}
            <div onClick={() => router.push('/retail')} className="bg-white rounded-xl shadow-md hover:shadow-lg border border-slate-200 p-6 cursor-pointer transition-all hover:scale-105 hover:border-pink-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
                  <Package size={24} className="text-pink-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Retail</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Total Records</span>
                  <span className="text-2xl font-bold text-pink-600">{stats.retail.total}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-green-50 p-2 rounded">
                    <p className="text-green-700 font-semibold">{stats.retail.closed}</p>
                    <p className="text-green-600">Closed</p>
                  </div>
                  <div className="bg-blue-50 p-2 rounded">
                    <p className="text-blue-700 font-semibold">{stats.retail.open}</p>
                    <p className="text-blue-600">Open</p>
                  </div>
                </div>
                <div className="bg-pink-50 p-2 rounded text-xs">
                  <p className="text-pink-700 font-semibold">₹{(stats.retail.totalRevenue / 1000).toFixed(1)}K</p>
                  <p className="text-pink-600">Total Revenue</p>
                </div>
              </div>
              <button className="w-full mt-4 py-2 text-pink-600 font-semibold text-sm hover:bg-pink-50 rounded transition flex items-center justify-center gap-1">
                View All <ChevronRight size={16} />
              </button>
            </div>

            {/* 6. SERVICE CENTER */}
            <div onClick={() => router.push('/servicedevice')} className="bg-white rounded-xl shadow-md hover:shadow-lg border border-slate-200 p-6 cursor-pointer transition-all hover:scale-105 hover:border-red-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <Headphones size={24} className="text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Service</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Total Devices</span>
                  <span className="text-2xl font-bold text-red-600">{stats.services.total}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-yellow-50 p-2 rounded">
                    <p className="text-yellow-700 font-semibold">{stats.services.inRepair}</p>
                    <p className="text-yellow-600">In Repair</p>
                  </div>
                  <div className="bg-green-50 p-2 rounded">
                    <p className="text-green-700 font-semibold">{stats.services.readyForDelivery}</p>
                    <p className="text-green-600">Ready</p>
                  </div>
                </div>
                <div className="bg-blue-50 p-2 rounded text-xs">
                  <p className="text-blue-700 font-semibold">{stats.services.pendingDelivery}</p>
                  <p className="text-blue-600">Pending Delivery</p>
                </div>
              </div>
              <button className="w-full mt-4 py-2 text-red-600 font-semibold text-sm hover:bg-red-50 rounded transition flex items-center justify-center gap-1">
                View All <ChevronRight size={16} />
              </button>
            </div>

            {/* 7. AMC MANAGEMENT */}
            <div onClick={() => router.push('/amc')} className="bg-white rounded-xl shadow-md hover:shadow-lg border border-slate-200 p-6 cursor-pointer transition-all hover:scale-105 hover:border-orange-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Settings size={24} className="text-orange-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">AMC</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Active</span>
                  <span className="text-2xl font-bold text-orange-600">{stats.amc.active}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-red-50 p-2 rounded">
                    <p className="text-red-700 font-semibold">{stats.amc.expired}</p>
                    <p className="text-red-600">Expired</p>
                  </div>
                  <div className="bg-blue-50 p-2 rounded">
                    <p className="text-blue-700 font-semibold">{stats.amc.upcoming}</p>
                    <p className="text-blue-600">Upcoming</p>
                  </div>
                </div>
                <div className="bg-orange-50 p-2 rounded text-xs">
                  <p className="text-orange-700 font-semibold">All-time</p>
                  <p className="text-orange-600">Maintenance</p>
                </div>
              </div>
              <button className="w-full mt-4 py-2 text-orange-600 font-semibold text-sm hover:bg-orange-50 rounded transition flex items-center justify-center gap-1">
                View All <ChevronRight size={16} />
              </button>
            </div>

          </div>

          {/* QUICK SUMMARY */}
          <div className="bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 rounded-xl shadow-lg p-6 text-white">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <TrendingUp size={20} />
              Business Summary
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 text-sm">
              <div>
                <p className="opacity-80 text-xs mb-1">Total Leads</p>
                <p className="text-2xl font-bold">{stats.leads.total}</p>
              </div>
              <div>
                <p className="opacity-80 text-xs mb-1">Hot Leads</p>
                <p className="text-2xl font-bold text-red-300">{stats.leads.hotLeads}</p>
              </div>
              <div>
                <p className="opacity-80 text-xs mb-1">Due Amount</p>
                <p className="text-2xl font-bold text-yellow-300">₹{(stats.payments.totalDueAmount / 1000).toFixed(0)}K</p>
              </div>
              <div>
                <p className="opacity-80 text-xs mb-1">Active AMC</p>
                <p className="text-2xl font-bold text-orange-300">{stats.amc.active}</p>
              </div>
              <div>
                <p className="opacity-80 text-xs mb-1">Service Devices</p>
                <p className="text-2xl font-bold text-blue-300">{stats.services.total}</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
