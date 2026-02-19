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
  device_type: 'Biometric' | 'Access Control' | 'CCTV' | 'Automation' | 'Other';
  device_model: string;
  work_type: 'Customization' | 'Software Update' | 'Configuration' | 'Small Repair' | 'Other';
  work_description: string;
  charges_applied: 'Yes' | 'No';
  amount: number;
  payment_mode: 'Cash' | 'UPI' | 'Free';
  work_date: string;
  done_by: string;
  record_status: 'Open' | 'Closed';
  remarks: string;
  proof_reference: string;
  last_updated: string;
  deleted: boolean;
  deleted_at: string | null;
  created_at?: string;
}

interface FormData {
  customer_name: string;
  phone: string;
  location: string;
  device_type: 'Biometric' | 'Access Control' | 'CCTV' | 'Automation' | 'Other';
  device_model: string;
  work_type: 'Customization' | 'Software Update' | 'Configuration' | 'Small Repair' | 'Other';
  work_description: string;
  charges_applied: 'Yes' | 'No';
  amount: string;
  payment_mode: 'Cash' | 'UPI' | 'Free';
  work_date: string;
  done_by: string;
  record_status: 'Open' | 'Closed';
  remarks: string;
  proof_reference: string;
}

interface Filters {
  customer_name: string;
  phone: string;
  device_type: string;
  date_from: string;
  date_to: string;
  done_by: string;
  record_status: string;
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

  // PAGINATION STATES
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  const [filters, setFilters] = useState<Filters>({
    customer_name: '',
    phone: '',
    device_type: '',
    date_from: '',
    date_to: '',
    done_by: '',
    record_status: ''
  });

  const [records, setRecords] = useState<RetailRecord[]>([]);

  const [formData, setFormData] = useState<FormData>({
    customer_name: '',
    phone: '',
    location: '',
    device_type: 'Biometric',
    device_model: '',
    work_type: 'Customization',
    work_description: '',
    charges_applied: 'No',
    amount: '0',
    payment_mode: 'Free',
    work_date: new Date().toISOString().split('T')[0],
    done_by: '',
    record_status: 'Open',
    remarks: '',
    proof_reference: ''
  });

  // Fix hydration issue
  useEffect(() => {
    setMounted(true);
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
  // DATA FETCHING - AUTO DELETE OLD RECORDS
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

      // ✅ 1. Get logged-in user
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error('Auth error:', userError);
        showToast('Please login to continue', 'error');
        router.push('/login');
        return;
      }

      // ✅ 2. Fetch ACTIVE Records (deleted = false)
      const { data: activeData, error: activeError } = await supabase
        .from('retail_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('deleted', false)
        .order('created_at', { ascending: false });

      if (activeError) throw activeError;

      setRecords(activeData || []);

      // ✅ 3. Fetch TRASHED Records (deleted = true, last 7 days only)
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

      setTrashedRecords(trashedData || []);

    } catch (error: any) {
      console.error('Error:', error);
      showToast('Failed to fetch retail records', 'error');
    } finally {
      setLoading(false);
    }
  };

  // AUTO DELETE records older than 7 days (PERMANENT DELETE)
  const autoDeleteOldRecords = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // PERMANENT DELETE records marked as deleted and older than 7 days
      const { error } = await supabase
        .from('retail_records')
        .delete()
        .eq('user_id', user.id)
        .eq('deleted', true)
        .lt('deleted_at', sevenDaysAgo.toISOString());

