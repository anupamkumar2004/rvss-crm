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
  Eye,
  ChevronLeft,
  ChevronRight,
  Undo2
} from 'lucide-react';

// ============================================
// INTERFACES
// ============================================

interface AMC {
  id: number;
  user_id?: string;
  customer_name: string;
  phone: string;
  location: string;
  amc_type: 'CCTV' | 'Biometric' | 'Access Control' | 'Automation';
  amc_category: 'Comprehensive' | 'Non-comprehensive';
  invoice_number: string;
  scope_of_work: string;
  start_date: string;
  end_date: string;
  duration: number;
  amc_status: 'Active' | 'Expired' | 'Upcoming';
  covered_devices: string;
  serial_numbers: string;
  total_visits_allowed: number;
  visits_used: number;
  last_service_date: string;
  next_service_due: string;
  assigned_engineer: string;
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
  amc_type: 'CCTV' | 'Biometric' | 'Access Control' | 'Automation';
  amc_category: 'Comprehensive' | 'Non-comprehensive';
  invoice_number: string;
  scope_of_work: string;
  start_date: string;
  duration: string;
  covered_devices: string;
  serial_numbers: string;
  remarks: string;
}

interface Filters {
  amc_status: string;
  customer_name: string;
  date_from: string;
  date_to: string;
  amc_type: string;
  amc_category: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AMCPage() {
  const [showTrash, setShowTrash] = useState(false);
  const [trashedAMCs, setTrashedAMCs] = useState<AMC[]>([]);
  const supabase = createClient();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState('');
  const [editingAMC, setEditingAMC] = useState<AMC | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAMCs, setSelectedAMCs] = useState<number[]>([]);
  const [lastImportedIds, setLastImportedIds] = useState<number[]>([]);

  // PAGINATION STATES
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  const [filters, setFilters] = useState<Filters>({
    amc_status: '',
    customer_name: '',
    date_from: '',
    date_to: '',
    amc_type: '',
    amc_category: ''
  });

  const [amcs, setAmcs] = useState<AMC[]>([]);

  const [formData, setFormData] = useState<FormData>({
    customer_name: '',
    phone: '',
    location: '',
    amc_type: 'CCTV',
    amc_category: 'Comprehensive',
    invoice_number: '',
    scope_of_work: '',
    start_date: '',
    duration: '12',
    covered_devices: '',
    serial_numbers: '',
    remarks: ''
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
    return date.toLocaleString();
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

  const calculateEndDate = (startDate: string, months: number): string => {
    if (!startDate) return '';
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + months);
    return date.toISOString().split('T')[0];
  };

  const calculateAMCStatus = (startDate: string, endDate: string): 'Active' | 'Expired' | 'Upcoming' => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (now < start) return 'Upcoming';
    if (now > end) return 'Expired';
    return 'Active';
  };

  // ============================================
  // DATA FETCHING - AUTO DELETE OLD RECORDS
  // ============================================

  useEffect(() => {
    if (mounted) {
      fetchAMCs();
      autoDeleteOldRecords();
    }
  }, [mounted]);

