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
  invoice_number: string;
  payment_date: string;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  payment_mode: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Card';
  transaction_id: string;
  category: 'Installation' | 'AMC' | 'Retail' | 'Service';
  related_to: string;
  notes: string;
  status: 'Received' | 'Pending' | 'Partial';
  last_updated: string;
  deleted: boolean;
  deleted_at: string | null;
  created_at?: string;
}

interface FormData {
  customer_name: string;
  phone: string;
  invoice_number: string;
  payment_date: string;
  total_amount: string;
  paid_amount: string;
  payment_mode: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Card';
  transaction_id: string;
  category: 'Installation' | 'AMC' | 'Retail' | 'Service';
  related_to: string;
  notes: string;
  status: 'Received' | 'Pending' | 'Partial';
}

interface Filters {
  status: string;
  category: string;
  payment_mode: string;
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
  const [showFilters, setShowFilters] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayments, setSelectedPayments] = useState<number[]>([]);
  const [lastImportedIds, setLastImportedIds] = useState<number[]>([]);

  // PAGINATION STATES
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20); // Show 20 items per page

  const [filters, setFilters] = useState<Filters>({
    status: '',
    category: '',
    payment_mode: '',
    date_from: '',
    date_to: ''
  });

  const [payments, setPayments] = useState<Payment[]>([]);
  const [trashedPayments, setTrashedPayments] = useState<Payment[]>([]);

  const [formData, setFormData] = useState<FormData>({
    customer_name: '',
    phone: '',
    invoice_number: '',
    payment_date: '',
    total_amount: '',
    paid_amount: '',
    payment_mode: 'Cash',
    transaction_id: '',
    category: 'Installation',
    related_to: '',
    notes: '',
    status: 'Received'
  });

  // Fix hydration issue
  useEffect(() => {
    setMounted(true);
    setFormData(prev => ({
      ...prev,
      payment_date: new Date().toISOString().split('T')[0]
    }));
  }, []);

  // ============================================
  // UTILITY FUNCTIONS
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

      // Auto-migrate old records without new columns
      const migratedActive = (activeData || []).map(payment => ({
        ...payment,
        total_amount: payment.total_amount ?? payment.amount ?? 0,
        paid_amount: payment.paid_amount ?? (payment.status === 'Received' ? (payment.amount ?? 0) : 0),
        due_amount: payment.due_amount ?? (payment.status === 'Received' ? 0 : (payment.amount ?? 0))
      }));

      const migratedTrashed = (trashedData || []).map(payment => ({
        ...payment,
        total_amount: payment.total_amount ?? payment.amount ?? 0,
        paid_amount: payment.paid_amount ?? (payment.status === 'Received' ? (payment.amount ?? 0) : 0),
        due_amount: payment.due_amount ?? (payment.status === 'Received' ? 0 : (payment.amount ?? 0))
      }));

      setPayments(migratedActive);
      setTrashedPayments(migratedTrashed);
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
  // EXPORT FUNCTIONS
  // ============================================

  const handleExportExcel = () => {
    try {
      const dataToExport = payments.map((payment, index) => ({
        'S.No': index + 1,
        'Customer Name': payment.customer_name,
        'Phone': payment.phone,
        'Invoice Number': payment.invoice_number || '',
        'Payment Date': formatDateToDisplay(payment.payment_date),
        'Total Amount': payment.total_amount || 0,
        'Paid Amount': payment.paid_amount || 0,
        'Due Amount': payment.due_amount || 0,
        'Payment Mode': payment.payment_mode,
        'Transaction ID': payment.transaction_id || '',
        'Category': payment.category,
        'Related To': payment.related_to || '',
        'Status': payment.status,
        'Notes': payment.notes || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Payments');
      worksheet['!cols'] = Array(13).fill({ wch: 15 });
      XLSX.writeFile(workbook, `Payments_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast(`Exported ${payments.length} payment records`, 'success');
    } catch (error) {
      showToast('Export failed', 'error');
    }
  };

  const handleExportCSV = () => {
    try {
      const dataToExport = payments.map((payment, index) => ({
        'S.No': index + 1,
        'Customer': payment.customer_name,
        'Phone': payment.phone,
        'Invoice': payment.invoice_number || '',
        'Date': formatDateToDisplay(payment.payment_date),
        'Total': payment.total_amount || 0,
        'Paid': payment.paid_amount || 0,
        'Due': payment.due_amount || 0,
        'Mode': payment.payment_mode,
        'Category': payment.category,
        'Status': payment.status
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

  // ============================================
  // IMPORT FUNCTIONS
  // ============================================

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

            const totalAmount = parseFloat(normalized['total_amount'] || normalized['total'] || '0');
            const paidAmount = parseFloat(normalized['paid_amount'] || normalized['paid'] || '0');
            const dueAmount = totalAmount - paidAmount;

            let status: 'Received' | 'Pending' | 'Partial' = 'Received';
            if (paidAmount === 0) status = 'Pending';
            else if (paidAmount < totalAmount) status = 'Partial';

            return {
              user_id: user.id,
              customer_name: normalized['customer_name'] || normalized['customer'] || '',
              phone: String(normalized['phone'] || ''),
              invoice_number: normalized['invoice_number'] || normalized['invoice'] || '',
              payment_date: normalized['payment_date'] || normalized['date'] || new Date().toISOString().split('T')[0],
              total_amount: totalAmount,
              paid_amount: paidAmount,
              due_amount: dueAmount,
              payment_mode: ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'].includes(normalized['payment_mode'] || normalized['mode'])
                ? (normalized['payment_mode'] || normalized['mode'])
                : 'Cash',
              transaction_id: normalized['transaction_id'] || '',
              category: ['Installation', 'AMC', 'Retail', 'Service'].includes(normalized['category'])
                ? normalized['category']
                : 'Installation',
              related_to: normalized['related_to'] || '',
              notes: normalized['notes'] || '',
              status: status,
              last_updated: new Date().toISOString().split('T')[0],
              deleted: false,
              deleted_at: null
            };
          }).filter(payment => payment.customer_name && payment.phone);

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
  // CRUD OPERATIONS
  // ============================================

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };

      // Auto-calculate due amount and status
      if (name === 'total_amount' || name === 'paid_amount') {
        const total = parseFloat(name === 'total_amount' ? value : updated.total_amount) || 0;
        const paid = parseFloat(name === 'paid_amount' ? value : updated.paid_amount) || 0;

        if (paid === 0) {
          updated.status = 'Pending';
        } else if (paid < total) {
          updated.status = 'Partial';
        } else {
          updated.status = 'Received';
        }
      }

      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast('Login required', 'error');
        return;
      }

      if (!formData.customer_name || !formData.phone || !formData.payment_date) {
        showToast('Please fill all required fields', 'error');
        return;
      }

      const totalAmount = parseFloat(formData.total_amount) || 0;
      const paidAmount = parseFloat(formData.paid_amount) || 0;
      const dueAmount = totalAmount - paidAmount;

      const paymentData = {
        user_id: user.id,
        customer_name: formData.customer_name.trim(),
        phone: formData.phone.trim(),
        invoice_number: formData.invoice_number?.trim() || null,
        payment_date: formData.payment_date,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        due_amount: dueAmount,
        payment_mode: formData.payment_mode,
        transaction_id: formData.transaction_id?.trim() || null,
        category: formData.category,
        related_to: formData.related_to?.trim() || null,
        notes: formData.notes?.trim() || null,
        status: formData.status,
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
        invoice_number: '',
        payment_date: new Date().toISOString().split('T')[0],
        total_amount: '',
        paid_amount: '',
        payment_mode: 'Cash',
        transaction_id: '',
        category: 'Installation',
        related_to: '',
        notes: '',
        status: 'Received'
      });
    } catch (error: any) {
      showToast(`Save failed: ${error?.message || 'Unknown error'}`, 'error');
    }
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setFormData({
      customer_name: payment.customer_name,
      phone: payment.phone,
      invoice_number: payment.invoice_number || '',
      payment_date: payment.payment_date,
      total_amount: (payment.total_amount || 0).toString(),
      paid_amount: (payment.paid_amount || 0).toString(),
      payment_mode: payment.payment_mode,
      transaction_id: payment.transaction_id,
      category: payment.category,
      related_to: payment.related_to,
      notes: payment.notes,
      status: payment.status
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    showConfirm('Move to trash?', async () => {
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
  // BULK OPERATIONS
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
    if (selectedPayments.length === currentPayments.length) {
      setSelectedPayments([]);
    } else {
      setSelectedPayments(currentPayments.map(payment => payment.id));
    }
  };

  const togglePaymentSelection = (id: number) => {
    setSelectedPayments(prev => prev.includes(id) ? prev.filter(paymentId => paymentId !== id) : [...prev, id]);
  };

  // ============================================
  // FILTER FUNCTIONS
  // ============================================

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({ status: '', category: '', payment_mode: '', date_from: '', date_to: '' });
    showToast('Filters cleared', 'info');
  };

  const showNotes = (notes: string) => {
    setSelectedNotes(notes);
    setShowNotesModal(true);
  };

  // ============================================
  // STYLING FUNCTIONS
  // ============================================

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Received': 'bg-green-50 text-green-700 border border-green-200',
      'Pending': 'bg-yellow-50 text-yellow-700 border border-yellow-200',
      'Partial': 'bg-orange-50 text-orange-700 border border-orange-200'
    };
    return colors[status] || 'bg-gray-50 text-gray-700 border border-gray-200';
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Installation': 'bg-blue-50 text-blue-700 border border-blue-200',
      'AMC': 'bg-purple-50 text-purple-700 border border-purple-200',
      'Retail': 'bg-pink-50 text-pink-700 border border-pink-200',
      'Service': 'bg-orange-50 text-orange-700 border border-orange-200'
    };
    return colors[category] || 'bg-gray-50 text-gray-700 border border-gray-200';
  };

  // ============================================
  // FILTERING AND CALCULATIONS
  // ============================================

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.phone.includes(searchTerm) ||
      payment.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.related_to?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (filters.status && payment.status !== filters.status) return false;
    if (filters.category && payment.category !== filters.category) return false;
    if (filters.payment_mode && payment.payment_mode !== filters.payment_mode) return false;
    if (filters.date_from && payment.payment_date < filters.date_from) return false;
    if (filters.date_to && payment.payment_date > filters.date_to) return false;
    return true;
  });

  // ============================================
  // PAGINATION LOGIC
  // ============================================

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentPayments = filteredPayments.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters.status, filters.category, filters.payment_mode, filters.date_from, filters.date_to]);

  // Pagination component
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pageNumbers = [];
    const maxVisiblePages = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-white border-t border-gray-200 gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>
            Showing <span className="font-semibold">{indexOfFirstItem + 1}</span> to{' '}
            <span className="font-semibold">{Math.min(indexOfLastItem, filteredPayments.length)}</span> of{' '}
            <span className="font-semibold">{filteredPayments.length}</span> results
          </span>
        </div>

        <div className="flex items-center gap-1 flex-wrap justify-center">
          {/* First Page */}
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            First
          </button>

          {/* Previous Page */}
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-2 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            <ChevronLeft size={14} />
            Prev
          </button>

          {/* Page Numbers */}
          {startPage > 1 && (
            <>
              <button
                onClick={() => setCurrentPage(1)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                1
              </button>
              {startPage > 2 && <span className="px-2 text-gray-500">...</span>}
            </>
          )}

          {pageNumbers.map(number => (
            <button
              key={number}
              onClick={() => setCurrentPage(number)}
              className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${currentPage === number
                ? 'bg-green-600 text-white border-green-600'
                : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
                }`}
            >
              {number}
            </button>
          ))}

          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <span className="px-2 text-gray-500">...</span>}
              <button
                onClick={() => setCurrentPage(totalPages)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                {totalPages}
              </button>
            </>
          )}

          {/* Next Page */}
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-2 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            Next
            <ChevronRight size={14} />
          </button>

          {/* Last Page */}
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Last
          </button>
        </div>
      </div>
    );
  };

  const totalReceived = payments.filter(p => p.status === 'Received').reduce((sum, p) => sum + (p.paid_amount || 0), 0);
  const totalPending = payments.filter(p => p.status === 'Pending').reduce((sum, p) => sum + (p.due_amount || 0), 0);
  const totalPartial = payments.filter(p => p.status === 'Partial').reduce((sum, p) => sum + (p.due_amount || 0), 0);
  const totalAmount = payments.reduce((sum, p) => sum + (p.total_amount || 0), 0);

  const uniqueCategories = [...new Set(payments.map(p => p.category))];
  const uniquePaymentModes = [...new Set(payments.map(p => p.payment_mode))];

  if (!mounted) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading payments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h2 className="text-base lg:text-xl font-bold text-gray-800 truncate">
              💳 Payment Records
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => {
                setShowModal(true);
                setEditingPayment(null);
                setFormData({
                  customer_name: '',
                  phone: '',
                  invoice_number: '',
                  payment_date: new Date().toISOString().split('T')[0],
                  total_amount: '',
                  paid_amount: '',
                  payment_mode: 'Cash',
                  transaction_id: '',
                  category: 'Installation',
                  related_to: '',
                  notes: '',
                  status: 'Received'
                });
              }}
              className="bg-gradient-to-r from-green-600 to-green-600 hover:from-green-700 hover:to-green-700 text-white px-3 py-1.5 rounded-lg font-medium shadow-md transition-all flex items-center gap-1.5 text-sm"
            >
              <Plus size={16} />
              <span>Add Payment</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-3 lg:p-4">

          {/* Stats Cards */}
          {!showTrash && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-3 shadow-md text-white">
                <p className="text-xs opacity-90 font-medium mb-1">Received</p>
                <p className="text-2xl font-bold">₹{(totalReceived / 100000).toFixed(2)}L</p>
                <p className="text-xs opacity-75 mt-1">{payments.filter(p => p.status === 'Received').length} payments</p>
              </div>
              <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg p-3 shadow-md text-white">
                <p className="text-xs opacity-90 font-medium mb-1">Pending</p>
                <p className="text-2xl font-bold">₹{(totalPending / 100000).toFixed(2)}L</p>
                <p className="text-xs opacity-75 mt-1">{payments.filter(p => p.status === 'Pending').length} payments</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-3 shadow-md text-white">
                <p className="text-xs opacity-90 font-medium mb-1">Partial</p>
                <p className="text-2xl font-bold">₹{(totalPartial / 100000).toFixed(2)}L</p>
                <p className="text-xs opacity-75 mt-1">{payments.filter(p => p.status === 'Partial').length} due</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-3 shadow-md text-white">
                <p className="text-xs opacity-90 font-medium mb-1">Total</p>
                <p className="text-2xl font-bold">₹{(totalAmount / 100000).toFixed(2)}L</p>
                <p className="text-xs opacity-75 mt-1">{payments.length} records</p>
              </div>
            </div>
          )}

          {/* Action Bar */}
          {/* Action Bar */}
{!showTrash && (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2.5 mb-4">
    {/* Search and Action Buttons */}
    <div className="flex flex-col lg:flex-row gap-2">
      {/* Search - Fixed Width */}
      <div className="w-full lg:w-150 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
          />
        </div>
      </div>

      {/* Larger Buttons */}
      <div className="flex gap-2 flex-wrap flex-1">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <Filter size={18} />
          <span>Filter</span>
        </button>

        <button
          onClick={handleExportExcel}
          className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <Download size={18} />
          <span>Excel</span>
        </button>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <Download size={18} />
          <span>CSV</span>
        </button>

        <label className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-medium flex items-center gap-2 cursor-pointer">
          <Upload size={18} />
          <span>Import</span>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
        </label>

        {lastImportedIds.length > 0 && (
          <button
            onClick={handleUndoImport}
            className="px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <RotateCcw size={18} />
            <span>Undo</span>
          </button>
        )}

        <button
          onClick={() => setShowTrash(!showTrash)}
          className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <Trash size={18} />
          <span>Trash ({trashedPayments.length})</span>
        </button>
      </div>
    </div>

    {/* Filters Panel */}
    {showFilters && (
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <select name="status" value={filters.status} onChange={handleFilterChange} className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white">
            <option value="">All Status</option>
            <option value="Received">Received</option>
            <option value="Pending">Pending</option>
            <option value="Partial">Partial</option>
          </select>
          <select name="category" value={filters.category} onChange={handleFilterChange} className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white">
            <option value="">All Categories</option>
            {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select name="payment_mode" value={filters.payment_mode} onChange={handleFilterChange} className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white">
            <option value="">All Payment Modes</option>
            {uniquePaymentModes.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input type="date" name="date_from" value={filters.date_from} onChange={handleFilterChange} className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white" placeholder="From Date" />
          <input type="date" name="date_to" value={filters.date_to} onChange={handleFilterChange} className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white" placeholder="To Date" />
          <button onClick={clearFilters} className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-medium">
            Clear
          </button>
        </div>
      </div>
    )}

    {/* Bulk Actions */}
    {selectedPayments.length > 0 && (
      <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
        <p className="text-xs text-gray-600 font-medium">{selectedPayments.length} selected</p>
        <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium flex items-center gap-1">
          <Trash size={14} />
          Delete
        </button>
      </div>
    )}
  </div>
)}


              {/* Table Section */}
              {!showTrash ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gradient-to-r from-green-600 to-green-600 text-white">
                        <tr>
                          <th className="p-2 text-left font-semibold whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedPayments.length === currentPayments.length && currentPayments.length > 0}
                              onChange={handleSelectAll}
                              className="w-3 h-3 rounded cursor-pointer"
                            />
                          </th>
                          <th className="p-2 text-left font-semibold whitespace-nowrap">S.No</th>
                          <th className="p-2 text-left font-semibold whitespace-nowrap">Customer Name</th>
                          <th className="p-2 text-left font-semibold whitespace-nowrap">Phone</th>
                          <th className="p-2 text-left font-semibold whitespace-nowrap">Invoice No</th>
                          <th className="p-2 text-left font-semibold whitespace-nowrap">Date</th>
                          <th className="p-2 text-left font-semibold whitespace-nowrap">Total Amount</th>
                          <th className="p-2 text-left font-semibold whitespace-nowrap">Paid Amount</th>
                          <th className="p-2 text-left font-semibold whitespace-nowrap">Due Amount</th>
                          <th className="p-2 text-left font-semibold whitespace-nowrap">Payment Mode</th>
                          <th className="p-2 text-left font-semibold whitespace-nowrap">Category</th>
                          <th className="p-2 text-left font-semibold whitespace-nowrap">Status</th>
                          <th className="p-2 text-left font-semibold whitespace-nowrap">Notes</th>
                          <th className="p-2 text-center font-semibold whitespace-nowrap">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentPayments.length === 0 ? (
                          <tr>
                            <td colSpan={14} className="p-8 text-center text-gray-500">
                              <div className="flex flex-col items-center gap-2">
                                <AlertCircle size={32} className="text-gray-400" />
                                <p className="text-sm">No payment records found</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          currentPayments.map((payment, index) => (
                            <tr key={payment.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="p-2">
                                <input
                                  type="checkbox"
                                  checked={selectedPayments.includes(payment.id)}
                                  onChange={() => togglePaymentSelection(payment.id)}
                                  className="w-3 h-3 rounded cursor-pointer"
                                />
                              </td>
                              <td className="p-2 text-gray-600 whitespace-nowrap">{indexOfFirstItem + index + 1}</td>
                              <td className="p-2 font-medium text-gray-900 whitespace-nowrap">{payment.customer_name}</td>
                              <td className="p-2 text-gray-600 whitespace-nowrap">{payment.phone}</td>
                              <td className="p-2 text-blue-600 font-medium whitespace-nowrap">{payment.invoice_number || '-'}</td>
                              <td className="p-2 text-gray-600 whitespace-nowrap">{formatDateToDisplay(payment.payment_date)}</td>
                              <td className="p-2 text-gray-900 font-semibold whitespace-nowrap">₹{(payment.total_amount || 0).toLocaleString()}</td>
                              <td className="p-2 text-green-700 font-semibold whitespace-nowrap">₹{(payment.paid_amount || 0).toLocaleString()}</td>
                              <td className="p-2 text-red-700 font-semibold whitespace-nowrap">₹{(payment.due_amount || 0).toLocaleString()}</td>
                              <td className="p-2 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200">
                                  {payment.payment_mode}
                                </span>
                              </td>
                              <td className="p-2 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-xs ${getCategoryColor(payment.category)}`}>
                                  {payment.category}
                                </span>
                              </td>
                              <td className="p-2 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(payment.status)}`}>
                                  {payment.status}
                                </span>
                              </td>
                              <td className="p-2 whitespace-nowrap">
                                {payment.notes ? (
                                  <button
                                    onClick={() => showNotes(payment.notes)}
                                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                  >
                                    <Eye size={14} />
                                  </button>
                                ) : (
                                  <span className="text-gray-400 text-xs">-</span>
                                )}
                              </td>
                              <td className="p-2 whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleEdit(payment)}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(payment.id)}
                                    className="p-1 text-orange-600 hover:bg-orange-50 rounded transition-colors"
                                    title="Move to Trash (Auto-delete in 7 days)"
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

                  {/* Pagination */}
                  {renderPagination()}
                </div>
              ) : (
                /* Trash Section */
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800">🗑️ Trash Bin</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowTrash(false)}
                        className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm font-medium"
                      >
                        Back
                      </button>
                      <div className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded text-xs font-medium flex items-center">
                        ⏰ Auto-deletes after 7 days
                      </div>
                    </div>
                  </div>

                  {trashedPayments.length === 0 ? (
                    <div className="text-center py-12">
                      <Trash size={48} className="mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-500">Trash is empty</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="p-2 text-left font-semibold whitespace-nowrap">Customer</th>
                            <th className="p-2 text-left font-semibold whitespace-nowrap">Phone</th>
                            <th className="p-2 text-left font-semibold whitespace-nowrap">Amount</th>
                            <th className="p-2 text-left font-semibold whitespace-nowrap">Status</th>
                            <th className="p-2 text-left font-semibold whitespace-nowrap">Deleted</th>
                            <th className="p-2 text-center font-semibold whitespace-nowrap">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trashedPayments.map((payment) => (
                            <tr key={payment.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="p-2 text-gray-900 whitespace-nowrap">{payment.customer_name}</td>
                              <td className="p-2 text-gray-600 whitespace-nowrap">{payment.phone}</td>
                              <td className="p-2 text-gray-900 font-semibold whitespace-nowrap">₹{(payment.total_amount || 0).toLocaleString()}</td>
                              <td className="p-2 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(payment.status)}`}>
                                  {payment.status}
                                </span>
                              </td>
                              <td className="p-2 text-gray-600 whitespace-nowrap">
                                {payment.deleted_at ? formatDateToDisplay(payment.deleted_at.split('T')[0]) : '-'}
                              </td>
                              <td className="p-2 whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleRestore(payment.id)}
                                    className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded font-medium"
                                  >
                                    Restore
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            </main>
      </div>

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-[100] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] ${toast.type === 'success' ? 'bg-green-500 text-white' :
              toast.type === 'error' ? 'bg-red-500 text-white' :
                toast.type === 'warning' ? 'bg-yellow-500 text-white' :
                  'bg-blue-500 text-white'
              }`}
          >
            {toast.type === 'success' && <CheckCircle size={20} />}
            {toast.type === 'error' && <AlertCircle size={20} />}
            {toast.type === 'warning' && <AlertCircle size={20} />}
            {toast.type === 'info' && <Info size={20} />}
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-white hover:text-gray-200"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-[90]"
            onClick={() => setShowConfirmModal(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[90] pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full pointer-events-auto">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="text-green-600" size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Confirm Action</h3>
                </div>
                <p className="text-gray-600 mb-6">{confirmAction?.message}</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleConfirm}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Notes Modal */}
      {showNotesModal && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-[90]"
            onClick={() => setShowNotesModal(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[90] pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full pointer-events-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">📝 Notes</h3>
                  <button
                    onClick={() => setShowNotesModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <p className="text-gray-700 whitespace-pre-wrap text-sm">{selectedNotes || 'No notes available'}</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add/Edit Payment Modal */}
      {showModal && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-[90]"
            onClick={() => {
              setShowModal(false);
              setEditingPayment(null);
            }}
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[90] pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto">

              {/* Modal Header */}
              <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-600 text-white p-4 rounded-t-xl flex items-center justify-between">
                <h3 className="text-xl font-bold">
                  {editingPayment ? '✏️ Edit Payment' : '➕ Add New Payment'}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingPayment(null);
                  }}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSubmit} className="p-6">

                {/* Customer Information */}
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-gray-700 mb-3 pb-2 border-b border-gray-200">
                    👤 Customer Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Customer Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="customer_name"
                        value={formData.customer_name}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                        placeholder="Enter customer name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                        placeholder="Enter phone number"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Invoice Number
                      </label>
                      <input
                        type="text"
                        name="invoice_number"
                        value={formData.invoice_number}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                        placeholder="Enter invoice number (optional)"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment Details */}
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-gray-700 mb-3 pb-2 border-b border-gray-200">
                    💰 Payment Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Payment Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="payment_date"
                        value={formData.payment_date}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Total Amount <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="total_amount"
                        value={formData.total_amount}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                        placeholder="₹0"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Paid Amount <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="paid_amount"
                        value={formData.paid_amount}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                        placeholder="₹0"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                  </div>

                  {/* Due Amount Display */}
                  {formData.total_amount && formData.paid_amount && (
                    <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-orange-700">Due Amount:</span>
                        <span className="text-lg font-bold text-orange-700">
                          ₹{(parseFloat(formData.total_amount) - parseFloat(formData.paid_amount)).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-orange-600">
                        Status: <span className="font-semibold">{formData.status}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Payment Method & Category */}
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-gray-700 mb-3 pb-2 border-b border-gray-200">
                    💳 Payment Method & Category
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Payment Mode <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="payment_mode"
                        value={formData.payment_mode}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                        required
                      >
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Card">Card</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Transaction ID
                      </label>
                      <input
                        type="text"
                        name="transaction_id"
                        value={formData.transaction_id}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                        placeholder="Enter transaction ID"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                        required
                      >
                        <option value="Installation">Installation</option>
                        <option value="AMC">AMC</option>
                        <option value="Retail">Retail</option>
                        <option value="Service">Service</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Additional Information */}
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-gray-700 mb-3 pb-2 border-b border-gray-200">
                    📋 Additional Information
                  </h4>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Related To (Order/Invoice)
                      </label>
                      <input
                        type="text"
                        name="related_to"
                        value={formData.related_to}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800"
                        placeholder="Enter related order/invoice number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes
                      </label>
                      <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800 resize-none"
                        placeholder="Add any additional notes..."
                      />
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingPayment(null);
                    }}
                    className="flex-1 px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-600 hover:from-green-700 hover:to-green-700 text-white rounded-lg font-medium shadow-md transition-all"
                  >
                    {editingPayment ? 'Update Payment' : 'Add Payment'}
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