      if (error) {
        console.error('Auto-delete error:', error);
      } else {
        console.log('Old deleted records auto-cleaned');
      }
    } catch (error) {
      console.error('Auto-delete error:', error);
    }
  };

  // ============================================
  // EXPORT FUNCTIONS
  // ============================================

  const handleExportExcel = () => {
    try {
      const dataToExport = (showTrash ? trashedRecords : records).map((record, index) => ({
        'S.No': index + 1,
        'Customer Name': record.customer_name,
        'Phone': record.phone,
        'Location': record.location,
        'Device Type': record.device_type,
        'Device Model': record.device_model || '',
        'Work Type': record.work_type,
        'Work Description': record.work_description,
        'Charges Applied': record.charges_applied,
        'Amount': record.amount,
        'Payment Mode': record.payment_mode,
        'Work Date': record.work_date,
        'Done By': record.done_by,
        'Status': record.record_status,
        'Remarks': record.remarks || '',
        'Proof Reference': record.proof_reference || '',
        'Deleted At': record.deleted_at || '',
        'Last Updated': record.last_updated || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, showTrash ? 'Trashed Retail Records' : 'Retail Records');
      worksheet['!cols'] = Array(16).fill({ wch: 15 });
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
        'Device Type': record.device_type,
        'Work Type': record.work_type,
        'Date': record.work_date,
        'Done By': record.done_by,
        'Status': record.record_status,
        'Deleted At': record.deleted_at || ''
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
              device_type: ['Biometric', 'Access Control', 'CCTV', 'Automation', 'Other'].includes(normalized['device_type'])
                ? normalized['device_type']
                : 'Other',
              device_model: normalized['device_model'] || '',
              work_type: ['Customization', 'Software Update', 'Configuration', 'Small Repair', 'Other'].includes(normalized['work_type'])
                ? normalized['work_type']
                : 'Other',
              work_description: normalized['work_description'] || '',
              charges_applied: normalized['charges_applied'] === 'Yes' ? 'Yes' : 'No',
              amount: parseFloat(normalized['amount'] || '0'),
              payment_mode: ['Cash', 'UPI'].includes(normalized['payment_mode'])
                ? normalized['payment_mode']
                : 'Free',
              work_date: normalized['work_date'] || new Date().toISOString().split('T')[0],
              done_by: normalized['done_by'] || '',
              record_status: normalized['record_status'] === 'Closed' ? 'Closed' : 'Open',
              remarks: normalized['remarks'] || '',
              proof_reference: normalized['proof_reference'] || '',
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
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      
      if (name === 'charges_applied') {
        if (value === 'No') {
          updated.amount = '0';
          updated.payment_mode = 'Free';
        } else {
          updated.payment_mode = 'Cash';
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

      if (!formData.customer_name || !formData.phone || !formData.work_description) {
        showToast('Please fill all required fields', 'error');
        return;
      }

      const recordData = {
        user_id: user.id,
        customer_name: formData.customer_name.trim(),
        phone: formData.phone.trim(),
        location: formData.location.trim(),
        device_type: formData.device_type,
        device_model: formData.device_model?.trim() || null,
        work_type: formData.work_type,
        work_description: formData.work_description.trim(),
        charges_applied: formData.charges_applied,
        amount: parseFloat(formData.amount) || 0,
        payment_mode: formData.payment_mode,
        work_date: formData.work_date,
        done_by: formData.done_by.trim(),
        record_status: formData.record_status,
        remarks: formData.remarks?.trim() || null,
        proof_reference: formData.proof_reference?.trim() || null,
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
      setFormData({
        customer_name: '', phone: '', location: '', device_type: 'Biometric', device_model: '',
        work_type: 'Customization', work_description: '', charges_applied: 'No', amount: '0',
        payment_mode: 'Free', work_date: new Date().toISOString().split('T')[0],
        done_by: '', record_status: 'Open', remarks: '', proof_reference: ''
      });
    } catch (error: any) {
      showToast(`Save failed: ${error?.message || 'Unknown error'}`, 'error');
    }
  };

  const handleEdit = (record: RetailRecord) => {
    setEditingRecord(record);
    setFormData({
      customer_name: record.customer_name,
      phone: record.phone,
      location: record.location,
      device_type: record.device_type,
      device_model: record.device_model,
      work_type: record.work_type,
      work_description: record.work_description,
      charges_applied: record.charges_applied,
      amount: record.amount.toString(),
      payment_mode: record.payment_mode,
      work_date: record.work_date,
      done_by: record.done_by,
      record_status: record.record_status,
      remarks: record.remarks,
      proof_reference: record.proof_reference
    });
    setShowModal(true);
  };

  // SOFT DELETE - Mark as deleted for 7 days before auto-deletion
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

  // RESTORE FROM TRASH
  const handleRestore = async (id: number) => {
    showConfirm('Restore this record from trash?', async () => {
      try {
        const { error } = await supabase
          .from('retail_records')
          .update({ 
            deleted: false, 
            deleted_at: null,
            last_updated: new Date().toISOString().split('T')[0]
          })
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
    if (selectedRecords.length === 0) {
      showToast('No records selected', 'warning');
      return;
    }

    showConfirm(`Delete ${selectedRecords.length} records? (Will be permanently removed in 7 days)`, async () => {
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
    if (selectedRecords.length === 0) {
      showToast('No records selected', 'warning');
      return;
    }

    showConfirm(`Restore ${selectedRecords.length} records from trash?`, async () => {
      try {
        const { error } = await supabase
          .from('retail_records')
          .update({ 
            deleted: false, 
            deleted_at: null,
            last_updated: new Date().toISOString().split('T')[0]
          })
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
    const currentDataSource = showTrash ? trashedRecords : records;
    const currentFiltered = showTrash ? filteredTrashRecords : filteredRecords;
    const currentPageItems = currentFiltered.slice(indexOfFirstItem, indexOfLastItem);
    
    if (selectedRecords.length === currentPageItems.length) {
      setSelectedRecords([]);
    } else {
      setSelectedRecords(currentPageItems.map(record => record.id));
    }
  };

  const toggleRecordSelection = (id: number) => {
    setSelectedRecords(prev => prev.includes(id) ? prev.filter(recordId => recordId !== id) : [...prev, id]);
  };

  // ============================================
  // FILTER FUNCTIONS
  // ============================================

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      customer_name: '', phone: '', device_type: '', date_from: '',
      date_to: '', done_by: '', record_status: ''
    });
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
      'Open': 'bg-orange-50 text-orange-700 border border-orange-200',
      'Closed': 'bg-green-50 text-green-700 border border-green-200'
    };
    return colors[status] || 'bg-gray-50 text-gray-700 border border-gray-200';
  };

  const getPaymentColor = (payment: string) => {
    const colors: Record<string, string> = {
      'Cash': 'bg-green-50 text-green-700 border border-green-200',
      'UPI': 'bg-blue-50 text-blue-700 border border-blue-200',
      'Free': 'bg-gray-50 text-gray-700 border border-gray-200'
    };
    return colors[payment] || 'bg-gray-50 text-gray-700 border border-gray-200';
  };

  // ============================================
  // FILTERING AND CALCULATIONS
  // ============================================

  // Filter active records
  const filteredRecords = records.filter(record => {
    const matchesSearch = record.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.phone.includes(searchTerm) || record.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.device_model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.work_description.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (filters.customer_name && !record.customer_name.toLowerCase().includes(filters.customer_name.toLowerCase())) return false;
    if (filters.phone && !record.phone.includes(filters.phone)) return false;
    if (filters.device_type && record.device_type !== filters.device_type) return false;
    if (filters.date_from && record.work_date < filters.date_from) return false;
    if (filters.date_to && record.work_date > filters.date_to) return false;
    if (filters.done_by && record.done_by !== filters.done_by) return false;
    if (filters.record_status && record.record_status !== filters.record_status) return false;
    return true;
  });

  // Filter trashed records
  const filteredTrashRecords = trashedRecords.filter(record => {
    const matchesSearch = record.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.phone.includes(searchTerm) || record.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.device_model?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (filters.customer_name && !record.customer_name.toLowerCase().includes(filters.customer_name.toLowerCase())) return false;
    if (filters.phone && !record.phone.includes(filters.phone)) return false;
    if (filters.device_type && record.device_type !== filters.device_type) return false;
    if (filters.date_from && record.work_date < filters.date_from) return false;
    if (filters.date_to && record.work_date > filters.date_to) return false;
    if (filters.done_by && record.done_by !== filters.done_by) return false;
    if (filters.record_status && record.record_status !== filters.record_status) return false;
    return true;
  });

  // Get unique engineers for filter
  const uniqueEngineers = [...new Set(records.map(r => r.done_by).filter(Boolean))];

  // ============================================
  // PAGINATION LOGIC
  // ============================================

  const currentDataSource = showTrash ? filteredTrashRecords : filteredRecords;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentRecords = currentDataSource.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(currentDataSource.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters.customer_name, filters.phone, filters.date_from, filters.date_to, filters.device_type, filters.done_by, filters.record_status, showTrash]);

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
            <span className="font-semibold">{Math.min(indexOfLastItem, currentDataSource.length)}</span> of{' '}
            <span className="font-semibold">{currentDataSource.length}</span> {showTrash ? 'trashed' : ''} results
          </span>
        </div>

        <div className="flex items-center gap-1 flex-wrap justify-center">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            First
          </button>

          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-2 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            <ChevronLeft size={14} />
            Prev
          </button>

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
                ? 'bg-pink-600 text-white border-pink-600'
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

          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-2 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            Next
            <ChevronRight size={14} />
          </button>

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

  const totalRecords = records.length;
  const openRecords = records.filter(r => r.record_status === 'Open').length;
  const closedRecords = records.filter(r => r.record_status === 'Closed').length;
  const totalRevenue = records.filter(r => r.charges_applied === 'Yes').reduce((sum, r) => sum + r.amount, 0);

  if (!mounted) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading retail records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-[100] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] ${toast.type === 'success' ? 'bg-green-500 text-white' :
              toast.type === 'error' ? 'bg-red-500 text-white' :
                toast.type === 'warning' ? 'bg-yellow-500 text-white' : 'bg-blue-500 text-white'
              }`}
          >
            {toast.type === 'success' && <CheckCircle size={20} />}
            {toast.type === 'error' && <AlertCircle size={20} />}
            {toast.type === 'warning' && <AlertCircle size={20} />}
            {toast.type === 'info' && <Info size={20} />}
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[90]" onClick={() => setShowConfirmModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[90] pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full pointer-events-auto">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="text-pink-600" size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Confirm Action</h3>
                </div>
                <p className="text-gray-600 mb-6">{confirmAction?.message}</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleConfirm}
                    className="flex-1 bg-gradient-to-r from-pink-600 to-pink-600 hover:from-pink-700 hover:to-pink-700 text-white px-4 py-2 rounded-lg font-medium transition-all"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-medium transition-all"
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
          <div className="fixed inset-0 bg-black/30 z-[90]" onClick={() => setShowNotesModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[90] pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full pointer-events-auto">
              <div className="bg-gradient-to-r from-pink-600 to-pink-600 text-white p-4 rounded-t-xl flex items-center justify-between">
                <h3 className="text-xl font-bold">📝 Details</h3>
                <button onClick={() => setShowNotesModal(false)} className="text-white hover:text-gray-200">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6">
                <p className="text-gray-700 whitespace-pre-wrap">{selectedNotes || 'No details available'}</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add/Edit Record Modal */}
      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[90]" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[90] pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto">
              <div className="sticky top-0 bg-gradient-to-r from-pink-600 to-pink-600 text-white p-4 rounded-t-xl flex items-center justify-between">
                <h3 className="text-xl font-bold">{editingRecord ? 'Edit Record' : 'Add New Retail Record'}</h3>
                <button onClick={() => setShowModal(false)} className="text-white hover:text-gray-200">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                    <input
                      type="text"
                      name="customer_name"
                      value={formData.customer_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-pink-500 focus:border-pink-500 placeholder-gray-500"
                      placeholder="Enter customer name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-pink-500 focus:border-pink-500 placeholder-gray-500"
                      placeholder="Enter phone number"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-pink-500 focus:border-pink-500 placeholder-gray-500"
                      placeholder="Enter location/address"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Device Type *</label>
                    <select
                      name="device_type"
                      value={formData.device_type}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-700"
                    >
                      <option value="Biometric">Biometric</option>
                      <option value="Access Control">Access Control</option>
                      <option value="CCTV">CCTV</option>
                      <option value="Automation">Automation</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Device Model</label>
                    <input
                      type="text"
                      name="device_model"
                      value={formData.device_model}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-pink-500 focus:border-pink-500 placeholder-gray-500"
                      placeholder="Enter device model/serial"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Work Type *</label>
                    <select
                      name="work_type"
                      value={formData.work_type}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-700"
                    >
                      <option value="Customization">Customization</option>
                      <option value="Software Update">Software Update</option>
                      <option value="Configuration">Configuration</option>
                      <option value="Small Repair">Small Repair</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Work Date *</label>
                    <input
                      type="date"
                      name="work_date"
                      value={formData.work_date}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-700"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Done By *</label>
                    <input
                      type="text"
                      name="done_by"
                      value={formData.done_by}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-pink-500 focus:border-pink-500 placeholder-gray-500"
                      placeholder="Enter staff/engineer name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Charges Applied</label>
                    <select
                      name="charges_applied"
                      value={formData.charges_applied}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-700"
                    >
                      <option value="No">No Charges (Free)</option>
                      <option value="Yes">Charges Applied</option>
                    </select>
                  </div>
                  {formData.charges_applied === 'Yes' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                        <input
                          type="number"
                          name="amount"
                          value={formData.amount}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-pink-500 focus:border-pink-500 placeholder-gray-500"
                          placeholder="Enter amount"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode *</label>
                        <select
                          name="payment_mode"
                          value={formData.payment_mode}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-700"
                        >
                          <option value="Cash">Cash</option>
                          <option value="UPI">UPI</option>
                        </select>
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Record Status *</label>
                    <select
                      name="record_status"
                      value={formData.record_status}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-700"
                    >
                      <option value="Open">Open</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Proof Reference</label>
                    <input
                      type="text"
                      name="proof_reference"
                      value={formData.proof_reference}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-pink-500 focus:border-pink-500 placeholder-gray-500"
                      placeholder="Enter proof/reference"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Work Description *</label>
                    <textarea
                      name="work_description"
                      value={formData.work_description}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-pink-500 focus:border-pink-500 placeholder-gray-500"
                      placeholder="Describe the work done in detail"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                    <textarea
                      name="remarks"
                      value={formData.remarks}
                      onChange={handleInputChange}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-pink-500 focus:border-pink-500 placeholder-gray-500"
                      placeholder="Additional notes or comments"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-gradient-to-r from-pink-600 to-pink-600 hover:from-pink-700 hover:to-pink-700 text-white rounded-lg font-medium transition-all"
                  >
                    {editingRecord ? 'Update Record' : 'Add Record'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h2 className="text-base lg:text-xl font-bold text-gray-800 truncate">
              {showTrash ? '🗑️ Retail Trash' : '📦 Retail Records'}
            </h2>
            {showTrash && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                {trashedRecords.length} items in trash (Auto-deletes in 7 days)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!showTrash && (
              <button
                onClick={() => {
                  setShowModal(true);
                  setEditingRecord(null);
                  setFormData({
                    customer_name: '', phone: '', location: '', device_type: 'Biometric', device_model: '',
                    work_type: 'Customization', work_description: '', charges_applied: 'No', amount: '0',
                    payment_mode: 'Free', work_date: new Date().toISOString().split('T')[0],
                    done_by: '', record_status: 'Open', remarks: '', proof_reference: ''
                  });
                }}
                className="bg-gradient-to-r from-pink-600 to-pink-600 hover:from-pink-700 hover:to-pink-700 text-white px-3 py-1.5 rounded-lg font-medium shadow-md transition-all flex items-center gap-1.5 text-sm"
              >
                <Plus size={16} />
                <span>Add Record</span>
              </button>
            )}
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-3 lg:p-4">

          {/* Stats Cards (Only show when not in trash) */}
          {!showTrash && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-3 shadow-md text-white">
                <p className="text-xs opacity-90 font-medium mb-1">Total Records</p>
                <p className="text-2xl font-bold">{totalRecords}</p>
                <p className="text-xs opacity-75 mt-1">All entries</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-3 shadow-md text-white">
                <p className="text-xs opacity-90 font-medium mb-1">Open Records</p>
                <p className="text-2xl font-bold">{openRecords}</p>
                <p className="text-xs opacity-75 mt-1">Pending work</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-3 shadow-md text-white">
                <p className="text-xs opacity-90 font-medium mb-1">Closed Records</p>
                <p className="text-2xl font-bold">{closedRecords}</p>
                <p className="text-xs opacity-75 mt-1">Completed</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-3 shadow-md text-white">
                <p className="text-xs opacity-90 font-medium mb-1">Total Revenue</p>
                <p className="text-2xl font-bold">₹{totalRevenue}</p>
                <p className="text-xs opacity-75 mt-1">From paid work</p>
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2.5 mb-4">
            <div className="flex flex-col lg:flex-row gap-2">

              {/* Search */}
              <div className="w-full lg:w-64 flex-shrink-0">
                <div className="relative">
                  <Search
                    className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400"
                    size={16}
                  />
                  <input
                    type="text"
                    placeholder={`Search ${showTrash ? 'trash' : 'records'}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded text-sm
               focus:ring-2 focus:ring-pink-500 focus:border-pink-500 text-gray-800"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 flex-wrap flex-1">

                {!showTrash ? (
                  <>
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700
               rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                      <Filter size={18} />
                      <span>Filter</span>
                    </button>

                    <button
                      onClick={handleExportExcel}
                      className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700
               rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                      <Download size={18} />
                      <span>Excel</span>
                    </button>

                    <button
                      onClick={handleExportCSV}
                      className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700
               rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                      <Download size={18} />
                      <span>CSV</span>
                    </button>

                    <label className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700
                        rounded-lg text-sm font-medium flex items-center gap-2 cursor-pointer">
                      <Upload size={18} />
                      <span>Import</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleImport}
                        className="hidden"
                      />
                    </label>

                    {lastImportedIds.length > 0 && (
                      <button
                        onClick={handleUndoImport}
                        className="px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700
                 rounded-lg text-sm font-medium flex items-center gap-2"
                      >
                        <RotateCcw size={18} />
                        <span>Undo</span>
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleExportExcel}
                      className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700
               rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                      <Download size={18} />
                      <span>Export Excel</span>
                    </button>

                    <button
                      onClick={handleExportCSV}
                      className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700
               rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                      <Download size={18} />
                      <span>Export CSV</span>
                    </button>
                  </>
                )}

                {/* Trash Toggle Button (Always Visible) */}
                <button
                  onClick={() => setShowTrash(!showTrash)}
                  className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700
           rounded-lg text-sm font-medium flex items-center gap-2 ml-auto"
                >
                  {showTrash ? (
                    <>
                      <Undo2 size={18} />
                      <span>Back to Records</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={18} />
                      <span>Trash ({trashedRecords.length})</span>
                    </>
                  )}
                </button>

              </div>
            </div>
          </div>

          {/* Filter Section (Only show when not in trash) */}
          {showFilters && !showTrash && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <input
                  type="text"
                  name="customer_name"
                  placeholder="Customer"
                  value={filters.customer_name}
                  onChange={handleFilterChange}
                  className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white"
                />
                <input
                  type="text"
                  name="phone"
                  placeholder="Phone"
                  value={filters.phone}
                  onChange={handleFilterChange}
                  className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white"
                />
                <select
                  name="device_type"
                  value={filters.device_type}
                  onChange={handleFilterChange}
                  className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white"
                >
                  <option value="">All Devices</option>
                  <option value="Biometric">Biometric</option>
                  <option value="Access Control">Access Control</option>
                  <option value="CCTV">CCTV</option>
                  <option value="Automation">Automation</option>
                  <option value="Other">Other</option>
                </select>
                <select
                  name="done_by"
                  value={filters.done_by}
                  onChange={handleFilterChange}
                  className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white"
                >
                  <option value="">All Engineers</option>
                  {uniqueEngineers.map(engineer => (
                    <option key={engineer} value={engineer}>{engineer}</option>
                  ))}
                </select>
                <select
                  name="record_status"
                  value={filters.record_status}
                  onChange={handleFilterChange}
                  className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white"
                >
                  <option value="">All Status</option>
                  <option value="Open">Open</option>
                  <option value="Closed">Closed</option>
                </select>
                <input
                  type="date"
                  name="date_from"
                  value={filters.date_from}
                  onChange={handleFilterChange}
                  className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white"
                />
                <input
                  type="date"
                  name="date_to"
                  value={filters.date_to}
                  onChange={handleFilterChange}
                  className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white"
                />
                <button
                  onClick={clearFilters}
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-medium"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Bulk Action Bar */}
          {selectedRecords.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
              <p className="text-xs text-gray-600 font-medium">{selectedRecords.length} selected</p>
              <div className="flex gap-2">
                {showTrash ? (
                  <button
                    onClick={handleBulkRestore}
                    className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs font-medium flex items-center gap-1"
                  >
                    <Undo2 size={14} />
                    Restore Selected
                  </button>
                ) : (
                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium flex items-center gap-1"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Table Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gradient-to-r from-pink-600 to-pink-600 text-white">
                  <tr>
                    <th className="p-2 text-left font-semibold whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedRecords.length === currentRecords.length && currentRecords.length > 0}
                        onChange={handleSelectAll}
                        className="w-3 h-3 rounded cursor-pointer"
                      />
                    </th>
                    <th className="p-2 text-left font-semibold whitespace-nowrap">S.No</th>
                    <th className="p-2 text-left font-semibold whitespace-nowrap">Customer</th>
                    <th className="p-2 text-left font-semibold whitespace-nowrap">Device</th>
                    <th className="p-2 text-left font-semibold whitespace-nowrap">Work Type</th>
                    <th className="p-2 text-left font-semibold whitespace-nowrap">Work Done</th>
                    {showTrash && <th className="p-2 text-left font-semibold whitespace-nowrap">Deleted On</th>}
                    <th className="p-2 text-left font-semibold whitespace-nowrap">Work Date</th>
                    {!showTrash && <th className="p-2 text-left font-semibold whitespace-nowrap">Charges</th>}
                    {!showTrash && <th className="p-2 text-left font-semibold whitespace-nowrap">Status</th>}
                    <th className="p-2 text-center font-semibold whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRecords.length === 0 ? (
                    <tr>
                      <td colSpan={showTrash ? 9 : 10} className="p-8 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle size={32} className="text-gray-400" />
                          <p className="text-sm">
                            {showTrash ? 'No trashed retail records found' : 'No retail records found'}
                          </p>
                          {showTrash && trashedRecords.length === 0 && (
                            <p className="text-xs text-gray-400">Trash is empty. Items are automatically deleted after 7 days</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentRecords.map((record, index) => (
                      <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={selectedRecords.includes(record.id)}
                            onChange={() => toggleRecordSelection(record.id)}
                            className="w-3 h-3 rounded cursor-pointer"
                          />
                        </td>
                        <td className="p-2 text-gray-600 whitespace-nowrap">{indexOfFirstItem + index + 1}</td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{record.customer_name}</div>
                          <div className="text-xs text-gray-500">{record.phone}</div>
                          <div className="text-xs text-gray-500">{record.location}</div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{record.device_type}</div>
                          {record.device_model && (
                            <div className="text-xs text-gray-500">{record.device_model}</div>
                          )}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                            {record.work_type}
                          </span>
                        </td>
                        <td className="p-2">
                          <div className="text-xs text-gray-700">
                            {record.work_description.length > 50
                              ? `${record.work_description.substring(0, 50)}...`
                              : record.work_description}
                            {record.work_description.length > 50 && (
                              <button
                                onClick={() => showNotes(record.work_description)}
                                className="text-pink-600 hover:text-pink-800 text-xs ml-1"
                              >
                                Read more
                              </button>
                            )}
                          </div>
                        </td>
                        {showTrash && (
                          <td className="p-2 whitespace-nowrap">
                            <div className="text-xs text-gray-500">
                              {formatDateTime(record.deleted_at)}
                            </div>
                          </td>
                        )}
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-xs">
                            <div className="text-gray-900">{formatDateToDisplay(record.work_date)}</div>
                            <div className="text-gray-500">By: {record.done_by}</div>
                          </div>
                        </td>
                        {!showTrash && (
                          <>
                            <td className="p-2 whitespace-nowrap">
                              {record.charges_applied === 'Yes' ? (
                                <div className="text-xs">
                                  <div className="font-medium text-green-600">₹{record.amount}</div>
                                  <span className={`px-1 py-0.5 rounded text-xs ${getPaymentColor(record.payment_mode)}`}>
                                    {record.payment_mode}
                                  </span>
                                </div>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                                  Free
                                </span>
                              )}
                            </td>
                            <td className="p-2 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(record.record_status)}`}>
                                {record.record_status}
                              </span>
                            </td>
                          </>
                        )}
                        <td className="p-2 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {showTrash ? (
                              <button
                                onClick={() => handleRestore(record.id)}
                                className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Restore"
                              >
                                <Undo2 size={14} />
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleEdit(record)}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDelete(record.id)}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
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
        </main>

      </div>
    </div>
  );
}