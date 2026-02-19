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
  Undo2,
  Wrench,
  Package,
  Clock,
  Truck,
  AlertTriangle,
  MessageSquare,
  Check,
  Hash,
  Percent
} from 'lucide-react';

// ============================================
// INTERFACES - UPDATED WITH CUSTOM STATUS/ISSUE
// ============================================

interface Service {
  id: number;
  user_id?: string;
  customer_name: string;
  phone: string;
  date_received: string;
  received_by: string;
  device_name: string;
  serial_number: string;
  device_type: 'CCTV' | 'Biometric' | 'Gate' | 'Access Control' | 'Other';

  // UPDATED ACCESSORIES CHECKLIST
  has_device: boolean;
  has_adapter: boolean;
  has_power_connector: boolean;
  has_access_connector: boolean;
  has_rfid_card: boolean;
  has_original_box: boolean;
  has_mounting_plate: boolean;

  accessories_missing: boolean;
  missing_accessories_details: string | null; // Can be null
  issue_type: string;
  detailed_remarks: string | null; // Can be null
  status: string;
  expected_delivery_date: string | null; // Can be null
  delivered_date: string | null; // Can be null
  delivered_to: string | null; // Can be null
  final_remarks: string | null; // Can be null
  last_updated: string;
  deleted: boolean;
  deleted_at: string | null;
  created_at?: string;
}
interface FormData {

  customer_name: string;
  phone: string;
  date_received: string;
  received_by: string;
  device_name: string;
  serial_number: string;
  device_type: 'CCTV' | 'Biometric' | 'Gate' | 'Access Control' | 'Other';

  // UPDATED ACCESSORIES CHECKLIST
  has_device: boolean;
  has_adapter: boolean;
  has_power_connector: boolean;
  has_access_connector: boolean;
  has_rfid_card: boolean;
  has_original_box: boolean;
  has_mounting_plate: boolean;