  const fetchAMCs = async () => {
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

      // ✅ 2. Fetch ACTIVE AMCs (deleted = false)
      const { data: activeData, error: activeError } = await supabase
        .from('amc')
        .select('*')
        .eq('user_id', user.id)
        .eq('deleted', false)
        .order('created_at', { ascending: false });

      if (activeError) throw activeError;

      setAmcs(activeData || []);

      // ✅ 3. Fetch TRASHED AMCs (deleted = true, last 7 days only)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: trashedData, error: trashedError } = await supabase
        .from('amc')
        .select('*')
        .eq('user_id', user.id)
        .eq('deleted', true)
        .gte('deleted_at', sevenDaysAgo.toISOString())
        .order('deleted_at', { ascending: false });

      if (trashedError) throw trashedError;

      setTrashedAMCs(trashedData || []);

    } catch (error: any) {
      console.error('Error:', error);
      showToast('Failed to fetch AMC records', 'error');
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
        .from('amc')
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
      const dataToExport = (showTrash ? trashedAMCs : amcs).map((amc, index) => ({
        'S.No': index + 1,
        'Customer Name': amc.customer_name,
        'Phone': amc.phone,
        'Location': amc.location,
        'AMC Type': amc.amc_type,
        'AMC Category': amc.amc_category,
        'Invoice Number': amc.invoice_number,
        'Start Date': amc.start_date,
        'End Date': amc.end_date,
        'Duration': amc.duration,
        'Status': amc.amc_status,
        'Scope of Work': amc.scope_of_work,
        'Covered Devices': amc.covered_devices,
        'Total Visits': amc.total_visits_allowed,
        'Visits Used': amc.visits_used,
        'Assigned Engineer': amc.assigned_engineer || '',
        'Deleted At': amc.deleted_at || '',
        'Last Updated': amc.last_updated || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, showTrash ? 'Trashed AMC Records' : 'AMC Records');
      worksheet['!cols'] = Array(15).fill({ wch: 15 });
      XLSX.writeFile(workbook, `${showTrash ? 'Trashed_' : ''}AMC_Records_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast(`Exported ${dataToExport.length} AMC records`, 'success');
    } catch (error) {
      showToast('Export failed', 'error');
    }
  };

  const handleExportCSV = () => {
    try {
      const dataToExport = (showTrash ? trashedAMCs : amcs).map((amc, index) => ({
        'S.No': index + 1,
        'Customer': amc.customer_name,
        'Phone': amc.phone,
        'Type': amc.amc_type,
        'Category': amc.amc_category,
        'Invoice': amc.invoice_number,
        'Status': amc.amc_status,
        'Deleted At': amc.deleted_at || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${showTrash ? 'Trashed_' : ''}AMC_Records_${new Date().toISOString().split('T')[0]}.csv`;
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

          const amcsToImport = data.map((row: any) => {
            const normalized: any = {};
            Object.keys(row).forEach(key => {
              normalized[key.toLowerCase().trim().replace(/\s+/g, '_')] = row[key];
            });

            const startDate = normalized['start_date'] || new Date().toISOString().split('T')[0];
            const duration = parseInt(normalized['duration']) || 12;
            const endDate = calculateEndDate(startDate, duration);

            return {
              user_id: user.id,
              customer_name: normalized['customer_name'] || normalized['customer'] || '',
              phone: String(normalized['phone'] || ''),
              location: normalized['location'] || '',
              amc_type: ['CCTV', 'Biometric', 'Access Control', 'Automation'].includes(normalized['amc_type'])
                ? normalized['amc_type']
                : 'CCTV',
              amc_category: ['Comprehensive', 'Non-comprehensive'].includes(normalized['amc_category'])
                ? normalized['amc_category']
                : 'Comprehensive',
              invoice_number: normalized['invoice_number'] || normalized['invoice'] || '',
              scope_of_work: normalized['scope_of_work'] || 'Maintenance',
              start_date: startDate,
              end_date: endDate,
              duration: duration,
              amc_status: calculateAMCStatus(startDate, endDate),
              covered_devices: normalized['covered_devices'] || '',
              serial_numbers: normalized['serial_numbers'] || '',
              total_visits_allowed: parseInt(normalized['total_visits']) || 4,
              visits_used: parseInt(normalized['visits_used']) || 0,
              last_service_date: normalized['last_service_date'] || '',
              next_service_due: normalized['next_service_due'] || '',
              assigned_engineer: normalized['assigned_engineer'] || '',
              remarks: normalized['remarks'] || '',
              last_updated: new Date().toISOString().split('T')[0],
              deleted: false,
              deleted_at: null
            };
          }).filter(amc => amc.customer_name && amc.phone);

          if (amcsToImport.length === 0) {
            showToast('No valid records found', 'warning');
            e.target.value = '';
            return;
          }

          const { data: insertedData, error } = await supabase
            .from('amc')
            .insert(amcsToImport)
            .select('id');

          if (error) throw error;

          const importedIds = insertedData?.map(item => item.id) || [];
          setLastImportedIds(importedIds);
          await fetchAMCs();
          showToast(`Imported ${amcsToImport.length} records!`, 'success');
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
        const { error } = await supabase.from('amc').delete().in('id', lastImportedIds);
        if (error) throw error;
        await fetchAMCs();
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

      if (!formData.customer_name || !formData.phone || !formData.location || !formData.invoice_number) {
        showToast('Please fill all required fields', 'error');
        return;
      }

      if (!formData.start_date || !formData.scope_of_work || !formData.covered_devices) {
        showToast('Please fill all required fields', 'error');
        return;
      }

      const duration = parseInt(formData.duration) || 12;
      const endDate = calculateEndDate(formData.start_date, duration);
      const amcStatus = calculateAMCStatus(formData.start_date, endDate);

      const amcData = {
        user_id: user.id,
        customer_name: formData.customer_name.trim(),
        phone: formData.phone.trim(),
        location: formData.location.trim(),
        amc_type: formData.amc_type,
        amc_category: formData.amc_category,
        invoice_number: formData.invoice_number.trim(),
        scope_of_work: formData.scope_of_work.trim(),
        start_date: formData.start_date,
        end_date: endDate,
        duration: duration,
        amc_status: amcStatus,
        covered_devices: formData.covered_devices.trim(),
        serial_numbers: formData.serial_numbers?.trim() || '',
        remarks: formData.remarks?.trim() || '',
        last_updated: new Date().toISOString().split('T')[0],
        deleted: false,
        deleted_at: null
      };

      if (editingAMC) {
        const { error } = await supabase.from('amc').update(amcData).eq('id', editingAMC.id).eq('user_id', user.id);
        if (error) throw error;
        showToast('AMC updated!', 'success');
      } else {
        const { error } = await supabase.from('amc').insert([amcData]);
        if (error) throw error;
        showToast('AMC added!', 'success');
      }

      await fetchAMCs();
      setShowModal(false);
      setEditingAMC(null);
      setFormData({
        customer_name: '', phone: '', location: '', amc_type: 'CCTV', amc_category: 'Comprehensive',
        invoice_number: '', scope_of_work: '', start_date: '', duration: '12', covered_devices: '',
        serial_numbers: '', remarks: ''
      });
    } catch (error: any) {
      showToast(`Save failed: ${error?.message || 'Unknown error'}`, 'error');
    }
  };

  const handleEdit = (amc: AMC) => {
    setEditingAMC(amc);
    setFormData({
      customer_name: amc.customer_name,
      phone: amc.phone,
      location: amc.location,
      amc_type: amc.amc_type,
      amc_category: amc.amc_category,
      invoice_number: amc.invoice_number,
      scope_of_work: amc.scope_of_work,
      start_date: amc.start_date,
      duration: amc.duration.toString(),
      covered_devices: amc.covered_devices,
      serial_numbers: amc.serial_numbers || '',
      remarks: amc.remarks || ''
    });
    setShowModal(true);
  };

  // SOFT DELETE - Mark as deleted for 7 days before auto-deletion
  const handleDelete = async (id: number) => {
    showConfirm('Delete this AMC? (Will be permanently removed in 7 days)', async () => {
      try {
        const { error } = await supabase
          .from('amc')
          .update({ deleted: true, deleted_at: new Date().toISOString() })
          .eq('id', id);

        if (error) throw error;
        await fetchAMCs();
        showToast('Deleted (will be removed in 7 days)', 'success');
      } catch (error) {
        showToast('Delete failed', 'error');
      }
    });
  };

  // RESTORE FROM TRASH
  const handleRestore = async (id: number) => {
    showConfirm('Restore this AMC from trash?', async () => {
      try {
        const { error } = await supabase
          .from('amc')
          .update({
            deleted: false,
            deleted_at: null,
            last_updated: new Date().toISOString().split('T')[0]
          })
          .eq('id', id);

        if (error) throw error;
        await fetchAMCs();
        showToast('AMC restored successfully!', 'success');
      } catch (error) {
        showToast('Restore failed', 'error');
      }
    });
  };



  // ============================================
  // BULK OPERATIONS
  // ============================================

  const handleBulkDelete = async () => {
    if (selectedAMCs.length === 0) {
      showToast('No records selected', 'warning');
      return;
    }

    showConfirm(`Delete ${selectedAMCs.length} records? (Will be permanently removed in 7 days)`, async () => {
      try {
        const { error } = await supabase
          .from('amc')
          .update({ deleted: true, deleted_at: new Date().toISOString() })
          .in('id', selectedAMCs);

        if (error) throw error;
        await fetchAMCs();
        setSelectedAMCs([]);
        showToast(`${selectedAMCs.length} records deleted`, 'success');
      } catch (error) {
        showToast('Delete failed', 'error');
      }
    });
  };

  const handleBulkRestore = async () => {
    if (selectedAMCs.length === 0) {
      showToast('No records selected', 'warning');
      return;
    }

    showConfirm(`Restore ${selectedAMCs.length} records from trash?`, async () => {
      try {
        const { error } = await supabase
          .from('amc')
          .update({
            deleted: false,
            deleted_at: null,
            last_updated: new Date().toISOString().split('T')[0]
          })
          .in('id', selectedAMCs);

        if (error) throw error;
        await fetchAMCs();
        setSelectedAMCs([]);
        showToast(`${selectedAMCs.length} records restored`, 'success');
      } catch (error) {
        showToast('Restore failed', 'error');
      }
    });
  };



  const handleSelectAll = () => {
    const currentDataSource = showTrash ? trashedAMCs : amcs;
    const currentFiltered = showTrash ? filteredTrashAMCs : filteredAMCs;
    const currentPageItems = currentFiltered.slice(indexOfFirstItem, indexOfLastItem);

    if (selectedAMCs.length === currentPageItems.length) {
      setSelectedAMCs([]);
    } else {
      setSelectedAMCs(currentPageItems.map(amc => amc.id));
    }
  };

  const toggleAMCSelection = (id: number) => {
    setSelectedAMCs(prev => prev.includes(id) ? prev.filter(amcId => amcId !== id) : [...prev, id]);
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
      amc_status: '', customer_name: '', date_from: '', date_to: '', amc_type: '', amc_category: ''
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
      'Active': 'bg-green-50 text-green-700 border border-green-200',
      'Expired': 'bg-red-50 text-red-700 border border-red-200',
      'Upcoming': 'bg-blue-50 text-blue-700 border border-blue-200'
    };
    return colors[status] || 'bg-gray-50 text-gray-700 border border-gray-200';
  };

  const getCategoryColor = (category: string) => {
    return category === 'Comprehensive'
      ? 'bg-purple-50 text-purple-700 border border-purple-200'
      : 'bg-yellow-50 text-yellow-700 border border-yellow-200';
  };

  // ============================================
  // FILTERING AND CALCULATIONS
  // ============================================

  // Filter active AMCs
  const filteredAMCs = amcs.filter(amc => {
    const matchesSearch = amc.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      amc.phone.includes(searchTerm) || amc.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      amc.amc_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      amc.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (amc.assigned_engineer && amc.assigned_engineer.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (filters.amc_status && amc.amc_status !== filters.amc_status) return false;
    if (filters.customer_name && !amc.customer_name.toLowerCase().includes(filters.customer_name.toLowerCase())) return false;
    if (filters.date_from && amc.start_date < filters.date_from) return false;
    if (filters.date_to && amc.end_date > filters.date_to) return false;
    if (filters.amc_type && amc.amc_type !== filters.amc_type) return false;
    if (filters.amc_category && amc.amc_category !== filters.amc_category) return false;
    return true;
  });

  // Filter trashed AMCs
  const filteredTrashAMCs = trashedAMCs.filter(amc => {
    const matchesSearch = amc.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      amc.phone.includes(searchTerm) || amc.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      amc.amc_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      amc.invoice_number.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (filters.customer_name && !amc.customer_name.toLowerCase().includes(filters.customer_name.toLowerCase())) return false;
    if (filters.date_from && amc.start_date < filters.date_from) return false;
    if (filters.date_to && amc.end_date > filters.date_to) return false;
    if (filters.amc_type && amc.amc_type !== filters.amc_type) return false;
    if (filters.amc_category && amc.amc_category !== filters.amc_category) return false;
    return true;
  });

  // ============================================
  // PAGINATION LOGIC
  // ============================================

  const currentDataSource = showTrash ? filteredTrashAMCs : filteredAMCs;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentRecords = currentDataSource.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(currentDataSource.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters.customer_name, filters.amc_status, filters.date_from, filters.date_to, filters.amc_type, filters.amc_category, showTrash]);

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
                ? 'bg-orange-600 text-white border-orange-600'
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

  const activeCount = amcs.filter(a => a.amc_status === 'Active').length;
  const expiredCount = amcs.filter(a => a.amc_status === 'Expired').length;
  const comprehensiveCount = amcs.filter(a => a.amc_category === 'Comprehensive').length;
  const totalContracts = amcs.length;

  if (!mounted) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading AMC records...</p>
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
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="text-orange-600" size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Confirm Action</h3>
                </div>
                <p className="text-gray-600 mb-6">{confirmAction?.message}</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleConfirm}
                    className="flex-1 bg-gradient-to-r from-orange-600 to-orange-600 hover:from-orange-700 hover:to-orange-700 text-white px-4 py-2 rounded-lg font-medium transition-all"
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
              <div className="bg-gradient-to-r from-orange-600 to-orange-600 text-white p-4 rounded-t-xl flex items-center justify-between">
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

