"use client";

import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import * as XLSX from 'xlsx';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Filter,
  AlertCircle,
  RotateCcw,
  Download,
  Upload,
  CheckCircle,
  Info,
  Search,
  ChevronLeft,
  ChevronRight,
  Undo2,
  DollarSign,
  Package,
  Wrench,
  User,
  Calendar
} from 'lucide-react';

// ============================================
// INTERFACES
// ============================================

interface RetailRecord {
  id: number;
  user_id?: string;
  customer_name: string;
  phone: string;
  location: string;
  product_category: string;
  device_model: string;
  device_serial_number: string;
  work_type: string;
  work_description: string;
  amount_quoted: number;
  work_date: string;
  done_by: string;
  record_status: 'Open' | 'Closed';
  record_state: 'Onsite' | 'Shipped';
  remarks: string;
  last_updated: string;
  deleted: boolean;
  deleted_at: string | null;
  created_at?: string;
}

interface FormData {
  customer_name: string;
  phone: string;
  location: string;
  product_category: string;
  device_model: string;
  device_serial_number: string;
  work_type: string;
  work_description: string;
  amount_quoted: string;
  work_date: string;
  done_by: string;
  record_status: 'Open' | 'Closed';
  record_state: 'Onsite' | 'Shipped';
  remarks: string;
}

interface Filters {
  customer_name: string;
  phone: string;
  product_category: string;
  date_from: string;
  date_to: string;
  done_by: string;
  record_status: string;
  record_state: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function RetailPage() {
  const [showTrash, setShowTrash] = useState(false);
  const [trashedRecords, setTrashedRecords] = useState<RetailRecord[]>([]);
  const supabase = createClient();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState('');
  const [editingRecord, setEditingRecord] = useState<RetailRecord | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecords, setSelectedRecords] = useState<number[]>([]);
  const [lastImportedIds, setLastImportedIds] = useState<number[]>([]);