  accessories_missing: boolean;
  missing_accessories_details: string; // Not optional
  issue_type: string;
  detailed_remarks: string; // Not optional
  status: string;
  expected_delivery_date: string; // Not optional
  delivered_date: string; // Not optional
  delivered_to: string; // Not optional
  final_remarks: string; // Not optional

}
interface Filters {
  status: string;
  accessories_missing: string;
  date_from: string;
  date_to: string;
  device_type: string;
  customer_name: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

// ============================================
// MAIN COMPONENT - AMC STYLE UI
// ============================================

export default function ServiceDevicePage() {
  const [showTrash, setShowTrash] = useState(false);
  const [trashedServices, setTrashedServices] = useState<Service[]>([]);
  const supabase = createClient();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState('');
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [lastImportedIds, setLastImportedIds] = useState<number[]>([]);

  // PAGINATION STATES
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // CUSTOM STATUS AND ISSUE TYPES
  const [customStatuses, setCustomStatuses] = useState<string[]>([
    'Received', 'Under Checking', 'In Repair', 'Ready for Delivery', 'Delivered Back'
  ]);

  const [customIssueTypes, setCustomIssueTypes] = useState<string[]>([
    'Not Working', 'Physical Damage', 'Configuration', 'Software', 'Other'
  ]);

  const [newCustomStatus, setNewCustomStatus] = useState('');
  const [newCustomIssue, setNewCustomIssue] = useState('');

  const [filters, setFilters] = useState<Filters>({
    status: '',
    accessories_missing: '',
    date_from: '',
    date_to: '',
    device_type: '',
    customer_name: ''
  });

  const [services, setServices] = useState<Service[]>([]);

  // UPDATED FORM DATA WITH NEW ACCESSORIES
  const [formData, setFormData] = useState<FormData>({
    customer_name: '',
    phone: '',
    date_received: new Date().toISOString().split('T')[0],
    received_by: '',
    device_name: '',
    serial_number: '',
    device_type: 'Biometric',

    // UPDATED ACCESSORIES - DEFAULT TO TRUE FOR DEVICE
    has_device: true,
    has_adapter: false,
    has_power_connector: false,
    has_access_connector: false,
    has_rfid_card: false,
    has_original_box: false,
    has_mounting_plate: false,

    accessories_missing: false,
    missing_accessories_details: '',
    issue_type: 'Not Working',
    detailed_remarks: '',
    status: 'Received',
    expected_delivery_date: '',
    delivered_date: '',
    delivered_to: '',
    final_remarks: ''
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

  // ============================================
  // CUSTOM STATUS/ISSUE MANAGEMENT
  // ============================================

  const addCustomStatus = () => {
    if (newCustomStatus.trim() && !customStatuses.includes(newCustomStatus.trim())) {
      setCustomStatuses(prev => [...prev, newCustomStatus.trim()]);
      setFormData(prev => ({ ...prev, status: newCustomStatus.trim() }));
      setNewCustomStatus('');
      showToast(`Added new status: ${newCustomStatus.trim()}`, 'success');
    }
  };

  const addCustomIssue = () => {
    if (newCustomIssue.trim() && !customIssueTypes.includes(newCustomIssue.trim())) {
      setCustomIssueTypes(prev => [...prev, newCustomIssue.trim()]);
      setFormData(prev => ({ ...prev, issue_type: newCustomIssue.trim() }));
      setNewCustomIssue('');
      showToast(`Added new issue type: ${newCustomIssue.trim()}`, 'success');
    }
  };

  // ============================================
  // DATA FETCHING - AUTO DELETE OLD RECORDS
  // ============================================

  useEffect(() => {
    if (mounted) {
      fetchServices();
      autoDeleteOldRecords();
    }
  }, [mounted]);

  const fetchServices = async () => {
    try {
      setLoading(true);

      // Get logged-in user
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error('Auth error:', userError);
        showToast('Please login to continue', 'error');
        router.push('/login');
        return;
      }

      // Fetch ACTIVE Services
      const { data: activeData, error: activeError } = await supabase
        .from('service_devices')
        .select('*')
        .eq('user_id', user.id)
        .eq('deleted', false)
        .order('date_received', { ascending: false });

      if (activeError) throw activeError;

      setServices(activeData || []);

      // Fetch TRASHED Services (last 7 days only)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: trashedData, error: trashedError } = await supabase
        .from('service_devices')
        .select('*')
        .eq('user_id', user.id)
        .eq('deleted', true)
        .gte('deleted_at', sevenDaysAgo.toISOString())
        .order('deleted_at', { ascending: false });

      if (trashedError) throw trashedError;

      setTrashedServices(trashedData || []);

    } catch (error: any) {
      console.error('Error:', error);
      showToast('Failed to fetch service records', 'error');
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
        .from('service_devices')
        .delete()
        .eq('user_id', user.id)
        .eq('deleted', true)
        .lt('deleted_at', sevenDaysAgo.toISOString());

      if (error) {
        console.error('Auto-delete error:', error);
      }
    } catch (error) {
      console.error('Auto-delete error:', error);
    }
  };

  // ============================================
  // ACCESSORIES COUNT FUNCTION
  // ============================================

  const countAccessories = (service: Service) => {
    const accessories = [
      service.has_adapter,
      service.has_power_connector,
      service.has_access_connector,
      service.has_rfid_card,
      service.has_original_box,
      service.has_mounting_plate,
    ];
    const presentCount = accessories.filter(Boolean).length;
    const total = accessories.length;
    return { present: presentCount, total, percentage: Math.round((presentCount / total) * 100) };
  };

  const countAllAccessories = (item: Service | FormData) => {
    const accessories = [
      item.has_device,
      item.has_adapter,
      item.has_power_connector,
      item.has_access_connector,
      item.has_rfid_card,
      item.has_original_box,
      item.has_mounting_plate,
    ];
    const presentCount = accessories.filter(Boolean).length;
    const total = accessories.length;
    return { present: presentCount, total, percentage: Math.round((presentCount / total) * 100) };
  };
  // ============================================
  // EXPORT FUNCTIONS
  // ============================================

  const handleExportExcel = () => {
    try {
      const dataToExport = (showTrash ? trashedServices : services).map((service, index) => ({
        'S.No': index + 1,
        'Customer Name': service.customer_name,
        'Phone': service.phone,
        'Date Received': service.date_received,
        'Received By': service.received_by,
        'Device Name': service.device_name,
        'Serial Number': service.serial_number,
        'Device Type': service.device_type,

        // UPDATED ACCESSORIES EXPORT
        'Device Present': service.has_device ? 'Yes' : 'No',
        'Adapter/Power Supply': service.has_adapter ? 'Yes' : 'No',
        'Power Connector': service.has_power_connector ? 'Yes' : 'No',
        'Access Connector': service.has_access_connector ? 'Yes' : 'No',
        'RFID Card': service.has_rfid_card ? 'Yes' : 'No',
        'Original Box': service.has_original_box ? 'Yes' : 'No',
        'Mounting Plate': service.has_mounting_plate ? 'Yes' : 'No',
        'Accessories Count': `${countAccessories(service).present}/${countAccessories(service).total}`,

        'Accessories Missing': service.accessories_missing ? 'Yes' : 'No',
        'Missing Details': service.missing_accessories_details || '',
        'Issue Type': service.issue_type,
        'Detailed Remarks': service.detailed_remarks || '',
        'Status': service.status,
        'Expected Delivery': service.expected_delivery_date || '',
        'Delivered Date': service.delivered_date || '',
        'Delivered To': service.delivered_to || '',
        'Final Remarks': service.final_remarks || '',
        'Deleted At': service.deleted_at || '',
        'Last Updated': service.last_updated || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, showTrash ? 'Trashed Service Records' : 'Service Records');
      worksheet['!cols'] = Array(25).fill({ wch: 15 });
      XLSX.writeFile(workbook, `${showTrash ? 'Trashed_' : ''}Service_Records_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast(`Exported ${dataToExport.length} service records`, 'success');
    } catch (error) {
      showToast('Export failed', 'error');
    }
  };

  const handleExportCSV = () => {
    try {
      const dataToExport = (showTrash ? trashedServices : services).map((service, index) => ({
        'S.No': index + 1,
        'Customer': service.customer_name,
        'Phone': service.phone,
        'Device': service.device_name,
        'Serial': service.serial_number,
        'Type': service.device_type,
        'Accessories': `${countAccessories(service).present}/${countAccessories(service).total}`,
        'Status': service.status,
        'Deleted At': service.deleted_at || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${showTrash ? 'Trashed_' : ''}Service_Records_${new Date().toISOString().split('T')[0]}.csv`;
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

          const servicesToImport = data.map((row: any) => {
            const normalized: any = {};
            Object.keys(row).forEach(key => {
              normalized[key.toLowerCase().trim().replace(/\s+/g, '_')] = row[key];
            });

            return {
              user_id: user.id,
              customer_name: normalized['customer_name'] || normalized['customer'] || '',
              phone: String(normalized['phone'] || ''),
              date_received: normalized['date_received'] || new Date().toISOString().split('T')[0],
              received_by: normalized['received_by'] || '',
              device_name: normalized['device_name'] || '',
              serial_number: normalized['serial_number'] || '',
              device_type: ['CCTV', 'Biometric', 'Gate', 'Access Control', 'Other'].includes(normalized['device_type'])
                ? normalized['device_type']
                : 'Other',

              // UPDATED ACCESSORIES IMPORT
              has_device: normalized['device_present'] === 'Yes',
              has_adapter: normalized['adapter_power_supply'] === 'Yes',
              has_power_connector: normalized['power_connector'] === 'Yes',
              has_access_connector: normalized['access_connector'] === 'Yes',
              has_rfid_card: normalized['rfid_card'] === 'Yes',
              has_original_box: normalized['original_box'] === 'Yes',
              has_mounting_plate: normalized['mounting_plate'] === 'Yes',

              accessories_missing: normalized['accessories_missing'] === 'Yes',
              missing_accessories_details: normalized['missing_details'] || '',
              issue_type: normalized['issue_type'] || 'Not Working',
              detailed_remarks: normalized['detailed_remarks'] || '',
              status: normalized['status'] || 'Received',
              expected_delivery_date: normalized['expected_delivery'] || null,
              delivered_date: normalized['delivered_date'] || null,
              delivered_to: normalized['delivered_to'] || null,
              final_remarks: normalized['final_remarks'] || null,
              last_updated: new Date().toISOString().split('T')[0],
              deleted: false,
              deleted_at: null
            };
          }).filter(service => service.customer_name && service.device_name);

          if (servicesToImport.length === 0) {
            showToast('No valid records found', 'warning');
            e.target.value = '';
            return;
          }

          const { data: insertedData, error } = await supabase
            .from('service_devices')
            .insert(servicesToImport)
            .select('id');

          if (error) throw error;

          const importedIds = insertedData?.map(item => item.id) || [];
          setLastImportedIds(importedIds);
          await fetchServices();
          showToast(`Imported ${servicesToImport.length} records!`, 'success');
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
        const { error } = await supabase.from('service_devices').delete().in('id', lastImportedIds);
        if (error) throw error;
        await fetchServices();
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
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast('Login required', 'error');
        return;
      }

      if (!formData.customer_name || !formData.device_name || !formData.serial_number) {
        showToast('Please fill all required fields', 'error');
        return;
      }

      // Add custom status and issue type to arrays if they don't exist
      if (formData.status && !customStatuses.includes(formData.status)) {
        setCustomStatuses(prev => [...prev, formData.status]);
      }

      if (formData.issue_type && !customIssueTypes.includes(formData.issue_type)) {
        setCustomIssueTypes(prev => [...prev, formData.issue_type]);
      }

      const serviceData = {
        user_id: user.id,
        customer_name: formData.customer_name.trim(),
        phone: formData.phone.trim(),
        date_received: formData.date_received,
        received_by: formData.received_by.trim(),
        device_name: formData.device_name.trim(),
        serial_number: formData.serial_number.trim(),
        device_type: formData.device_type,

        // UPDATED ACCESSORIES
        has_device: formData.has_device,
        has_adapter: formData.has_adapter,
        has_power_connector: formData.has_power_connector,
        has_access_connector: formData.has_access_connector,
        has_rfid_card: formData.has_rfid_card,
        has_original_box: formData.has_original_box,
        has_mounting_plate: formData.has_mounting_plate,

        accessories_missing: formData.accessories_missing,
        missing_accessories_details: formData.missing_accessories_details?.trim() || null,
        issue_type: formData.issue_type,
        detailed_remarks: formData.detailed_remarks?.trim() || null,
        status: formData.status,
        expected_delivery_date: formData.expected_delivery_date || null,
        delivered_date: formData.delivered_date || null,
        delivered_to: formData.delivered_to?.trim() || null,
        final_remarks: formData.final_remarks?.trim() || null,
        last_updated: new Date().toISOString().split('T')[0],
        deleted: false,
        deleted_at: null
      };

      if (editingService) {
        const { error } = await supabase.from('service_devices').update(serviceData).eq('id', editingService.id).eq('user_id', user.id);
        if (error) throw error;
        showToast('Service record updated!', 'success');
      } else {
        const { error } = await supabase.from('service_devices').insert([serviceData]);
        if (error) throw error;
        showToast('Device received successfully!', 'success');
      }

      await fetchServices();
      setShowModal(false);
      setEditingService(null);
      resetFormData();
    } catch (error: any) {
      showToast(`Save failed: ${error?.message || 'Unknown error'}`, 'error');
    }
  };

  const resetFormData = () => {
    setFormData({
      customer_name: '',
      phone: '',
      date_received: new Date().toISOString().split('T')[0],
      received_by: '',
      device_name: '',
      serial_number: '',
      device_type: 'Biometric',
      has_device: true,
      has_adapter: false,
      has_power_connector: false,
      has_access_connector: false,
      has_rfid_card: false,
      has_original_box: false,
      has_mounting_plate: false,
      accessories_missing: false,
      missing_accessories_details: '',
      issue_type: 'Not Working',
      detailed_remarks: '',
      status: 'Received',
      expected_delivery_date: '',
      delivered_date: '',
      delivered_to: '',
      final_remarks: ''
    });
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      customer_name: service.customer_name,
      phone: service.phone,
      date_received: service.date_received,
      received_by: service.received_by,
      device_name: service.device_name,
      serial_number: service.serial_number,
      device_type: service.device_type,
      has_device: service.has_device,
      has_adapter: service.has_adapter,
      has_power_connector: service.has_power_connector,
      has_access_connector: service.has_access_connector,
      has_rfid_card: service.has_rfid_card,
      has_original_box: service.has_original_box,
      has_mounting_plate: service.has_mounting_plate,
      accessories_missing: service.accessories_missing,
      missing_accessories_details: service.missing_accessories_details || '', // FIX HERE
      issue_type: service.issue_type,
      detailed_remarks: service.detailed_remarks || '', // FIX HERE
      status: service.status,
      expected_delivery_date: service.expected_delivery_date || '', // FIX HERE
      delivered_date: service.delivered_date || '', // FIX HERE
      delivered_to: service.delivered_to || '', // FIX HERE
      final_remarks: service.final_remarks || '' // FIX HERE
    });
    setShowModal(true);
  };

  // SOFT DELETE - Mark as deleted for 7 days before auto-deletion
  const handleDelete = async (id: number) => {
    showConfirm('Delete this service record? (Will be permanently removed in 7 days)', async () => {
      try {
        const { error } = await supabase
          .from('service_devices')
          .update({
            deleted: true,
            deleted_at: new Date().toISOString(),
            last_updated: new Date().toISOString().split('T')[0]
          })
          .eq('id', id);

        if (error) throw error;
        await fetchServices();
        showToast('Deleted (will be removed in 7 days)', 'success');
      } catch (error) {
        showToast('Delete failed', 'error');
      }
    });
  };

  // RESTORE FROM TRASH
  const handleRestore = async (id: number) => {
    showConfirm('Restore this service record from trash?', async () => {
      try {
        const { error } = await supabase
          .from('service_devices')
          .update({
            deleted: false,
            deleted_at: null,
            last_updated: new Date().toISOString().split('T')[0]
          })
          .eq('id', id);

        if (error) throw error;
        await fetchServices();
        showToast('Service restored successfully!', 'success');
      } catch (error) {
        showToast('Restore failed', 'error');
      }
    });
  };

  // ============================================
  // BULK OPERATIONS
  // ============================================

  const handleBulkDelete = async () => {
    if (selectedServices.length === 0) {
      showToast('No records selected', 'warning');
      return;
    }

    showConfirm(`Delete ${selectedServices.length} records? (Will be permanently removed in 7 days)`, async () => {
      try {
        const { error } = await supabase
          .from('service_devices')
          .update({
            deleted: true,
            deleted_at: new Date().toISOString(),
            last_updated: new Date().toISOString().split('T')[0]
          })
          .in('id', selectedServices);

        if (error) throw error;
        await fetchServices();
        setSelectedServices([]);
        showToast(`${selectedServices.length} records deleted`, 'success');
      } catch (error) {
        showToast('Delete failed', 'error');
      }
    });
  };

  const handleBulkRestore = async () => {
    if (selectedServices.length === 0) {
      showToast('No records selected', 'warning');
      return;
    }

    showConfirm(`Restore ${selectedServices.length} records from trash?`, async () => {
      try {
        const { error } = await supabase
          .from('service_devices')
          .update({
            deleted: false,
            deleted_at: null,
            last_updated: new Date().toISOString().split('T')[0]
          })
          .in('id', selectedServices);

        if (error) throw error;
        await fetchServices();
        setSelectedServices([]);
        showToast(`${selectedServices.length} records restored`, 'success');
      } catch (error) {
        showToast('Restore failed', 'error');
      }
    });
  };

  const handleSelectAll = () => {
    const currentDataSource = showTrash ? trashedServices : services;
    const currentFiltered = showTrash ? filteredTrashServices : filteredServices;
    const currentPageItems = currentFiltered.slice(indexOfFirstItem, indexOfLastItem);

    if (selectedServices.length === currentPageItems.length) {
      setSelectedServices([]);
    } else {
      setSelectedServices(currentPageItems.map(service => service.id));
    }
  };

  const toggleServiceSelection = (id: number) => {
    setSelectedServices(prev => prev.includes(id) ? prev.filter(serviceId => serviceId !== id) : [...prev, id]);
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
      status: '', accessories_missing: '', date_from: '', date_to: '', device_type: '', customer_name: ''
    });
    setSearchTerm('');
    showToast('Filters cleared', 'info');
  };