      {/* Add/Edit AMC Modal */}
      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[90]" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[90] pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto">
              <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-orange-600 text-white p-4 rounded-t-xl flex items-center justify-between">
                <h3 className="text-xl font-bold">{editingAMC ? 'Edit AMC' : 'Add New AMC'}</h3>
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
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500 placeholder-gray-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500 placeholder-gray-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500 placeholder-gray-500"
                      placeholder="Enter location/address"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number *</label>
                    <input
                      type="text"
                      name="invoice_number"
                      value={formData.invoice_number}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500 placeholder-gray-500"
                      placeholder="Enter invoice number"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">AMC Type *</label>
                    <select
                      name="amc_type"
                      value={formData.amc_type}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-700"
                    >
                      <option value="CCTV">CCTV</option>
                      <option value="Biometric">Biometric</option>
                      <option value="Access Control">Access Control</option>
                      <option value="Automation">Automation</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">AMC Category *</label>
                    <select
                      name="amc_category"
                      value={formData.amc_category}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-700"
                    >
                      <option value="Comprehensive">Comprehensive</option>
                      <option value="Non-comprehensive">Non-comprehensive</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                    <input
                      type="date"
                      name="start_date"
                      value={formData.start_date}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-700"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duration (months) *</label>
                    <input
                      type="number"
                      name="duration"
                      value={formData.duration}
                      onChange={handleInputChange}
                      min="1"
                      max="60"
                      className="w-full px-3 py-2 border border-gray-300 rounded
           text-gray-900 bg-white
           placeholder-gray-400
           focus:ring-2 focus:ring-orange-500 focus:border-orange-500"