  // Master data for dynamic dropdown
  const [productCategories, setProductCategories] = useState<{ id: number; name: string }[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  const [filters, setFilters] = useState<Filters>({
    customer_name: '',
    phone: '',
    product_category: '',
    date_from: '',
    date_to: '',
    done_by: '',
    record_status: '',
    record_state: ''
  });

  const [records, setRecords] = useState<RetailRecord[]>([]);

  const [formData, setFormData] = useState<FormData>({
    customer_name: '',
    phone: '',
    location: '',
    product_category: '',
    device_model: '',
    device_serial_number: '',
    work_type: '',
    work_description: '',
    amount_quoted: '0',
    work_date: new Date().toISOString().split('T')[0],
    done_by: '',
    record_status: 'Open',
    record_state: 'Onsite',
    remarks: ''
  });

  // Fix hydration & fetch master data
  useEffect(() => {
    setMounted(true);
    fetchProductCategories();
  }, []);

  const fetchProductCategories = async () => {
    const { data } = await supabase.from('product_categories').select('id,name').order('name');
    if (data) setProductCategories(data);
  };

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

  const formatDateTime = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
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
      fetchRecords();
      autoDeleteOldRecords();
    }
  }, [mounted]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: activeData, error: activeError } = await supabase
        .from('retail_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('deleted', false)
        .order('created_at', { ascending: false });

      if (activeError) throw activeError;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: trashedData, error: trashedError } = await supabase
        .from('retail_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('deleted', true)
        .gte('deleted_at', sevenDaysAgo.toISOString())
        .order('deleted_at', { ascending: false });

      if (trashedError) throw trashedError;

      setRecords(activeData || []);
      setTrashedRecords(trashedData || []);
    } catch (error: any) {
      console.error('Error:', error);
      showToast('Failed to fetch retail records', 'error');
    } finally {
      setLoading(false);
    }
  };

  const autoDeleteOldRecords = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      await supabase
        .from('retail_records')
        .delete()
        .eq('user_id', user.id)
        .eq('deleted', true)
        .lt('deleted_at', sevenDaysAgo.toISOString());
    } catch (error) {
      console.error('Auto-delete error:', error);
    }
  };

  // ============================================
  // EXPORT / IMPORT
  // ============================================

  const handleExportExcel = () => {
    try {
      const dataToExport = (showTrash ? trashedRecords : records).map((record, index) => ({
        'S.No': index + 1,
        'Customer Name': record.customer_name,
        'Phone': record.phone,
        'Location': record.location,
        'Product Category': record.product_category,
        'Device Model': record.device_model || '',
        'Device Serial No.': record.device_serial_number || '',
        'Work Type': record.work_type,
        'Work Description': record.work_description,
        'Amount Quoted (₹)': record.amount_quoted,
        'Work Date': record.work_date,
        'Done By': record.done_by,
        'Record Status': record.record_status,
        'Record State': record.record_state,
        'Remarks': record.remarks || '',
        'Last Updated': record.last_updated || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, showTrash ? 'Trashed Retail Records' : 'Retail Records');
      worksheet['!cols'] = Array(15).fill({ wch: 15 });
      XLSX.writeFile(workbook, `${showTrash ? 'Trashed_' : ''}Retail_Records_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast(`Exported ${dataToExport.length} retail records`, 'success');
    } catch (error) {
      showToast('Export failed', 'error');
    }
  };

  const handleExportCSV = () => {
    try {
      const dataToExport = (showTrash ? trashedRecords : records).map((record, index) => ({
        'S.No': index + 1,
        'Customer': record.customer_name,
        'Phone': record.phone,
        'Category': record.product_category,
        'Work Type': record.work_type,
        'Amount': record.amount_quoted,
        'Date': record.work_date,
        'Done By': record.done_by,
        'Status': record.record_status,
        'State': record.record_state
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${showTrash ? 'Trashed_' : ''}Retail_Records_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      showToast(`Exported ${dataToExport.length} records`, 'success');
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

          const recordsToImport = data.map((row: any) => {
            const normalized: any = {};
            Object.keys(row).forEach(key => {
              normalized[key.toLowerCase().trim().replace(/\s+/g, '_')] = row[key];
            });

            return {
              user_id: user.id,
              customer_name: normalized['customer_name'] || normalized['customer'] || '',
              phone: String(normalized['phone'] || ''),
              location: normalized['location'] || '',
              product_category: normalized['product_category'] || 'Uncategorized',
              device_model: normalized['device_model'] || '',
              device_serial_number: normalized['device_serial_number'] || '',
              work_type: normalized['work_type'] || '',
              work_description: normalized['work_description'] || '',
              amount_quoted: parseFloat(normalized['amount_quoted'] || normalized['amount'] || '0'),
              work_date: normalized['work_date'] || new Date().toISOString().split('T')[0],
              done_by: normalized['done_by'] || '',
              record_status: normalized['record_status'] === 'Closed' ? 'Closed' : 'Open',
              record_state: ['Onsite', 'Shipped'].includes(normalized['record_state']) ? normalized['record_state'] : 'Onsite',
              remarks: normalized['remarks'] || '',
              last_updated: new Date().toISOString().split('T')[0],
              deleted: false,
              deleted_at: null
            };
          }).filter(record => record.customer_name && record.phone && record.work_description);

          if (recordsToImport.length === 0) {
            showToast('No valid records found', 'warning');
            e.target.value = '';
            return;
          }

          const { data: insertedData, error } = await supabase
            .from('retail_records')
            .insert(recordsToImport)
            .select('id');

          if (error) throw error;

          const importedIds = insertedData?.map(item => item.id) || [];
          setLastImportedIds(importedIds);
          await fetchRecords();
          showToast(`Imported ${recordsToImport.length} records!`, 'success');
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
    showConfirm(`Permanently delete ${lastImportedIds.length} imported records?`, async () => {
      try {
        const { error } = await supabase.from('retail_records').delete().in('id', lastImportedIds);
        if (error) throw error;
        await fetchRecords();
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

      if (!formData.customer_name || !formData.phone || !formData.work_description || !formData.product_category) {
        showToast('Please fill all required fields', 'error');
        return;
      }

      const recordData = {
        user_id: user.id,
        customer_name: formData.customer_name.trim(),
        phone: formData.phone.trim(),
        location: formData.location.trim(),
        product_category: formData.product_category,
        device_model: formData.device_model?.trim() || null,
        device_serial_number: formData.device_serial_number?.trim() || null,
        work_type: formData.work_type.trim(),
        work_description: formData.work_description.trim(),
        amount_quoted: parseFloat(formData.amount_quoted) || 0,
        work_date: formData.work_date,
        done_by: formData.done_by.trim(),
        record_status: formData.record_status,
        record_state: formData.record_state,
        remarks: formData.remarks?.trim() || null,
        last_updated: new Date().toISOString().split('T')[0],
        deleted: false,
        deleted_at: null
      };

      if (editingRecord) {
        const { error } = await supabase.from('retail_records').update(recordData).eq('id', editingRecord.id).eq('user_id', user.id);
        if (error) throw error;
        showToast('Record updated!', 'success');
      } else {
        const { error } = await supabase.from('retail_records').insert([recordData]);
        if (error) throw error;
        showToast('Record added!', 'success');
      }

      await fetchRecords();
      setShowModal(false);
      setEditingRecord(null);
      resetForm();
    } catch (error: any) {
      showToast(`Save failed: ${error?.message || 'Unknown error'}`, 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      customer_name: '', phone: '', location: '', product_category: productCategories[0]?.name || '',
      device_model: '', device_serial_number: '', work_type: '', work_description: '', amount_quoted: '0',
      work_date: new Date().toISOString().split('T')[0], done_by: '', record_status: 'Open', record_state: 'Onsite', remarks: ''
    });
  };

  const handleEdit = (record: RetailRecord) => {
    setEditingRecord(record);
    setFormData({
      customer_name: record.customer_name,
      phone: record.phone,
      location: record.location,
      product_category: record.product_category,
      device_model: record.device_model || '',
      device_serial_number: record.device_serial_number || '',
      work_type: record.work_type,
      work_description: record.work_description,
      amount_quoted: record.amount_quoted.toString(),
      work_date: record.work_date,
      done_by: record.done_by,
      record_status: record.record_status,
      record_state: record.record_state,
      remarks: record.remarks || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    showConfirm('Delete this record? (Will be permanently removed in 7 days)', async () => {
      try {
        const { error } = await supabase
          .from('retail_records')
          .update({ deleted: true, deleted_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        await fetchRecords();
        showToast('Deleted (will be removed in 7 days)', 'success');
      } catch (error) {
        showToast('Delete failed', 'error');
      }
    });
  };

  const handleRestore = async (id: number) => {
    showConfirm('Restore this record from trash?', async () => {
      try {
        const { error } = await supabase
          .from('retail_records')
          .update({ deleted: false, deleted_at: null, last_updated: new Date().toISOString().split('T')[0] })
          .eq('id', id);
        if (error) throw error;
        await fetchRecords();
        showToast('Record restored successfully!', 'success');
      } catch (error) {
        showToast('Restore failed', 'error');
      }
    });
  };

  // ============================================
  // BULK OPERATIONS
  // ============================================

  const handleBulkDelete = async () => {
    if (selectedRecords.length === 0) return;
    showConfirm(`Delete ${selectedRecords.length} records?`, async () => {
      try {
        const { error } = await supabase
          .from('retail_records')
          .update({ deleted: true, deleted_at: new Date().toISOString() })
          .in('id', selectedRecords);
        if (error) throw error;
        await fetchRecords();
        setSelectedRecords([]);
        showToast(`${selectedRecords.length} records deleted`, 'success');
      } catch (error) {
        showToast('Delete failed', 'error');
      }
    });
  };

  const handleBulkRestore = async () => {
    if (selectedRecords.length === 0) return;
    showConfirm(`Restore ${selectedRecords.length} records?`, async () => {
      try {
        const { error } = await supabase
          .from('retail_records')
          .update({ deleted: false, deleted_at: null, last_updated: new Date().toISOString().split('T')[0] })
          .in('id', selectedRecords);
        if (error) throw error;
        await fetchRecords();
        setSelectedRecords([]);
        showToast(`${selectedRecords.length} records restored`, 'success');
      } catch (error) {
        showToast('Restore failed', 'error');
      }
    });
  };

  const handleSelectAll = () => {
    const currentDataSource = showTrash ? filteredTrashRecords : filteredRecords;
    const currentPageItems = currentDataSource.slice(indexOfFirstItem, indexOfLastItem);
    if (selectedRecords.length === currentPageItems.length) {
      setSelectedRecords([]);
    } else {
      setSelectedRecords(currentPageItems.map(r => r.id));
    }
  };

  const toggleRecordSelection = (id: number) => {
    setSelectedRecords(prev => prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]);
  };

  // ============================================
  // FILTERS
  // ============================================

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      customer_name: '', phone: '', product_category: '', date_from: '', date_to: '', done_by: '', record_status: '', record_state: ''
    });
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
      'Open': 'bg-orange-100 text-orange-800 border border-orange-200',
      'Closed': 'bg-green-100 text-green-800 border border-green-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border border-gray-200';
  };

  const getStateColor = (state: string) => {
    const colors: Record<string, string> = {
      'Onsite': 'bg-blue-100 text-blue-800 border border-blue-200',
      'Shipped': 'bg-purple-100 text-purple-800 border border-purple-200'
    };
    return colors[state] || 'bg-gray-100 text-gray-800 border border-gray-200';
  };

  // ============================================
  // FILTERING & PAGINATION
  // ============================================

  const filteredRecords = records.filter(record => {
  const keywords = searchTerm.toLowerCase().split(" ").filter(k => k);

  const matchesSearch = keywords.length === 0 || keywords.some(keyword =>
    (record.customer_name || "").toLowerCase().includes(keyword) ||
    (record.phone || "").includes(keyword) ||
    (record.location || "").toLowerCase().includes(keyword) ||
    (record.product_category || "").toLowerCase().includes(keyword) ||
    (record.work_description || "").toLowerCase().includes(keyword) ||
    (record.device_model || "").toLowerCase().includes(keyword) ||
    (record.device_serial_number || "").toLowerCase().includes(keyword)
  );

  if (!matchesSearch) return false;

  if (filters.customer_name && !record.customer_name.toLowerCase().includes(filters.customer_name.toLowerCase())) return false;
  if (filters.phone && !record.phone.includes(filters.phone)) return false;
  if (filters.product_category && record.product_category !== filters.product_category) return false;
  if (filters.date_from && record.work_date < filters.date_from) return false;
  if (filters.date_to && record.work_date > filters.date_to) return false;
  if (filters.done_by && record.done_by !== filters.done_by) return false;
  if (filters.record_status && record.record_status !== filters.record_status) return false;
  if (filters.record_state && record.record_state !== filters.record_state) return false;

  return true;
});

 const filteredTrashRecords = trashedRecords.filter(record => {
  const keywords = searchTerm.toLowerCase().split(" ").filter(k => k);

  const matchesSearch = keywords.length === 0 || keywords.some(keyword =>
    (record.customer_name || "").toLowerCase().includes(keyword) ||
    (record.phone || "").includes(keyword) ||
    (record.location || "").toLowerCase().includes(keyword) ||
    (record.device_model || "").toLowerCase().includes(keyword) ||
    (record.device_serial_number || "").toLowerCase().includes(keyword)
  );

  if (!matchesSearch) return false;

  if (filters.product_category && record.product_category !== filters.product_category) return false;
  if (filters.date_from && record.work_date < filters.date_from) return false;
  if (filters.date_to && record.work_date > filters.date_to) return false;

  return true;
});

  const currentDataSource = showTrash ? filteredTrashRecords : filteredRecords;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentRecords = currentDataSource.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(currentDataSource.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, showTrash]);

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
        <div className="text-sm text-gray-700">
          Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, currentDataSource.length)} of {currentDataSource.length} results
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">First</button>
          <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="px-2 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"><ChevronLeft size={14} />Prev</button>
          {startPage > 1 && <><button onClick={() => setCurrentPage(1)} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">1</button>{startPage > 2 && <span className="px-2 text-gray-500">...</span>}</>}
          {pageNumbers.map(n => (
            <button key={n} onClick={() => setCurrentPage(n)} className={`px-3 py-1.5 text-xs font-medium rounded border ${currentPage === n ? 'bg-pink-600 text-white border-pink-600' : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'}`}>{n}</button>
          ))}
          {endPage < totalPages && <>{endPage < totalPages - 1 && <span className="px-2 text-gray-500">...</span>}<button onClick={() => setCurrentPage(totalPages)} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">{totalPages}</button></>}
          <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="px-2 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1">Next<ChevronRight size={14} /></button>
          <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">Last</button>
        </div>
      </div>
    );
  };

  const totalRecords = records.length;
  const openRecords = records.filter(r => r.record_status === 'Open').length;
  const closedRecords = records.filter(r => r.record_status === 'Closed').length;
  const totalRevenue = records.reduce((sum, r) => sum + r.amount_quoted, 0);

  const uniqueEngineers = [...new Set(records.map(r => r.done_by).filter(Boolean))];
  const uniqueCategories = [...new Set(records.map(r => r.product_category))];

  if (!mounted) return null;
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto"></div><p className="mt-4 text-gray-700">Loading retail records...</p></div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-3 py-2.5 flex items-center justify-between sticky top-0 z-30">
          <h2 className="text-base lg:text-xl font-bold text-gray-900 truncate">
            {showTrash ? '🗑️ Retail Trash' : '📦 Retail Records'}
          </h2>
          {!showTrash && (
            <button onClick={() => { setShowModal(true); setEditingRecord(null); resetForm(); }} className="bg-gradient-to-r from-pink-600 to-pink-600 hover:from-pink-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium shadow-md"><Plus size={16} />Add Record</button>
          )}
        </header>

        <main className="flex-1 overflow-auto p-3 lg:p-4">
          {/* Stats Cards (only when not in trash) */}
          {!showTrash && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-3 shadow-md text-white">
                <p className="text-xs opacity-90 font-medium mb-1">Total Records</p>
                <p className="text-2xl font-bold">{totalRecords}</p>
              </div>
              <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-lg p-3 shadow-md text-white">
                <p className="text-xs opacity-90 font-medium mb-1">Open</p>
                <p className="text-2xl font-bold">{openRecords}</p>
              </div>
              <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-3 shadow-md text-white">
                <p className="text-xs opacity-90 font-medium mb-1">Closed</p>
                <p className="text-2xl font-bold">{closedRecords}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-3 shadow-md text-white">
                <p className="text-xs opacity-90 font-medium mb-1">Total Revenue</p>
                <p className="text-2xl font-bold">₹{totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          )}

          {/* Sticky Filter + Action Bar (Filters always visible) */}
          {!showTrash && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2.5 mb-4 sticky top-0 z-40 bg-white/90 backdrop-blur-sm">
              {/* Row 1: Search + Action Buttons */}
              <div className="flex flex-col lg:flex-row gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-500" size={14} />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white placeholder-gray-500 focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    />
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap flex-shrink-0">
                  <button onClick={handleExportExcel} className="px-2.5 py-1.5 bg-green-100 hover:bg-green-200 text-green-800 rounded text-xs font-medium flex items-center gap-1 transition-colors"><Download size={14} /> Excel</button>
                  <button onClick={handleExportCSV} className="px-2.5 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-xs font-medium flex items-center gap-1 transition-colors"><Download size={14} /> CSV</button>
                  <label className="px-2.5 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"><Upload size={14} /> Import<input type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" /></label>
                  {lastImportedIds.length > 0 && <button onClick={handleUndoImport} className="px-2.5 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded text-xs font-medium flex items-center gap-1 transition-colors"><RotateCcw size={14} /> Undo</button>}
                  <button onClick={() => setShowTrash(true)} className="px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs font-medium flex items-center gap-1 transition-colors"><Trash2 size={14} /> Trash ({trashedRecords.length})</button>
                </div>
              </div>

              {/* Row 2: Filters (Always Visible) */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200">
                <input type="text" name="customer_name" placeholder="Customer" value={filters.customer_name} onChange={handleFilterChange} className="flex-1 min-w-[100px] px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white placeholder-gray-500 focus:ring-2 focus:ring-pink-500" />
                <input type="text" name="phone" placeholder="Phone" value={filters.phone} onChange={handleFilterChange} className="flex-1 min-w-[100px] px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white placeholder-gray-500 focus:ring-2 focus:ring-pink-500" />
                <select name="product_category" value={filters.product_category} onChange={handleFilterChange} className="flex-1 min-w-[120px] px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:ring-2 focus:ring-pink-500">
                  <option value="">All Categories</option>
                  {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <select name="record_status" value={filters.record_status} onChange={handleFilterChange} className="flex-1 min-w-[100px] px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:ring-2 focus:ring-pink-500">
                  <option value="">All Status</option>
                  <option value="Open">Open</option>
                  <option value="Closed">Closed</option>
                </select>
                <select name="record_state" value={filters.record_state} onChange={handleFilterChange} className="flex-1 min-w-[100px] px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:ring-2 focus:ring-pink-500">
                  <option value="">All State</option>
                  <option value="Onsite">Onsite</option>
                  <option value="Shipped">Shipped</option>
                </select>
                <select name="done_by" value={filters.done_by} onChange={handleFilterChange} className="flex-1 min-w-[120px] px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:ring-2 focus:ring-pink-500">
                  <option value="">All Engineers</option>
                  {uniqueEngineers.map(eng => <option key={eng} value={eng}>{eng}</option>)}
                </select>
                <input type="date" name="date_from" value={filters.date_from} onChange={handleFilterChange} className="px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:ring-2 focus:ring-pink-500" placeholder="From" />
                <input type="date" name="date_to" value={filters.date_to} onChange={handleFilterChange} className="px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:ring-2 focus:ring-pink-500" placeholder="To" />
                <button onClick={clearFilters} className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded text-xs font-medium transition-colors">Clear</button>
              </div>

              {/* Bulk Actions (only when items selected) */}
              {selectedRecords.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-800">{selectedRecords.length} selected</span>
                  <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs font-medium flex items-center gap-1 transition-colors">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Table Section (when not in trash) */}
          {!showTrash && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gradient-to-r from-pink-600 to-pink-600 text-white">
                    <tr>
                      <th className="p-2"><input type="checkbox" checked={selectedRecords.length === currentRecords.length && currentRecords.length > 0} onChange={handleSelectAll} className="w-3 h-3 rounded border-gray-300" /></th>
                      <th className="p-2 text-left font-semibold">S.No</th>
                      <th className="p-2 text-left font-semibold">Customer</th>
                      <th className="p-2 text-left font-semibold">Product</th>
                      <th className="p-2 text-left font-semibold">Work Type</th>
                      <th className="p-2 text-left font-semibold">Work Done</th>
                      <th className="p-2 text-left font-semibold">Amount</th>
                      <th className="p-2 text-left font-semibold">Date</th>
                      <th className="p-2 text-left font-semibold">Status</th>
                      <th className="p-2 text-left font-semibold">State</th>
                      <th className="p-2 text-center font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRecords.length === 0 ? (
                      <tr><td colSpan={11} className="p-8 text-center text-gray-500">No records found</td></tr>
                    ) : (
                      currentRecords.map((record, idx) => (
                        <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="p-2"><input type="checkbox" checked={selectedRecords.includes(record.id)} onChange={() => toggleRecordSelection(record.id)} className="w-3 h-3 rounded border-gray-300" /></td>
                          <td className="p-2 text-gray-900">{indexOfFirstItem + idx + 1}</td>
                          <td className="p-2">
                            <div className="font-semibold text-gray-900">{record.customer_name}</div>
                            <div className="text-xs text-gray-600">{record.phone}</div>
                            <div className="text-xs text-gray-600">{record.location}</div>
                          </td>
                          <td className="p-2 text-gray-900">{record.product_category}<br />{record.device_model && <span className="text-xs text-gray-600">{record.device_model}</span>}</td>
                          <td className="p-2 text-gray-900">{record.work_type}</td>
                          <td className="p-2 max-w-xs truncate text-gray-900" title={record.work_description}>{record.work_description.length > 40 ? record.work_description.substring(0, 40) + '...' : record.work_description}</td>
                          <td className="p-2 font-semibold text-gray-900">₹{record.amount_quoted.toLocaleString()}</td>
                          <td className="p-2 text-gray-900">{formatDateToDisplay(record.work_date)}<br /><span className="text-xs text-gray-600">By: {record.done_by}</span></td>
                          <td className="p-2"><span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(record.record_status)}`}>{record.record_status}</span></td>
                          <td className="p-2"><span className={`px-2 py-0.5 rounded text-xs font-medium ${getStateColor(record.record_state)}`}>{record.record_state}</span></td>
                          <td className="p-2 text-center">
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => handleEdit(record)} className="p-1 text-blue-700 hover:bg-blue-50 rounded transition-colors" title="Edit"><Edit2 size={14} /></button>
                              <button onClick={() => handleDelete(record.id)} className="p-1 text-red-700 hover:bg-red-50 rounded transition-colors" title="Delete"><Trash2 size={14} /></button>
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
          )}

          {/* Trash Section (with Back button) */}
          {showTrash && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-gray-900">🗑️ Trash Bin</h3>
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                    {trashedRecords.length} items (auto-delete in 7 days)
                  </span>
                </div>
                <button
                  onClick={() => setShowTrash(false)}
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded text-sm font-medium transition-colors flex items-center gap-1"
                >
                  ← Back to Records
                </button>
              </div>

              {trashedRecords.length === 0 ? (
                <div className="text-center py-12">
                  <Trash2 size={48} className="mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-600">Trash is empty</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 text-left font-semibold text-gray-800">Customer</th>
                        <th className="p-2 text-left font-semibold text-gray-800">Product</th>
                        <th className="p-2 text-left font-semibold text-gray-800">Amount</th>
                        <th className="p-2 text-left font-semibold text-gray-800">Date</th>
                        <th className="p-2 text-left font-semibold text-gray-800">Deleted On</th>
                        <th className="p-2 text-center font-semibold text-gray-800">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trashedRecords.map(record => (
                        <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-2">
                            <div className="font-semibold text-gray-900">{record.customer_name}</div>
                            <div className="text-xs text-gray-600">{record.phone}</div>
                          </td>
                          <td className="p-2 text-gray-900">{record.product_category}</td>
                          <td className="p-2 font-semibold text-gray-900">₹{record.amount_quoted.toLocaleString()}</td>
                          <td className="p-2 text-gray-900">{formatDateToDisplay(record.work_date)}</td>
                          <td className="p-2 text-gray-600 text-xs">{formatDateTime(record.deleted_at)}</td>
                          <td className="p-2 text-center">
                            <button onClick={() => handleRestore(record.id)} className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-800 rounded text-xs font-medium transition-colors flex items-center gap-1 mx-auto">
                              <Undo2 size={14} /> Restore
                            </button>
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

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[100] space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white font-medium ${t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-600' : t.type === 'warning' ? 'bg-yellow-600' : 'bg-blue-600'}`}>
            {t.type === 'success' && <CheckCircle size={20} />}
            {t.type === 'error' && <AlertCircle size={20} />}
            {t.type === 'warning' && <AlertCircle size={20} />}
            {t.type === 'info' && <Info size={20} />}
            <p className="flex-1 text-sm">{t.message}</p>
            <button onClick={() => setToasts(prev => prev.filter(t2 => t2.id !== t.id))} className="text-white hover:text-gray-200"><X size={16} /></button>
          </div>
        ))}
      </div>

      {/* Confirm Modal */}
      {showConfirmModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[90]" onClick={() => setShowConfirmModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[90]">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="text-pink-700" size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Confirm Action</h3>
              </div>
              <p className="text-gray-800 mb-6">{confirmAction?.message}</p>
              <div className="flex gap-3">
                <button onClick={handleConfirm} className="flex-1 bg-pink-600 hover:bg-pink-700 text-white py-2 rounded-lg font-medium transition-colors">Confirm</button>
                <button onClick={() => setShowConfirmModal(false)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-medium transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Notes Modal */}
      {showNotesModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[90]" onClick={() => setShowNotesModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[90]">
            <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl">
              <div className="bg-gradient-to-r from-pink-600 to-pink-600 text-white p-4 rounded-t-xl flex justify-between items-center">
                <h3 className="text-lg font-bold">📝 Work Description</h3>
                <button onClick={() => setShowNotesModal(false)} className="text-white hover:text-gray-200"><X size={20} /></button>
              </div>
              <div className="p-6">
                <p className="text-gray-800 whitespace-pre-wrap text-sm">{selectedNotes}</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add/Edit Modal - with placeholders */}
      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[90]" onClick={() => { setShowModal(false); setEditingRecord(null); }} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[90] overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-pink-600 to-pink-600 text-white p-4 rounded-t-xl flex justify-between items-center">
                <h3 className="text-xl font-bold">{editingRecord ? '✏️ Edit Record' : '➕ Add Retail Record'}</h3>
                <button onClick={() => { setShowModal(false); setEditingRecord(null); }} className="text-white hover:text-gray-200"><X size={24} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Customer Name *</label>
                    <input type="text" name="customer_name" value={formData.customer_name} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white placeholder-gray-500 focus:ring-2 focus:ring-pink-500 focus:border-pink-500" placeholder="Enter customer name" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Phone *</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white placeholder-gray-500 focus:ring-2 focus:ring-pink-500" placeholder="Enter phone number" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Location *</label>
                    <input type="text" name="location" value={formData.location} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white placeholder-gray-500 focus:ring-2 focus:ring-pink-500" placeholder="Enter location / address" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Product Category *</label>
                    <select name="product_category" value={formData.product_category} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500" required>
                      <option value="">Select Category</option>
                      {productCategories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Device Model</label>
                    <input type="text" name="device_model" value={formData.device_model} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500" placeholder="e.g., ZK4500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Device Serial Number</label>
                    <input type="text" name="device_serial_number" value={formData.device_serial_number} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500" placeholder="Serial / IMEI number" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Work Type *</label>
                    <input type="text" name="work_type" value={formData.work_type} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500" placeholder="e.g., Installation, Repair" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Amount Quoted (₹) *</label>
                    <input type="number" name="amount_quoted" value={formData.amount_quoted} onChange={handleInputChange} min="0" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500" placeholder="0.00" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Work Date *</label>
                    <input type="date" name="work_date" value={formData.work_date} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Done By *</label>
                    <input type="text" name="done_by" value={formData.done_by} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500" placeholder="Engineer name" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Record Status</label>
                    <select name="record_status" value={formData.record_status} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500">
                      <option value="Open">Open</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">Record State</label>
                    <select name="record_state" value={formData.record_state} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500">
                      <option value="Onsite">Onsite</option>
                      <option value="Shipped">Shipped</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-800 mb-1">Work Description *</label>
                    <textarea name="work_description" value={formData.work_description} onChange={handleInputChange} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500" placeholder="Detailed description of work done" required />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-800 mb-1">Remarks</label>
                    <textarea name="remarks" value={formData.remarks} onChange={handleInputChange} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-pink-500" placeholder="Any additional notes" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button type="button" onClick={() => { setShowModal(false); setEditingRecord(null); }} className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors">Cancel</button>
                  <button type="submit" className="px-6 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-medium shadow-md transition-colors">{editingRecord ? 'Update' : 'Add'}</button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}