  const showNotes = (notes: string | null) => {
    setSelectedNotes(notes || 'No notes available');
    setShowNotesModal(true);
  };

  // ============================================
  // STYLING FUNCTIONS
  // ============================================

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Received': 'bg-blue-50 text-blue-700 border border-blue-200',
      'Under Checking': 'bg-purple-50 text-purple-700 border border-purple-200',
      'In Repair': 'bg-orange-50 text-orange-700 border border-orange-200',
      'Ready for Delivery': 'bg-green-50 text-green-700 border border-green-200',
      'Delivered Back': 'bg-gray-50 text-gray-700 border border-gray-200'
    };
    return colors[status] || 'bg-gray-50 text-gray-700 border border-gray-200';
  };

  const getAccessoryCountColor = (count: number, total: number) => {
    const percentage = (count / total) * 100;
    if (percentage === 100) return 'text-green-600 bg-green-50';
    if (percentage >= 70) return 'text-blue-600 bg-blue-50';
    if (percentage >= 50) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  // ============================================
  // FILTERING AND CALCULATIONS
  // ============================================
const toYMD = (date: string): string => {
  return new Date(date).toISOString().split('T')[0];
};

  // Filter active Services
const filteredServices = services.filter(service => {
  const matchesSearch =
    service.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.phone.includes(searchTerm) ||
    service.device_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.received_by.toLowerCase().includes(searchTerm.toLowerCase());

  if (!matchesSearch) return false;
  if (filters.status && service.status !== filters.status) return false;
  if (filters.accessories_missing === 'Yes' && !service.accessories_missing) return false;
  if (filters.customer_name && !service.customer_name.toLowerCase().includes(filters.customer_name.toLowerCase())) return false;
  if (filters.device_type && service.device_type !== filters.device_type) return false;

  // ✅ FIXED DATE FILTER
  if (filters.date_from) {
    const serviceDate = toYMD(service.date_received);
    if (serviceDate !== filters.date_from) return false;
  }

  return true;
});


  // Filter trashed Services
  const filteredTrashServices = trashedServices.filter(service => {
  // SEARCH
  const matchesSearch =
    service.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.phone.includes(searchTerm) ||
    service.device_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.serial_number.toLowerCase().includes(searchTerm.toLowerCase());

  if (!matchesSearch) return false;

  // CUSTOMER NAME FILTER
  if (
    filters.customer_name &&
    !service.customer_name.toLowerCase().includes(filters.customer_name.toLowerCase())
  ) {
    return false;
  }

  // DEVICE TYPE FILTER
  if (filters.device_type && service.device_type !== filters.device_type) {
    return false;
  }

  // ✅ EXACT DATE FILTER (TRASH)
  if (filters.date_from) {
    const serviceDate = toYMD(service.date_received);
    if (serviceDate !== filters.date_from) return false;
  }

  return true;
});

  // Calculate stats
  const totalServices = services.length;
  const inRepair = services.filter(s => s.status === 'In Repair' || s.status === 'Under Checking').length;
  const readyForDelivery = services.filter(s => s.status === 'Ready for Delivery').length;
  const delivered = services.filter(s => s.status === 'Delivered Back').length;
  const missingAccessories = services.filter(s => s.accessories_missing).length;

  // ============================================
  // PAGINATION LOGIC
  // ============================================

  const currentDataSource = showTrash ? filteredTrashServices : filteredServices;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentRecords = currentDataSource.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(currentDataSource.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters.customer_name, filters.status, filters.date_from, filters.date_to, filters.device_type, showTrash]);

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
                ? 'bg-red-600 text-white border-red-600'
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

  if (!mounted) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading service records...</p>
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
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="text-red-600" size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Confirm Action</h3>
                </div>
                <p className="text-gray-600 mb-6">{confirmAction?.message}</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleConfirm}
                    className="flex-1 bg-gradient-to-r from-red-600 to-red-600 hover:from-red-700 hover:to-red-700 text-white px-4 py-2 rounded-lg font-medium transition-all"
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
              <div className="bg-gradient-to-r from-red-600 to-red-600 text-white p-4 rounded-t-xl flex items-center justify-between">
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

      {/* Add/Edit Service Modal */}
      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[90]" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[90] pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto">
              <div className="sticky top-0 bg-gradient-to-r from-red-600 to-red-600 text-white p-4 rounded-t-xl flex items-center justify-between">
                <h3 className="text-xl font-bold">{editingService ? 'Edit Service Record' : 'Receive New Device'}</h3>
                <button onClick={() => setShowModal(false)} className="text-white hover:text-gray-200">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Customer & Entry Info */}
                <div>
                  <h3 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center">1</span>
                    Customer & Entry Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                      <input
                        type="text"
                        name="customer_name"
                        value={formData.customer_name}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded 
                              text-gray-900 
                              focus:ring-2 focus:ring-red-500 focus:border-red-500 
                              placeholder-gray-500 text-base"
                        placeholder="Enter customer name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 text-gray-900 focus:border-red-500 placeholder-gray-500 text-base"
                        placeholder="Enter phone number"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date Received *</label>
                      <input
                        type="date"
                        name="date_received"
                        value={formData.date_received}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-700 text-gray-900  text-base"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Received By (Staff) *</label>
                      <input
                        type="text"
                        name="received_by"
                        value={formData.received_by}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900  focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder-gray-500 text-base"
                        placeholder="Staff name"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Device Details */}
                <div>
                  <h3 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center">2</span>
                    Device Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Device Name / Model *</label>
                      <input
                        type="text"
                        name="device_name"
                        value={formData.device_name}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900  focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder-gray-500 text-base"
                        placeholder="Enter device name/model"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number *</label>
                      <input
                        type="text"
                        name="serial_number"
                        value={formData.serial_number}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900  focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder-gray-500 text-base"
                        placeholder="Enter serial number"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Device Type</label>
                      <select
                        name="device_type"
                        value={formData.device_type}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900  focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-700 text-base"
                      >
                        <option value="Biometric">Biometric Device</option>
                        <option value="CCTV">CCTV Camera</option>
                        <option value="Gate">Gate / Boom Barrier</option>
                        <option value="Access Control">Access Control System</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* ACCESSORIES CHECKLIST - UPDATED */}
                <div className="border-2 border-red-200 rounded-lg p-5 bg-red-50">
                  <h3 className="font-semibold text-sm text-red-700 mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 bg-red-200 text-red-700 rounded-full flex items-center justify-center">3</span>
                    Accessories with Device Checklist <span className="text-red-600 font-bold">(VERY IMPORTANT)</span>
                  </h3>

                  {/* Accessories Count Display */}
                  <div className="mb-4 p-3 bg-white rounded-lg border border-red-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900">Accessories Status:</span>
                        <span className="ml-2 text-sm text-green-900 font-medium">
                          {(() => {
                            const allCount = countAllAccessories(formData);
                            return `${allCount.present}/${allCount.total} accessories`;
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getAccessoryCountColor(countAllAccessories(formData).present, countAllAccessories(formData).total)}`}>
                          <Percent size={14} className="inline mr-1" />
                          {countAllAccessories(formData).percentage}%
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="flex items-center gap-2 text-sm font-semibold text-red-700 cursor-pointer">

                      <span>⚠️ ACCESSORIES (What accessories we received with the device)</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        name="has_device"
                        checked={formData.has_device}
                        onChange={handleInputChange}
                        className="w-5 h-5 text-red-600 focus:ring-red-500 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900 text-base">Main Device</span>
                        <p className="text-xs text-gray-500">The actual device being serviced</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        name="has_adapter"
                        checked={formData.has_adapter}
                        onChange={handleInputChange}
                        className="w-5 h-5 text-red-600 focus:ring-red-500 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900 text-base">Adapter / Power Supply</span>
                        <p className="text-xs text-gray-500">Power adapter/charger</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        name="has_power_connector"
                        checked={formData.has_power_connector}
                        onChange={handleInputChange}
                        className="w-5 h-5 text-red-600 focus:ring-red-500 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900 text-base">Power Connector</span>
                        <p className="text-xs text-gray-500">Power cables/connectors</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        name="has_access_connector"
                        checked={formData.has_access_connector}
                        onChange={handleInputChange}
                        className="w-5 h-5 text-red-600 focus:ring-red-500 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900 text-base">Access Connector</span>
                        <p className="text-xs text-gray-500">Data/access cables</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        name="has_rfid_card"
                        checked={formData.has_rfid_card}
                        onChange={handleInputChange}
                        className="w-5 h-5 text-red-600 focus:ring-red-500 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900 text-base">RFID Card</span>
                        <p className="text-xs text-gray-500">Access cards/keys</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        name="has_original_box"
                        checked={formData.has_original_box}
                        onChange={handleInputChange}
                        className="w-5 h-5 text-red-600 focus:ring-red-500 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900 text-base">Original Box</span>
                        <p className="text-xs text-gray-500">Original packaging</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors md:col-span-2 lg:col-span-1">
                      <input
                        type="checkbox"
                        name="has_mounting_plate"
                        checked={formData.has_mounting_plate}
                        onChange={handleInputChange}
                        className="w-5 h-5 text-red-600 focus:ring-red-500 rounded"
                      />
                      <div>
                        <span className="font-medium text-gray-900 text-base">Mounting Plate</span>
                        <p className="text-xs text-gray-500">Brackets/mounting hardware</p>
                      </div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-red-700 mb-2">Missing/Additional Accessories Details</label>
                    <textarea
                      name="missing_accessories_details"
                      placeholder="Specify exactly which items are missing/available and their condition..."
                      value={formData.missing_accessories_details}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-red-300 rounded focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder-red-300 bg-white resize-none text-base"
                    />
                  </div>
                </div>

                {/* Issue Details with Custom Option */}
                <div>
                  <h3 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center">4</span>
                    Issue Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Issue Type</label>
                      <div className="flex gap-2">
                        <select
                          name="issue_type"
                          value={formData.issue_type}
                          onChange={handleInputChange}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-700 text-base"
                        >
                          <option value="">Select issue type</option>
                          {customIssueTypes.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>

                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <div className="flex gap-2">
                        <select
                          name="status"
                          value={formData.status}
                          onChange={handleInputChange}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-700 text-base"
                        >
                          <option value="">Select status</option>
                          {customStatuses.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>

                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Detailed Remarks</label>
                      <textarea
                        name="detailed_remarks"
                        placeholder="Describe the issue in detail, symptoms, customer complaints..."
                        value={formData.detailed_remarks}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 text-gray-900  rounded focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder-gray-500 bg-white resize-none text-base"
                      />
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <h3 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center">5</span>
                    Service Timeline
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery Date</label>
                      <input
                        type="date"
                        name="expected_delivery_date"
                        value={formData.expected_delivery_date}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 text-gray-900  rounded focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-700 text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Delivered Date</label>
                      <input
                        type="date"
                        name="delivered_date"
                        value={formData.delivered_date}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-700 text-base"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Delivered To (Person Name)</label>
                      <input
                        type="text"
                        name="delivered_to"
                        value={formData.delivered_to}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-gray-900  focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder-gray-500 text-base"
                        placeholder="Person who received the device"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Final Remarks / Delivery Notes</label>
                      <textarea
                        name="final_remarks"
                        placeholder="Final notes, repair summary, recommendations..."
                        value={formData.final_remarks}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 text-gray-900  rounded focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder-gray-500 bg-white resize-none text-base"
                      />
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-600 hover:from-red-700 hover:to-red-700 text-white rounded-lg font-medium transition-all shadow-md"
                  >
                    {editingService ? 'Update Service Record' : 'Receive Device'}
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
              {showTrash ? '🗑️ Service Trash' : '🔧 Service Center Management'}
            </h2>
            {showTrash && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                {trashedServices.length} items in trash (Auto-deletes in 7 days)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!showTrash && (
              <button
                onClick={() => {
                  setShowModal(true);
                  setEditingService(null);
                  resetFormData();
                }}
                className="bg-gradient-to-r from-red-600 to-red-600 hover:from-red-700 hover:to-red-700 text-white px-3 py-1.5 rounded-lg font-medium shadow-md transition-all flex items-center gap-1.5 text-sm"
              >
                <Plus size={16} />
                <span>Receive Device</span>
              </button>
            )}
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-3 lg:p-4">

          {/* Stats Cards (Only show when not in trash) */}
          {!showTrash && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-3 shadow-md text-white">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs opacity-90 font-medium">Total Devices</p>
                  <Wrench size={20} />
                </div>
                <p className="text-2xl font-bold">{totalServices}</p>
                <p className="text-xs opacity-75 mt-1">In service center</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-3 shadow-md text-white">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs opacity-90 font-medium">In Repair</p>
                  <Clock size={20} />
                </div>
                <p className="text-2xl font-bold">{inRepair}</p>
                <p className="text-xs opacity-75 mt-1">Being serviced</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-3 shadow-md text-white">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs opacity-90 font-medium">Ready</p>
                  <Package size={20} />
                </div>
                <p className="text-2xl font-bold">{readyForDelivery}</p>
                <p className="text-xs opacity-75 mt-1">For delivery</p>
              </div>
              <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg p-3 shadow-md text-white">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs opacity-90 font-medium">Delivered</p>
                  <Truck size={20} />
                </div>
                <p className="text-2xl font-bold">{delivered}</p>
                <p className="text-xs opacity-75 mt-1">Returned to customer</p>
              </div>
              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-3 shadow-md text-white">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs opacity-90 font-medium">Missing Items</p>
                  <AlertTriangle size={20} />
                </div>
                <p className="text-2xl font-bold">{missingAccessories}</p>
                <p className="text-xs opacity-75 mt-1">Accessories missing</p>
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
                    placeholder={`Search ${showTrash ? 'trash' : 'services'}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-800"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 flex-wrap flex-1">
                {!showTrash ? (
                  <>
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
                        className="px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg text-sm font-medium flex items-center gap-2"
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
                      className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                      <Download size={18} />
                      <span>Export Excel</span>
                    </button>

                    <button
                      onClick={handleExportCSV}
                      className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                      <Download size={18} />
                      <span>Export CSV</span>
                    </button>
                  </>
                )}

                {/* Trash Toggle Button */}
                <button
                  onClick={() => setShowTrash(!showTrash)}
                  className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium flex items-center gap-2 ml-auto"
                >
                  {showTrash ? (
                    <>
                      <Undo2 size={18} />
                      <span>Back to Services</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={18} />
                      <span>Trash ({trashedServices.length})</span>
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
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                  className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white"
                >
                  <option value="">All Status</option>
                  {customStatuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                {false && (
                  <select
                    name="accessories_missing"
                    value={filters.accessories_missing}
                    onChange={handleFilterChange}
                    className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white"
                  >
                    <option value="">All Accessories</option>
                    <option value="Yes">Accessories Missing</option>
                  </select>
                )}

                <select
                  name="device_type"
                  value={filters.device_type}
                  onChange={handleFilterChange}
                  className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white"
                >
                  <option value="">All Types</option>
                  <option value="CCTV">CCTV</option>
                  <option value="Biometric">Biometric</option>
                  <option value="Gate">Gate</option>
                  <option value="Access Control">Access Control</option>
                  <option value="Other">Other</option>
                </select>
               
                <input
                  type="date"
                  name="date_from"
                  value={filters.date_from}
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
          {selectedServices.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
              <p className="text-xs text-gray-600 font-medium">{selectedServices.length} selected</p>
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
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-red-600 to-red-600 text-white">
                  <tr>
                    <th className="p-2 text-left font-semibold whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedServices.length === currentRecords.length && currentRecords.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded cursor-pointer"
                      />
                    </th>
                    <th className="p-2 text-left font-semibold whitespace-nowrap">S.No</th>
                    <th className="p-2 text-left font-semibold whitespace-nowrap">Customer</th>
                    <th className="p-2 text-left font-semibold whitespace-nowrap">Device</th>
                    <th className="p-2 text-left font-semibold whitespace-nowrap">Accessories with Device</th> 
                    <th className="p-2 text-left font-semibold whitespace-nowrap">Issue</th>
                    {!showTrash && <th className="p-2 text-left font-semibold whitespace-nowrap">Status</th>}
                    <th className="p-2 text-left font-semibold whitespace-nowrap">Dates</th>
                    <th className="p-2 text-left font-semibold whitespace-nowrap">Remarks</th> 
                    {showTrash && <th className="p-2 text-left font-semibold whitespace-nowrap">Deleted On</th>}
                    <th className="p-2 text-center font-semibold whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRecords.length === 0 ? (
                    <tr>
                      <td colSpan={showTrash ? 11 : 10} className="p-8 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle size={32} className="text-gray-400" />
                          <p className="text-sm">
                            {showTrash ? 'No trashed service records found' : 'No service records found'}
                          </p>
                          {showTrash && trashedServices.length === 0 && (
                            <p className="text-xs text-gray-400">Trash is empty. Items are automatically deleted after 7 days</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentRecords.map((service, index) => {
                      const accessoriesCount = countAccessories(service);
                      const allAccessoriesCount = countAllAccessories(service);

                      return (
                        <tr key={service.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={selectedServices.includes(service.id)}
                              onChange={() => toggleServiceSelection(service.id)}
                              className="w-4 h-4 rounded cursor-pointer"
                            />
                          </td>
                          <td className="p-2 text-gray-600 whitespace-nowrap font-medium">
                            {indexOfFirstItem + index + 1}
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            <div className="font-semibold text-gray-900 text-base">{service.customer_name}</div> {/* Increased font size */}
                            <div className="text-sm text-gray-600 font-medium">{service.phone}</div> {/* Increased font size */}
                            <div className="text-xs text-gray-500">Received by: {service.received_by}</div>
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            <div className="font-semibold text-gray-900 text-base">{service.device_name}</div> {/* Increased font size */}
                            <div className="text-sm text-gray-600">{service.device_type}</div> {/* Increased font size */}
                            <div className="text-xs text-gray-400 font-mono">SN: {service.serial_number}</div>
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            <div className={`px-3 py-1.5 rounded-lg flex flex-col items-center ${getAccessoryCountColor(accessoriesCount.present, accessoriesCount.total)}`}>
                              <div className="flex items-center gap-2">
                                <Hash size={14} />
                                <span className="font-bold text-lg">{allAccessoriesCount.present}/{allAccessoriesCount.total}</span>
                              </div>
                              <div className="text-xs mt-1 opacity-80 hidden">accessories</div>
                              {service.accessories_missing && (
                                <div className="text-xs mt-1 text-red-600 flex items-center gap-1 hidden">
                                  <AlertTriangle size={10} />
                                  <span>Incomplete</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            <span className="px-3 py-1 rounded text-sm font-medium bg-orange-100 text-orange-700">
                              {service.issue_type}
                            </span>
                          </td>
                          {!showTrash && (
                            <td className="p-2 whitespace-nowrap">
                              <span className={`px-3 py-1.5 rounded text-sm font-medium ${getStatusColor(service.status)}`}>
                                {service.status}
                              </span>
                            </td>
                          )}
                          <td className="p-2 whitespace-nowrap">
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">Received: {formatDateToDisplay(service.date_received)}</div>
                              {service.expected_delivery_date && (
                                <div className="text-orange-600 mt-1">Expected: {formatDateToDisplay(service.expected_delivery_date)}</div>
                              )}
                              {service.delivered_date && (
                                <div className="text-green-600 mt-1 font-medium">Delivered: {formatDateToDisplay(service.delivered_date)}</div>
                              )}
                            </div>
                          </td>
                          {/* NEW REMARKS COLUMN */}
                          <td className="p-2 whitespace-nowrap max-w-xs">
                            {service.detailed_remarks ? (
                              <button
                                onClick={() => showNotes(service.detailed_remarks)}
                                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors text-sm font-medium"
                              >
                                <MessageSquare size={14} />
                                <span>View Remarks</span>
                              </button>
                            ) : (
                              <span className="text-gray-400 text-sm">No remarks</span>
                            )}
                            {service.final_remarks && (
                              <div className="mt-1">
                                <button
                                  onClick={() => showNotes(service.final_remarks)}
                                  className="text-xs text-green-600 hover:text-green-800 underline"
                                >
                                  View Final Notes
                                </button>
                              </div>
                            )}
                          </td>
                          {showTrash && (
                            <td className="p-2 whitespace-nowrap">
                              <div className="text-sm text-gray-500">
                                {formatDateTime(service.deleted_at)}
                              </div>
                            </td>
                          )}
                          <td className="p-2 whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              {showTrash ? (
                                // TRASH SECTION - ONLY RESTORE BUTTON (NO DELETE)
                                <button
                                  onClick={() => handleRestore(service.id)}
                                  className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                  title="Restore"
                                >
                                  <Undo2 size={16} /> {/* Increased icon size */}
                                </button>
                              ) : (
                                // ACTIVE SECTION - EDIT AND DELETE
                                <>
                                  <button
                                    onClick={() => handleEdit(service)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Edit"
                                  >
                                    <Edit2 size={16} /> {/* Increased icon size */}
                                  </button>
                                  <button
                                    onClick={() => handleDelete(service.id)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 size={16} /> {/* Increased icon size */}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
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