                      placeholder="Select Months"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Scope of Work *</label>
                    <textarea
                      name="scope_of_work"
                      value={formData.scope_of_work}
                      onChange={handleInputChange}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500 placeholder-gray-500"
                      placeholder="Describe the scope of work/maintenance"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Covered Devices *</label>
                    <textarea
                      name="covered_devices"
                      value={formData.covered_devices}
                      onChange={handleInputChange}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500 placeholder-gray-500"
                      placeholder="List the devices covered under AMC"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Serial Numbers</label>
                    <textarea
                      name="serial_numbers"
                      value={formData.serial_numbers}
                      onChange={handleInputChange}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500 placeholder-gray-500"
                      placeholder="Enter serial numbers separated by commas"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                    <textarea
                      name="remarks"
                      value={formData.remarks}
                      onChange={handleInputChange}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500 placeholder-gray-500"
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
                    className="px-6 py-2 bg-gradient-to-r from-orange-600 to-orange-600 hover:from-orange-700 hover:to-orange-700 text-white rounded-lg font-medium transition-all"
                  >
                    {editingAMC ? 'Update AMC' : 'Add AMC'}
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
              {showTrash ? '🗑️ AMC Trash' : '🔧 AMC Management'}
            </h2>
            {showTrash && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                {trashedAMCs.length} items in trash (Auto-deletes in 7 days)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!showTrash && (
              <button
                onClick={() => {
                  setShowModal(true);
                  setEditingAMC(null);
                  setFormData({
                    customer_name: '', phone: '', location: '', amc_type: 'CCTV', amc_category: 'Comprehensive',
                    invoice_number: '', scope_of_work: '', start_date: '', duration: '12', covered_devices: '',
                    serial_numbers: '', remarks: ''
                  });
                }}
                className="bg-gradient-to-r from-orange-600 to-orange-600 hover:from-orange-700 hover:to-orange-700 text-white px-3 py-1.5 rounded-lg font-medium shadow-md transition-all flex items-center gap-1.5 text-sm"
              >
                <Plus size={16} />
                <span>Add AMC</span>
              </button>
            )}
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-3 lg:p-4">

