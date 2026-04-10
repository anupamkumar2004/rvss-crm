"use client";

import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import * as XLSX from 'xlsx';
import { Plus, Edit2, Trash2, X, Filter, Search, Download, Upload, CheckCircle, AlertCircle, Info, RotateCcw, Trash, Eye, ChevronLeft, ChevronRight } from 'lucide-react';

// ============================================
// INTERFACES
// ============================================

interface Payment {
  id: number;
  user_id?: string;
  customer_name: string;
  phone: string;
  payment_date: string;
  type_of_work: string;
  amount: number;
  bill_no: string;
  status: 'Paid' | 'Partially Paid' | 'Pending';
  notes: string;
  last_updated: string;
  deleted: boolean;
  deleted_at: string | null;
  created_at?: string;
}

interface FormData {
  customer_name: string;
  phone: string;
  payment_date: string;
  type_of_work: string;
  amount: string;
  bill_no: string;
  status: 'Paid' | 'Partially Paid' | 'Pending';
  notes: string;
}

interface Filters {
  status: string;
  type_of_work: string;
  date_from: string;
  date_to: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function PaymentsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState('');
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayments, setSelectedPayments] = useState<number[]>([]);
  const [lastImportedIds, setLastImportedIds] = useState<number[]>([]);

  // PAGINATION
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  const [filters, setFilters] = useState<Filters>({
    status: '',
    type_of_work: '',
    date_from: '',
    date_to: ''
  });

  const [payments, setPayments] = useState<Payment[]>([]);
  const [trashedPayments, setTrashedPayments] = useState<Payment[]>([]);

  const [formData, setFormData] = useState<FormData>({
    customer_name: '',
    phone: '',
    payment_date: '',
    type_of_work: '',
    amount: '',
    bill_no: '',
    status: 'Pending',
    notes: ''
  });

  // Fix hydration
  useEffect(() => {
    setMounted(true);
    setFormData(prev => ({
      ...prev,
      payment_date: new Date().toISOString().split('T')[0]
    }));
  }, []);

  // ============================================
  // UTILITIES
  // ============================================

  const formatDateToDisplay = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(toast => toast.id !== id)), 4000);
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmAction({ message, onConfirm });
    setShowConfirmModal(true);
  };

  const handleConfirm = () => {
    if (confirmAction) confirmAction.onConfirm();
    setShowConfirmModal(false);
    setConfirmAction(null);
  };

  // ============================================
  // DATA FETCHING
  // ============================================

  useEffect(() => {
    if (mounted) {
      fetchPayments();
      autoCleanupOldDeleted();
    }
  }, [mounted]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: activeData, error: activeError } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .eq('deleted', false)
        .order('created_at', { ascending: false });

      if (activeError) throw activeError;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: trashedData, error: trashedError } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .eq('deleted', true)
        .gte('deleted_at', sevenDaysAgo.toISOString())
        .order('deleted_at', { ascending: false });

      if (trashedError) throw trashedError;

      setPayments(activeData || []);
      setTrashedPayments(trashedData || []);
    } catch (error) {
      console.error('Error:', error);
      showToast('Failed to fetch payments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const autoCleanupOldDeleted = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      await supabase
        .from('payments')
        .delete()
        .eq('user_id', user.id)
        .eq('deleted', true)
        .lt('deleted_at', sevenDaysAgo.toISOString());
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  };

  // ============================================
  // EXPORT / IMPORT
  // ============================================

  const handleExportExcel = () => {
    try {
      const dataToExport = payments.map((payment, index) => ({
        'S.No': index + 1,
        'Customer Name': payment.customer_name,
        'Phone': payment.phone || '',
        'Date': formatDateToDisplay(payment.payment_date),
        'Type of Work': payment.type_of_work,
        'Amount': payment.amount,
        'Bill No.': payment.bill_no || '',
        'Status': payment.status,
        'Notes': payment.notes || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Payments');
      worksheet['!cols'] = Array(9).fill({ wch: 15 });
      XLSX.writeFile(workbook, `Payments_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast(`Exported ${payments.length} records`, 'success');
    } catch (error) {
      showToast('Export failed', 'error');
    }
  };

  const handleExportCSV = () => {
    try {
      const dataToExport = payments.map((payment, index) => ({
        'S.No': index + 1,
        'Customer': payment.customer_name,
        'Phone': payment.phone || '',
        'Date': formatDateToDisplay(payment.payment_date),
        'Work': payment.type_of_work,
        'Amount': payment.amount,
        'Bill': payment.bill_no || '',
        'Status': payment.status,
        'Notes': payment.notes || ''
      }));
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Payments_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      showToast(`Exported ${payments.length} records`, 'success');
    } catch (error) {
      showToast('Export failed', 'error');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const binaryStr = event.target?.result;
          const workbook = XLSX.read(binaryStr, { type: 'binary' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const data: any[] = XLSX.utils.sheet_to_json(worksheet);

          if (!data || data.length === 0) {
            showToast('No data found', 'warning');
            e.target.value = '';
            return;
          }

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            showToast('Login required', 'error');
            e.target.value = '';
            return;
          }

          const paymentsToImport = data.map((row: any) => {
            const normalized: any = {};
            Object.keys(row).forEach(key => {
              normalized[key.toLowerCase().trim().replace(/\s+/g, '_')] = row[key];
            });

            let status: 'Paid' | 'Partially Paid' | 'Pending' = 'Pending';
            const statusStr = normalized['status']?.toLowerCase() || '';
            if (statusStr === 'paid') status = 'Paid';
            else if (statusStr === 'partially paid' || statusStr === 'partial') status = 'Partially Paid';

            return {
              user_id: user.id,
              customer_name: normalized['customer_name'] || normalized['customer'] || '',
              phone: normalized['phone'] ? String(normalized['phone']) : '',
              payment_date: normalized['payment_date'] || normalized['date'] || new Date().toISOString().split('T')[0],
              type_of_work: normalized['type_of_work'] || normalized['work'] || '',
              amount: parseFloat(normalized['amount']) || 0,
              bill_no: normalized['bill_no'] || normalized['bill'] || '',
              status: status,
              notes: normalized['notes'] || '',
              last_updated: new Date().toISOString().split('T')[0],
              deleted: false,
              deleted_at: null
            };
          }).filter(p => p.customer_name && p.type_of_work && p.amount > 0);

          if (paymentsToImport.length === 0) {
            showToast('No valid records found', 'warning');
            e.target.value = '';
            return;
          }

          const { data: insertedData, error } = await supabase
            .from('payments')
            .insert(paymentsToImport)
            .select('id');

          if (error) throw error;

          const importedIds = insertedData?.map(item => item.id) || [];
          setLastImportedIds(importedIds);
          await fetchPayments();
          showToast(`Imported ${paymentsToImport.length} records!`, 'success');
          e.target.value = '';
        } catch (innerError: any) {
          showToast(`Import failed: ${innerError.message}`, 'error');
          e.target.value = '';
        }
      };
      reader.readAsBinaryString(file);
    } catch (error: any) {
      showToast(`Error: ${error.message}`, 'error');
      e.target.value = '';
    }
  };

  const handleUndoImport = async () => {
    if (lastImportedIds.length === 0) {
      showToast('No import to undo', 'warning');
      return;
    }
    showConfirm(`Delete ${lastImportedIds.length} imported records?`, async () => {
      try {
        const { error } = await supabase.from('payments').delete().in('id', lastImportedIds);
        if (error) throw error;
        await fetchPayments();
        showToast(`Deleted ${lastImportedIds.length} records`, 'success');
        setLastImportedIds([]);
      } catch (error) {
        showToast('Undo failed', 'error');
      }
    });
  };

  // ============================================
  // CRUD
  // ============================================

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast('Login required', 'error');
        return;
      }

      if (!formData.customer_name || !formData.payment_date || !formData.type_of_work || !formData.amount) {
        showToast('Please fill all required fields', 'error');
        return;
      }

      const paymentData = {
        user_id: user.id,
        customer_name: formData.customer_name.trim(),
        phone: formData.phone?.trim() || null,
        payment_date: formData.payment_date,
        type_of_work: formData.type_of_work.trim(),
        amount: parseFloat(formData.amount) || 0,
        bill_no: formData.bill_no?.trim() || null,
        status: formData.status,
        notes: formData.notes?.trim() || null,
        last_updated: new Date().toISOString().split('T')[0],
        deleted: false,
        deleted_at: null
      };

      if (editingPayment) {
        const { error } = await supabase.from('payments').update(paymentData).eq('id', editingPayment.id);
        if (error) throw error;
        showToast('Payment updated!', 'success');
      } else {
        const { error } = await supabase.from('payments').insert([paymentData]);
        if (error) throw error;
        showToast('Payment added!', 'success');
      }

      await fetchPayments();
      setShowModal(false);
      setEditingPayment(null);
      setFormData({
        customer_name: '',
        phone: '',
        payment_date: new Date().toISOString().split('T')[0],
        type_of_work: '',
        amount: '',
        bill_no: '',
        status: 'Pending',
        notes: ''
      });
    } catch (error: any) {
      showToast(`Save failed: ${error?.message || 'Unknown error'}`, 'error');
    }
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setFormData({
      customer_name: payment.customer_name,
      phone: payment.phone || '',
      payment_date: payment.payment_date,
      type_of_work: payment.type_of_work,
      amount: payment.amount.toString(),
      bill_no: payment.bill_no || '',
      status: payment.status,
      notes: payment.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    showConfirm('Move to trash? (auto-delete after 7 days)', async () => {
      try {
        const { error } = await supabase.from('payments').update({ deleted: true, deleted_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
        await fetchPayments();
        showToast('Moved to trash', 'success');
      } catch (error) {
        showToast('Delete failed', 'error');
      }
    });
  };

  const handleRestore = async (id: number) => {
    showConfirm('Restore record?', async () => {
      try {
        const { error } = await supabase.from('payments').update({ deleted: false, deleted_at: null }).eq('id', id);
        if (error) throw error;
        await fetchPayments();
        showToast('Restored!', 'success');
      } catch (error) {
        showToast('Restore failed', 'error');
      }
    });
  };

  // ============================================
  // BULK & SELECTION
  // ============================================

  const handleBulkDelete = async () => {
    if (selectedPayments.length === 0) {
      showToast('No records selected', 'warning');
      return;
    }
    showConfirm(`Move ${selectedPayments.length} records to trash?`, async () => {
      try {
        const { error } = await supabase
          .from('payments')
          .update({ deleted: true, deleted_at: new Date().toISOString() })
          .in('id', selectedPayments);
        if (error) throw error;
        await fetchPayments();
        setSelectedPayments([]);
        showToast(`${selectedPayments.length} moved to trash`, 'success');
      } catch (error) {
        showToast('Delete failed', 'error');
      }
    });
  };

  const handleSelectAll = () => {
    if (currentPayments.every(p => selectedPayments.includes(p.id))) {
      setSelectedPayments([]);
    } else {
      setSelectedPayments(currentPayments.map(p => p.id));
    }
  };

  const togglePaymentSelection = (id: number) => {
    setSelectedPayments(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]);
  };

  // ============================================
  // FILTERS
  // ============================================

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({ status: '', type_of_work: '', date_from: '', date_to: '' });
    showToast('Filters cleared', 'info');
  };

  const showNotes = (notes: string) => {
    setSelectedNotes(notes);
    setShowNotesModal(true);
  };

  // ============================================
  // STYLES
  // ============================================

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Paid': 'bg-green-50 text-green-700 border border-green-200',
      'Partially Paid': 'bg-orange-50 text-orange-700 border border-orange-200',
      'Pending': 'bg-yellow-50 text-yellow-700 border border-yellow-200'
    };
    return colors[status] || 'bg-gray-50 text-gray-700 border border-gray-200';
  };

  // ============================================
  // FILTERING & PAGINATION
  // ============================================

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (payment.phone && payment.phone.includes(searchTerm)) ||
      payment.type_of_work.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (payment.bill_no && payment.bill_no.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (filters.status && payment.status !== filters.status) return false;
    if (filters.type_of_work && payment.type_of_work !== filters.type_of_work) return false;
    if (filters.date_from && payment.payment_date < filters.date_from) return false;
    if (filters.date_to && payment.payment_date > filters.date_to) return false;
    return true;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentPayments = filteredPayments.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters.status, filters.type_of_work, filters.date_from, filters.date_to]);

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const pageNumbers = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-white border-t border-gray-200 gap-3">
        <div className="text-sm text-gray-600">
          Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredPayments.length)} of {filteredPayments.length} results
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-3 py-1.5 text-xs border rounded disabled:opacity-50">First</button>
          <button onClick={() => setCurrentPage(prev => Math.max(1, prev-1))} disabled={currentPage === 1} className="px-2 py-1.5 text-xs border rounded flex items-center gap-1"><ChevronLeft size={14}/>Prev</button>
          {startPage > 1 && <><button onClick={() => setCurrentPage(1)} className="px-3 py-1.5 text-xs border rounded">1</button>{startPage > 2 && <span className="px-2">...</span>}</>}
          {pageNumbers.map(n => (
            <button key={n} onClick={() => setCurrentPage(n)} className={`px-3 py-1.5 text-xs border rounded ${currentPage === n ? 'bg-green-600 text-white' : 'bg-white'}`}>{n}</button>
          ))}
          {endPage < totalPages && <>{endPage < totalPages-1 && <span className="px-2">...</span>}<button onClick={() => setCurrentPage(totalPages)} className="px-3 py-1.5 text-xs border rounded">{totalPages}</button></>}
          <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev+1))} disabled={currentPage === totalPages} className="px-2 py-1.5 text-xs border rounded flex items-center gap-1">Next<ChevronRight size={14}/></button>
          <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="px-3 py-1.5 text-xs border rounded">Last</button>
        </div>
      </div>
    );
  };

  // Stats
  const totalAmount = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const paidAmount = filteredPayments.filter(p => p.status === 'Paid').reduce((sum, p) => sum + p.amount, 0);
  const pendingAmount = filteredPayments.filter(p => p.status === 'Pending').reduce((sum, p) => sum + p.amount, 0);
  const partialAmount = filteredPayments.filter(p => p.status === 'Partially Paid').reduce((sum, p) => sum + p.amount, 0);

  const uniqueWorkTypes = [...new Set(payments.map(p => p.type_of_work))];

  if (!mounted) return null;
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div><p className="mt-4 text-gray-600">Loading payments...</p></div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-3 py-2.5 flex items-center justify-between sticky top-0 z-30">
          <h2 className="text-base lg:text-xl font-bold text-gray-800 truncate">💳 Payment Records</h2>
          <button onClick={() => { setShowModal(true); setEditingPayment(null); setFormData({ customer_name: '', phone: '', payment_date: new Date().toISOString().split('T')[0], type_of_work: '', amount: '', bill_no: '', status: 'Pending', notes: '' }); }} className="bg-gradient-to-r from-green-600 to-green-600 hover:from-green-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm"><Plus size={16}/>Add Payment</button>
        </header>

        <main className="flex-1 overflow-auto p-3 lg:p-4">
          {!showTrash && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-3 text-white"><p className="text-xs opacity-90">Paid</p><p className="text-2xl font-bold">₹{paidAmount.toLocaleString()}</p></div>
              <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg p-3 text-white"><p className="text-xs opacity-90">Pending</p><p className="text-2xl font-bold">₹{pendingAmount.toLocaleString()}</p></div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-3 text-white"><p className="text-xs opacity-90">Partially Paid</p><p className="text-2xl font-bold">₹{partialAmount.toLocaleString()}</p></div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-3 text-white"><p className="text-xs opacity-90">Total</p><p className="text-2xl font-bold">₹{totalAmount.toLocaleString()}</p></div>
            </div>
          )}

          {/* Sticky Filter + Action Bar - REDESIGNED */}
          {!showTrash && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2.5 mb-4 sticky top-0 z-40 bg-white/90 backdrop-blur-sm">
              
              {/* Row 1: Search + Action Buttons */}
              <div className="flex flex-col lg:flex-row gap-2 mb-2">
                
                {/* Search */}
                <div className="flex-1 min-w-0">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-500 focus:border-green-500 text-gray-800"
                    />
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-1.5 flex-wrap flex-shrink-0">
                  <button
                    onClick={handleExportExcel}
                    className="px-2.5 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs font-medium flex items-center gap-1"
                  >
                    <Download size={14} /> Excel
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="px-2.5 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs font-medium flex items-center gap-1"
                  >
                    <Download size={14} /> CSV
                  </button>
                  <label className="px-2.5 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded text-xs font-medium flex items-center gap-1 cursor-pointer">
                    <Upload size={14} /> Import
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
                  </label>
                  {lastImportedIds.length > 0 && (
                    <button onClick={handleUndoImport} className="px-2.5 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded text-xs font-medium flex items-center gap-1">
                      <RotateCcw size={14} /> Undo
                    </button>
                  )}
                  <button
                    onClick={() => setShowTrash(true)}
                    className="px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium flex items-center gap-1"
                  >
                    <Trash size={14} /> Trash ({trashedPayments.length})
                  </button>
                </div>
              </div>

              {/* Row 2: Filters */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200">
                <select
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                  className="flex-1 min-w-[120px] px-2 py-1.5 border border-gray-300 rounded text-xs text-gray-900 bg-white focus:ring-1 focus:ring-green-500"
                >
                  <option value="">All Status</option>
                  <option value="Paid">Paid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Pending">Pending</option>
                </select>

                <select
                  name="type_of_work"
                  value={filters.type_of_work}
                  onChange={handleFilterChange}
                  className="flex-1 min-w-[120px] px-2 py-1.5 border border-gray-300 rounded text-xs text-gray-900 bg-white focus:ring-1 focus:ring-green-500"
                >
                  <option value="">All Type</option>
                  {uniqueWorkTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                <input
                  type="date"
                  name="date_from"
                  value={filters.date_from}
                  onChange={handleFilterChange}
                  className="flex-1 min-w-[120px] px-2 py-1.5 border border-gray-300 rounded text-xs text-gray-900 bg-white focus:ring-1 focus:ring-green-500"
                  placeholder="From Date"
                />

                <input
                  type="date"
                  name="date_to"
                  value={filters.date_to}
                  onChange={handleFilterChange}
                 className="flex-1 min-w-[120px] px-2 py-1.5 border border-gray-300 rounded text-xs text-gray-900 bg-white focus:ring-1 focus:ring-green-500"
                  placeholder="To Date"
                />

                <button
                  onClick={clearFilters}
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-medium whitespace-nowrap"
                >
                  Clear Filters
                </button>
              </div>

              {/* Bulk Actions (only when items selected) */}
              {selectedPayments.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-xs font-medium">{selectedPayments.length} selected</span>
                  <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs flex items-center gap-1">
                    <Trash size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Table Section */}
         {!showTrash ? (
  <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-gray-800">
        
        {/* HEADER */}
        <thead className="bg-gradient-to-r from-green-600 to-green-600 text-white border-b border-gray-300">
          <tr>
            <th className="p-2">
              <input
                type="checkbox"
                checked={selectedPayments.length === currentPayments.length && currentPayments.length > 0}
                onChange={handleSelectAll}
                className="w-3 h-3"
              />
            </th>
            <th className="p-2 text-left">S.No</th>
            <th className="p-2 text-left">Customer</th>
            <th className="p-2 text-left">Phone</th>
            <th className="p-2 text-left">Date</th>
            <th className="p-2 text-left">Type of Work</th>
            <th className="p-2 text-left">Amount</th>
            <th className="p-2 text-left">Bill No.</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Notes</th>
            <th className="p-2 text-center">Actions</th>
          </tr>
        </thead>

        {/* BODY */}
        <tbody>
          {currentPayments.length === 0 ? (
            <tr>
              <td colSpan={11} className="p-8 text-center text-gray-500">
                No records found
              </td>
            </tr>
          ) : (
            currentPayments.map((p, idx) => (
              <tr
                key={p.id}
                className="border-b border-gray-200 bg-white hover:bg-gray-50 transition"
              >
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selectedPayments.includes(p.id)}
                    onChange={() => togglePaymentSelection(p.id)}
                    className="w-3 h-3"
                  />
                </td>

                <td className="p-2 text-gray-800">
                  {indexOfFirstItem + idx + 1}
                </td>

                <td className="p-2 font-semibold text-gray-900">
                  {p.customer_name}
                </td>

                <td className="p-2 text-gray-800">
                  {p.phone || '-'}
                </td>

                <td className="p-2 text-gray-800">
                  {formatDateToDisplay(p.payment_date)}
                </td>

                <td className="p-2">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                    {p.type_of_work}
                  </span>
                </td>

                <td className="p-2 font-semibold text-gray-900">
                  ₹{p.amount.toLocaleString()}
                </td>

                <td className="p-2 text-gray-800">
                  {p.bill_no || '-'}
                </td>

                <td className="p-2">
                  <span className={`px-2 py-0.5 rounded ${getStatusColor(p.status)}`}>
                    {p.status}
                  </span>
                </td>

                <td className="p-2">
                  {p.notes ? (
                    <button
                      onClick={() => showNotes(p.notes)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Eye size={14} />
                    </button>
                  ) : (
                    '-'
                  )}
                </td>

                <td className="p-2 text-center">
                  <div className="flex gap-1 justify-center">
                    <button
                      onClick={() => handleEdit(p)}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1 text-orange-600 hover:bg-orange-50 rounded"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>

    {renderPagination()}
  </div>
) : (
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">🗑️ Trash Bin</h3><button onClick={() => setShowTrash(false)} className="px-3 py-1.5 bg-gray-200 rounded text-sm">Back</button></div>
              {trashedPayments.length === 0 ? <div className="text-center py-12"><Trash size={48} className="mx-auto text-gray-300"/><p className="text-gray-500">Empty</p></div> : (
                <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-gray-800 text-white"><tr><th className="p-2 text-left">Customer</th><th className="p-2 text-left">Amount</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Deleted</th><th className="p-2 text-left">Actions</th></tr></thead><tbody>{trashedPayments.map(p => (<tr key={p.id} className="border-b hover:bg-gray-50"><td className="p-2 text-gray-900">{p.customer_name}</td><td className="p-2 text-gray-900">₹{p.amount.toLocaleString()}</td><td className="p-2"><span className={`px-2 py-0.5 rounded ${getStatusColor(p.status)}`}>{p.status}</span></td><td className="p-2 text-gray-700">{p.deleted_at ? formatDateToDisplay(p.deleted_at.split('T')[0]) : '-'}</td><td className="p-2"><button onClick={() => handleRestore(p.id)} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">Restore</button></td></tr>))}</tbody></table></div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-[100] space-y-2">{toasts.map(t => (<div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${t.type==='success'?'bg-green-500':t.type==='error'?'bg-red-500':t.type==='warning'?'bg-yellow-500':'bg-blue-500'} text-white`}>{t.type==='success'&&<CheckCircle size={20}/>}{t.type==='error'&&<AlertCircle size={20}/>}{t.type==='warning'&&<AlertCircle size={20}/>}{t.type==='info'&&<Info size={20}/>}<p className="text-sm">{t.message}</p><button onClick={()=>setToasts(prev=>prev.filter(t2=>t2.id!==t.id))}><X size={16}/></button></div>))}</div>

      {/* Confirm Modal */}
      {showConfirmModal && (<><div className="fixed inset-0 bg-black/30 z-[90]" onClick={()=>setShowConfirmModal(false)}/><div className="fixed inset-0 flex items-center justify-center p-4 z-[90]"><div className="bg-white rounded-xl max-w-md w-full p-6"><div className="flex items-center gap-3 mb-4"><div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center"><AlertCircle className="text-green-600" size={24}/></div><h3 className="text-lg font-bold">Confirm Action</h3></div><p className="text-gray-600 mb-6">{confirmAction?.message}</p><div className="flex gap-3"><button onClick={handleConfirm} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium">Confirm</button><button onClick={()=>setShowConfirmModal(false)} className="flex-1 bg-gray-200 py-2 rounded-lg font-medium">Cancel</button></div></div></div></>)}

      {/* Notes Modal */}
      {showNotesModal && (<><div className="fixed inset-0 bg-black/30 z-[90]" onClick={()=>setShowNotesModal(false)}/><div className="fixed inset-0 flex items-center justify-center p-4 z-[90]"><div className="bg-white rounded-xl max-w-lg w-full p-6"><div className="flex justify-between mb-4"><h3 className="text-lg font-bold">📝 Notes</h3><button onClick={()=>setShowNotesModal(false)}><X size={20}/></button></div><div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto"><p className="text-gray-700 whitespace-pre-wrap text-sm">{selectedNotes || 'No notes'}</p></div></div></div></>)}

      
{/* Add/Edit Modal */}
{showModal && (
  <>
    <div
      className="fixed inset-0 bg-black/30 z-[90]"
      onClick={() => {
        setShowModal(false);
        setEditingPayment(null);
      }}
    />

    <div className="fixed inset-0 flex items-center justify-center p-4 z-[90] overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">

        {/* HEADER */}
        <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-600 text-white p-4 rounded-t-xl flex justify-between">
          <h3 className="text-xl font-bold">
            {editingPayment ? '✏️ Edit Payment' : '➕ Add Payment'}
          </h3>
          <button onClick={() => { setShowModal(false); setEditingPayment(null); }}>
            <X size={24} />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-6">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Customer Name */}
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Customer Name *
              </label>
              <input
                type="text"
                name="customer_name"
                value={formData.customer_name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500 bg-white focus:ring-2 focus:ring-green-500"
                required
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Phone (Optional)
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500 bg-white focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Date *
              </label>
              <input
                type="date"
                name="payment_date"
                value={formData.payment_date}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-green-500"
                required
              />
            </div>

            {/* Type of Work */}
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Type of Work *
              </label>
              <input
                type="text"
                name="type_of_work"
                value={formData.type_of_work}
                onChange={handleInputChange}
                placeholder="e.g., Installation, Lock installation, CCTV..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500 bg-white focus:ring-2 focus:ring-green-500"
                required
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Amount (₹) *
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleInputChange}
                placeholder="0"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500 bg-white focus:ring-2 focus:ring-green-500"
                required
              />
            </div>

            {/* Bill No */}
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Bill No. (Optional)
              </label>
              <input
                type="text"
                name="bill_no"
                value={formData.bill_no}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Status *
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-green-500"
              >
                <option value="Paid">Paid</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Notes (for partial payments, write split amounts)
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                placeholder="e.g., 2000 paid cash, 6000 remaining..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500 bg-white focus:ring-2 focus:ring-green-500"
              />
            </div>

          </div>

          {/* BUTTONS */}
          <div className="flex gap-3 mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={() => { setShowModal(false); setEditingPayment(null); }}
              className="flex-1 px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium shadow-md"
            >
              {editingPayment ? 'Update' : 'Add'}
            </button>
          </div>

        </form>
      </div>
    </div>
  </>
)}
    </div>
  );
}