          {/* Stats Cards (Only show when not in trash) */}
          {!showTrash && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-3 shadow-md text-white">
                <p className="text-xs opacity-90 font-medium mb-1">Active AMCs</p>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs opacity-75 mt-1">{totalContracts} total</p>
              </div>
              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-3 shadow-md text-white">
                <p className="text-xs opacity-90 font-medium mb-1">Expired AMCs</p>
                <p className="text-2xl font-bold">{expiredCount}</p>
                <p className="text-xs opacity-75 mt-1">Renewal required</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-3 shadow-md text-white">
                <p className="text-xs opacity-90 font-medium mb-1">Comprehensive</p>
                <p className="text-2xl font-bold">{comprehensiveCount}</p>
                <p className="text-xs opacity-75 mt-1">Full coverage</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-3 shadow-md text-white">
                <p className="text-xs opacity-90 font-medium mb-1">Total Contracts</p>
                <p className="text-2xl font-bold">{totalContracts}</p>
                <p className="text-xs opacity-75 mt-1">All AMCs</p>
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
                    placeholder={`Search ${showTrash ? 'trash' : 'AMCs'}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded text-sm
               focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-800"
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
                      <span>Back to AMCs</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={18} />
                      <span>Trash ({trashedAMCs.length})</span>
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
                <select
                  name="amc_status"
                  value={filters.amc_status}
                  onChange={handleFilterChange}
                  className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white"
                >
                  <option value="">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Expired">Expired</option>
                  <option value="Upcoming">Upcoming</option>
                </select>
                <input
                  type="text"
                  name="customer_name"
                  placeholder="Customer"
                  value={filters.customer_name}
                  onChange={handleFilterChange}
                  className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white"
                />
                <select
                  name="amc_type"
                  value={filters.amc_type}
                  onChange={handleFilterChange}
                  className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white"
                >
                  <option value="">All Types</option>
                  <option value="CCTV">CCTV</option>
                  <option value="Biometric">Biometric</option>
                  <option value="Access Control">Access Control</option>
                  <option value="Automation">Automation</option>
                </select>
                <select
                  name="amc_category"
                  value={filters.amc_category}
                  onChange={handleFilterChange}
                  className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white"
                >
                  <option value="">All Categories</option>
                  <option value="Comprehensive">Comprehensive</option>
                  <option value="Non-comprehensive">Non-comprehensive</option>
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
          {selectedAMCs.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
              <p className="text-xs text-gray-600 font-medium">{selectedAMCs.length} selected</p>
              <div className="flex gap-2">
                {showTrash ? (
                  <>
                    <button
                      onClick={handleBulkRestore}
                      className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs font-medium flex items-center gap-1"
                    >
                      <Undo2 size={14} />
                      Restore Selected
                    </button>
                  </>
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
                <thead className="bg-gradient-to-r from-orange-600 to-orange-600 text-white">
                  <tr>
                    <th className="p-2 text-left font-semibold whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedAMCs.length === currentRecords.length && currentRecords.length > 0}
                        onChange={handleSelectAll}
                        className="w-3 h-3 rounded cursor-pointer"
                      />
                    </th>
                    <th className="p-2 text-left font-semibold whitespace-nowrap">S.No</th>
                    <th className="p-2 text-left font-semibold whitespace-nowrap">Customer</th>
                    <th className="p-2 text-left font-semibold whitespace-nowrap">Invoice #</th>
                    <th className="p-2 text-left font-semibold whitespace-nowrap">AMC Type</th>
                    <th className="p-2 text-left font-semibold whitespace-nowrap">Category</th>
                    {showTrash && <th className="p-2 text-left font-semibold whitespace-nowrap">Deleted On</th>}
                    <th className="p-2 text-left font-semibold whitespace-nowrap">Contract Period</th>
                    {!showTrash && <th className="p-2 text-left font-semibold whitespace-nowrap">Status</th>}
                    <th className="p-2 text-center font-semibold whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRecords.length === 0 ? (
                    <tr>
                      <td colSpan={showTrash ? 10 : 9} className="p-8 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle size={32} className="text-gray-400" />
                          <p className="text-sm">
                            {showTrash ? 'No trashed AMC records found' : 'No AMC records found'}
                          </p>
                          {showTrash && trashedAMCs.length === 0 && (
                            <p className="text-xs text-gray-400">Trash is empty. Items are automatically deleted after 7 days</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentRecords.map((amc, index) => (
                      <tr key={amc.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={selectedAMCs.includes(amc.id)}
                            onChange={() => toggleAMCSelection(amc.id)}
                            className="w-3 h-3 rounded cursor-pointer"
                          />
                        </td>
                        <td className="p-2 text-gray-600 whitespace-nowrap">{indexOfFirstItem + index + 1}</td>
                        <td className="p-2 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{amc.customer_name}</div>
                          <div className="text-xs text-gray-500">{amc.phone}</div>
                          <div className="text-xs text-gray-500">{amc.location}</div>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-mono">
                            {amc.invoice_number}
                          </span>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800">
                            {amc.amc_type}
                          </span>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(amc.amc_category)}`}>
                            {amc.amc_category}
                          </span>
                        </td>
                        {showTrash && (
                          <td className="p-2 whitespace-nowrap">
                            <div className="text-xs text-gray-500">
                              {formatDateTime(amc.deleted_at)}
                            </div>
                          </td>
                        )}
                        <td className="p-2 whitespace-nowrap">
                          <div className="text-xs">
                            <div className="text-gray-900">{formatDateToDisplay(amc.start_date)}</div>
                            <div className="text-gray-500">to {formatDateToDisplay(amc.end_date)}</div>
                            <div className="text-gray-500">{amc.duration} months</div>
                          </div>
                        </td>
                        {!showTrash && (
                          <td className="p-2 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(amc.amc_status)}`}>
                              {amc.amc_status}
                            </span>
                          </td>
                        )}
                        <td className="p-2 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {showTrash ? (
                              <>
                                <button
                                  onClick={() => handleRestore(amc.id)}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                                  title="Restore"
                                >
                                  <Undo2 size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleEdit(amc)}
                                  className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDelete(amc.id)}
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