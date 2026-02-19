"use client";

import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import * as XLSX from 'xlsx';

import { Plus, Edit2, Trash2, X, Filter, Menu, LayoutDashboard, Users, CreditCard, Settings, Package, DollarSign, Headphones, Calendar, RotateCcw, Trash, Download, Upload, CheckCircle, AlertCircle, Info, Search, Check, Eye, MessageSquare } from 'lucide-react';

// ============================================
// INTERFACES (UPDATED WITH "Very High")
// ============================================

interface Followup {
  number: number;
  date: string;
  discussion: string;
  done_by: string;
}

interface Lead {
  id: number;
  user_id?: string;
  name: string;
  email?: string;
  customer_category?: string;
  phone: string;
  location: string;
  source: string;
  source_reference?: string;
  product: string;
  product_name: string;
  quantity: string;
  interest: 'Very High' | 'High' | 'Medium' | 'Low';
  requirement?: string;
  followups?: Followup[];
  notes: string;
  status: 'Only Inquiry' | 'Quote Shared' | 'DI Shared' | 'Converted' | 'Lost' | 'Wanted' | 'Postponed';
  last_updated: string;
  deleted: boolean;
  deleted_at: string | null;
  created_at?: string;
}

interface FormData {
  name: string;
  email: string;
  customer_category: string;
  phone: string;
  location: string;
  source: string;
  source_reference: string;
  product: string;
  product_name: string;
  quantity: string;
  interest: 'Very High' | 'High' | 'Medium' | 'Low';
  requirement: string;
  followups: Followup[];
  notes: string;
  status: 'Only Inquiry' | 'Quote Shared' | 'DI Shared' | 'Converted' | 'Lost' | 'Wanted' | 'Postponed';
}

interface Filters {
  source: string;
  product: string;
  interest: string;
  status: string;
  customer_category: string;
  followups: string; // NEW: Added follow-ups filter
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  emoji: string;
  color: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function LeadsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState('');
  const [showFollowupsModal, setShowFollowupsModal] = useState(false);
  const [selectedFollowups, setSelectedFollowups] = useState<Followup[]>([]);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
  const [lastImportedIds, setLastImportedIds] = useState<number[]>([]);
  
  // ============================================
  // PAGINATION STATE
  // ============================================
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  const router = useRouter();
  const handleNavigation = (path: string) => {
    router.push(`/${path}`);
  };

  // UPDATED: Added followups filter
  const [filters, setFilters] = useState<Filters>({
    source: '',
    product: '',
    interest: '',
    status: '',
    customer_category: '',
    followups: '' // NEW: Added follow-ups filter
  });

  const [leads, setLeads] = useState<Lead[]>([]);
  const [trashedLeads, setTrashedLeads] = useState<Lead[]>([]);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    customer_category: 'Uncategorized',
    phone: '',
    location: '',
    source: 'India Mart',
    source_reference: '',
    product: 'Attendance',
    product_name: '',
    quantity: '',
    interest: 'Medium',
    requirement: '',
    followups: [],
    notes: '',
    status: 'Only Inquiry'
  });

  // ============================================
  // ✅ NEW: INLINE INTEREST UPDATE FUNCTION
  // ============================================

  const handleInterestChange = async (leadId: number, newInterest: 'Very High' | 'High' | 'Medium' | 'Low') => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          interest: newInterest,
          last_updated: new Date().toISOString().split('T')[0]
        })
        .eq('id', leadId);

      if (error) throw error;

      setLeads(prevLeads =>
        prevLeads.map(lead =>
          lead.id === leadId ? { ...lead, interest: newInterest } : lead
        )
      );

      showToast(`Interest updated to ${newInterest}`, 'success');
    } catch (error) {
      console.error('Error updating interest:', error);
      showToast('Failed to update interest', 'error');
    }
  };

  // ============================================
  // FOLLOW-UP HELPER FUNCTIONS
  // ============================================

  const addFollowup = () => {
    if (formData.followups.length < 5) {
      setFormData(prev => ({
        ...prev,
        followups: [
          ...prev.followups,
          {
            number: prev.followups.length + 1,
            date: '',
            discussion: '',
            done_by: ''
          }
        ]
      }));
    } else {
      showToast('Maximum 5 follow-ups allowed', 'warning');
    }
  };

  const removeFollowup = (index: number) => {
    setFormData(prev => ({
      ...prev,
      followups: prev.followups
        .filter((_, i) => i !== index)
        .map((f, i) => ({ ...f, number: i + 1 }))
    }));
  };

  const updateFollowup = (index: number, field: keyof Followup, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      followups: prev.followups.map((f, i) =>
        i === index ? { ...f, [field]: value } : f
      )
    }));
  };

  const showFollowups = (followups: Followup[] = []) => {
    setSelectedFollowups(followups);
    setShowFollowupsModal(true);
  };

  const menuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, emoji: '📊', color: 'from-blue-500 to-blue-600' },
    { id: 'leads', label: 'Leads & Enquiry', icon: Users, emoji: '👥', color: 'from-purple-500 to-purple-600' },
    { id: 'payments', label: 'Payments', icon: CreditCard, emoji: '💳', color: 'from-green-500 to-green-600' },
    { id: 'amc', label: 'AMC Management', icon: Settings, emoji: '🔧', color: 'from-orange-500 to-orange-600' },
    { id: 'retail', label: 'Retail Records', icon: Package, emoji: '📦', color: 'from-pink-500 to-pink-600' },
    { id: 'pricing', label: 'Pricing', icon: DollarSign, emoji: '💰', color: 'from-teal-500 to-teal-600' },
    { id: 'todolist', label: 'Daily Tasks', icon: Calendar, emoji: '✅', color: 'from-indigo-500 to-indigo-600' },
    { id: 'servicedevice', label: 'Service Center', icon: Headphones, emoji: '🛠️', color: 'from-red-500 to-red-600' }
  ];

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 4000);
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmAction({ message, onConfirm });
    setShowConfirmModal(true);
  };

  const handleConfirm = () => {
    if (confirmAction) {
      confirmAction.onConfirm();
    }
    setShowConfirmModal(false);
    setConfirmAction(null);
  };

  useEffect(() => {
    fetchLeads();
    autoCleanupOldDeleted();
  }, []);

  const fetchLeads = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.error('No user found');
        router.push('/login');
        return;
      }

      const { data: activeData, error: activeError } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id)
        .eq('deleted', false)
        .order('created_at', { ascending: false });

      if (activeError) throw activeError;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: trashedData, error: trashedError } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id)
        .eq('deleted', true)
        .gte('deleted_at', sevenDaysAgo.toISOString())
        .order('deleted_at', { ascending: false });

      if (trashedError) throw trashedError;

      setLeads(activeData || []);
      setTrashedLeads(trashedData || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      showToast('Failed to fetch leads', 'error');
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

      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('user_id', user.id)
        .eq('deleted', true)
        .lt('deleted_at', sevenDaysAgo.toISOString());

      if (error) console.error('Error cleaning old deleted leads:', error);
    } catch (error) {
      console.error('Error in auto cleanup:', error);
    }
  };

  const handleExportExcel = () => {
    try {
      const dataToExport = leads.map((lead, index) => ({
        'S.No': index + 1,
        'Customer Name': lead.name,
        'Email': lead.email || '',
        'Phone': lead.phone,
        'Location': lead.location,
        'Customer Category': lead.customer_category || '',
        'Source': lead.source,
        'Source Reference': lead.source_reference || '',
        'Product': lead.product,
        'Product Name': lead.product_name || '',
        'Quantity': lead.quantity || '',
        'Interest': lead.interest,
        'Status': lead.status,
        'Requirement': lead.requirement || '',
        'Notes': lead.notes || '',
        'Follow-ups': lead.followups ? JSON.stringify(lead.followups) : '',
        'Last Updated': lead.last_updated || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

      worksheet['!cols'] = [
        { wch: 6 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 15 },
        { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 10 },
        { wch: 15 }, { wch: 30 }, { wch: 30 }, { wch: 40 }, { wch: 15 }
      ];

      XLSX.writeFile(workbook, `Leads_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast(`Successfully exported ${leads.length} leads to Excel`, 'success');
    } catch (error) {
      console.error('Export error:', error);
      showToast('Failed to export Excel file', 'error');
    }
  };

  const handleExportCSV = () => {
    try {
      const dataToExport = leads.map((lead, index) => ({
        'S.No': index + 1,
        'Customer Name': lead.name,
        'Email': lead.email || '',
        'Phone': lead.phone,
        'Location': lead.location,
        'Customer Category': lead.customer_category || '',
        'Source': lead.source,
        'Source Reference': lead.source_reference || '',
        'Product': lead.product,
        'Product Name': lead.product_name || '',
        'Quantity': lead.quantity || '',
        'Interest': lead.interest,
        'Status': lead.status,
        'Requirement': lead.requirement || '',
        'Notes': lead.notes || '',
        'Follow-ups': lead.followups ? JSON.stringify(lead.followups) : '',
        'Last Updated': lead.last_updated || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const csv = XLSX.utils.sheet_to_csv(worksheet);

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Leads_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      showToast(`Successfully exported ${leads.length} leads to CSV`, 'success');
    } catch (error) {
      console.error('Export error:', error);
      showToast('Failed to export CSV file', 'error');
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
          const worksheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[worksheetName];
          const data: any[] = XLSX.utils.sheet_to_json(worksheet);

          if (!data || data.length === 0) {
            showToast('No data found in file', 'warning');
            e.target.value = '';
            return;
          }

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            showToast('You must be logged in to import', 'error');
            e.target.value = '';
            return;
          }

          const leadsToImport = data.map((row: any) => {
            const normalizedRow: any = {};
            Object.keys(row).forEach(key => {
              normalizedRow[key.toLowerCase().trim()] = row[key];
            });

            return {
              user_id: user.id,
              name: normalizedRow['customer name'] || normalizedRow['name'] || '',
              email: normalizedRow['email'] || '',
              customer_category: normalizedRow['customer category'] || 'Uncategorized',
              phone: String(normalizedRow['phone'] || ''),
              location: normalizedRow['location'] || '',
              source: normalizedRow['source'] || 'Import',
              source_reference: normalizedRow['source reference'] || '',
              product: normalizedRow['product'] || 'Attendance',
              product_name: normalizedRow['product name'] || '',
              quantity: String(normalizedRow['quantity'] || ''),
              interest: ['Very High', 'High', 'Medium', 'Low'].includes(normalizedRow['interest'])
                ? normalizedRow['interest']
                : 'Medium',
              requirement: normalizedRow['requirement'] || '',
              status: ['Only Inquiry', 'Quote Shared', 'DI Shared', 'Converted', 'Lost', 'Wanted', 'Postponed'].includes(normalizedRow['status'])
                ? normalizedRow['status']
                : 'Only Inquiry',
              followups: normalizedRow['follow-ups'] ? JSON.parse(normalizedRow['follow-ups']) : [],
              notes: normalizedRow['notes'] || '',
              last_updated: new Date().toISOString().split('T')[0],
              deleted: false,
              deleted_at: null
            };
          }).filter(lead => lead.name && lead.phone);

          if (leadsToImport.length === 0) {
            showToast('No valid leads found. Please ensure Name and Phone columns are filled.', 'warning');
            e.target.value = '';
            return;
          }

          const { data: insertedData, error } = await supabase
            .from('leads')
            .insert(leadsToImport)
            .select('id');

          if (error) {
            console.error('Supabase insert error:', error);
            throw error;
          }

          const importedIds = insertedData?.map(item => item.id) || [];
          setLastImportedIds(importedIds);

          await fetchLeads();
          showToast(`Successfully imported ${leadsToImport.length} leads! You can undo if needed.`, 'success');
          e.target.value = '';
        } catch (innerError: any) {
          console.error('Inner import error:', innerError);
          showToast(`Import failed: ${innerError.message || 'Please check file format'}`, 'error');
          e.target.value = '';
        }
      };

      reader.onerror = () => {
        showToast('Failed to read file', 'error');
        e.target.value = '';
      };

      reader.readAsBinaryString(file);
    } catch (error: any) {
      console.error('Outer import error:', error);
      showToast(`Import error: ${error.message || 'Unknown error'}`, 'error');
      e.target.value = '';
    }
  };

  const handleUndoImport = async () => {
    if (lastImportedIds.length === 0) {
      showToast('No recent import to undo', 'warning');
      return;
    }

    showConfirm(
      `Undo last import? This will permanently delete ${lastImportedIds.length} recently imported leads.`,
      async () => {
        try {
          const { error } = await supabase
            .from('leads')
            .delete()
            .in('id', lastImportedIds);

          if (error) throw error;

          await fetchLeads();
          showToast(`Successfully deleted ${lastImportedIds.length} imported leads`, 'success');
          setLastImportedIds([]);
        } catch (error) {
          console.error('Error undoing import:', error);
          showToast('Failed to undo import', 'error');
        }
      }
    );
  };

  const handleBulkDelete = async () => {
    if (selectedLeads.length === 0) {
      showToast('No leads selected', 'warning');
      return;
    }

    showConfirm(
      `Move ${selectedLeads.length} selected leads to trash?`,
      async () => {
        try {
          const { error } = await supabase
            .from('leads')
            .update({
              deleted: true,
              deleted_at: new Date().toISOString()
            })
            .in('id', selectedLeads);

          if (error) throw error;

          await fetchLeads();
          setSelectedLeads([]);
          showToast(`${selectedLeads.length} leads moved to trash`, 'success');
        } catch (error) {
          console.error('Error bulk deleting:', error);
          showToast('Failed to delete selected leads', 'error');
        }
      }
    );
  };

  const handleSelectAll = () => {
    if (selectedLeads.length === currentLeads.length) {
      // Deselect all on current page
      setSelectedLeads(prev => prev.filter(id => !currentLeads.some(lead => lead.id === id)));
    } else {
      // Select all on current page
      const currentPageIds = currentLeads.map(lead => lead.id);
      setSelectedLeads(prev => {
        // Combine with previously selected leads from other pages
        const newSelection = [...prev];
        currentPageIds.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  };

  const toggleLeadSelection = (id: number) => {
    setSelectedLeads(prev =>
      prev.includes(id) ? prev.filter(leadId => leadId !== id) : [...prev, id]
    );
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      source: '',
      product: '',
      interest: '',
      status: '',
      customer_category: '',
      followups: '' // NEW: Clear follow-ups filter
    });
    showToast('Filters cleared', 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        showToast('You must be logged in', 'error');
        return;
      }

      if (editingLead) {
        const { error } = await supabase
          .from('leads')
          .update({
            ...formData,
            last_updated: new Date().toISOString().split('T')[0]
          })
          .eq('id', editingLead.id);

        if (error) throw error;
        showToast('Lead updated successfully!', 'success');
      } else {
        const { error } = await supabase
          .from('leads')
          .insert([
            {
              ...formData,
              user_id: user.id,
              last_updated: new Date().toISOString().split('T')[0],
              deleted: false,
              deleted_at: null
            }
          ]);

        if (error) throw error;
        showToast('Lead added successfully!', 'success');
      }

      await fetchLeads();
      setShowModal(false);
      setEditingLead(null);
      setFormData({
        name: '',
        email: '',
        customer_category: 'Uncategorized',
        phone: '',
        location: '',
        source: 'India Mart',
        source_reference: '',
        product: 'Attendance',
        product_name: '',
        quantity: '',
        interest: 'Medium',
        requirement: '',
        followups: [],
        notes: '',
        status: 'Only Inquiry'
      });
    } catch (error) {
      console.error('Error saving lead:', error);
      showToast('Failed to save lead', 'error');
    }
  };

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    setFormData({
      name: lead.name,
      email: lead.email || '',
      customer_category: lead.customer_category || 'Uncategorized',
      phone: lead.phone,
      location: lead.location,
      source: lead.source,
      source_reference: lead.source_reference || '',
      product: lead.product,
      product_name: lead.product_name,
      quantity: lead.quantity,
      interest: lead.interest,
      requirement: lead.requirement || '',
      followups: lead.followups || [],
      notes: lead.notes,
      status: lead.status
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    showConfirm(
      'Move this lead to trash? It will be permanently deleted after 7 days.',
      async () => {
        try {
          const { error } = await supabase
            .from('leads')
            .update({
              deleted: true,
              deleted_at: new Date().toISOString()
            })
            .eq('id', id);

          if (error) throw error;

          await fetchLeads();
          showToast('Lead moved to trash!', 'success');
        } catch (error) {
          console.error('Error deleting lead:', error);
          showToast('Failed to delete lead', 'error');
        }
      }
    );
  };

  const handleRestore = async (id: number) => {
    showConfirm('Restore this lead?', async () => {
      try {
        const { error } = await supabase
          .from('leads')
          .update({
            deleted: false,
            deleted_at: null
          })
          .eq('id', id);

        if (error) throw error;

        await fetchLeads();
        showToast('Lead restored successfully!', 'success');
      } catch (error) {
        console.error('Error restoring lead:', error);
        showToast('Failed to restore lead', 'error');
      }
    });
  };

  const showNotes = (notes: string) => {
    setSelectedNotes(notes);
    setShowNotesModal(true);
  };

  const getInterestBadge = (interest: string) => {
    const colors: Record<string, string> = {
      'Very High': 'bg-pink-200 text-pink-800 border border-pink-300',
      'High': 'bg-red-200 text-red-700 border border-red-300',
      'Medium': 'bg-orange-200 text-orange-700 border border-orange-300',
      'Low': 'bg-slate-200 text-slate-700 border border-slate-300'
    };
    return colors[interest] || 'bg-gray-200 text-gray-700 border border-gray-300';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Only Inquiry': 'bg-blue-50 text-blue-700 border border-blue-200',
      'Quote Shared': 'bg-purple-50 text-purple-700 border border-purple-200',
      'DI Shared': 'bg-amber-50 text-amber-700 border border-amber-200',
      'Converted': 'bg-green-50 text-green-700 border border-green-200',
      'Lost': 'bg-red-50 text-red-700 border border-red-200',
      'Wanted': 'bg-indigo-50 text-indigo-700 border border-indigo-200',
      'Postponed': 'bg-gray-50 text-gray-700 border border-gray-200'
    };
    return colors[status] || 'bg-gray-50 text-gray-700 border border-gray-200';
  };

  // ============================================
  // PAGINATION LOGIC
  // ============================================

  // Filter leads based on search and filters
  const filteredLeads = leads.filter(lead => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm) ||
      lead.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.requirement && lead.requirement.toLowerCase().includes(searchTerm.toLowerCase())) ||
      lead.notes.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filters.source && lead.source !== filters.source) return false;
    if (filters.product && lead.product !== filters.product) return false;
    if (filters.interest && lead.interest !== filters.interest) return false;
    if (filters.status && lead.status !== filters.status) return false;
    if (filters.customer_category && lead.customer_category !== filters.customer_category) return false;
    
    // NEW: Follow-ups filter logic
    if (filters.followups) {
      const followupCount = lead.followups ? lead.followups.length : 0;
      
      switch (filters.followups) {
        case 'none':
          if (followupCount > 0) return false;
          break;
        case '1-2':
          if (followupCount < 1 || followupCount > 2) return false;
          break;
        case '3-5':
          if (followupCount < 3 || followupCount > 5) return false;
          break;
        case '5+':
          if (followupCount <= 5) return false;
          break;
        default:
          break;
      }
    }

    return true;
  });

  // Calculate pagination values
  const totalItems = filteredLeads.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentLeads = filteredLeads.slice(startIndex, endIndex);

  // Page change handlers
  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const goToPrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  
  const goToPage = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // Generate page numbers for display
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if less than maxVisiblePages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      // Calculate start and end of visible pages
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      
      // Adjust if at the beginning
      if (currentPage <= 3) {
        start = 2;
        end = 4;
      }
      
      // Adjust if at the end
      if (currentPage >= totalPages - 2) {
        start = totalPages - 3;
        end = totalPages - 1;
      }
      
      // Add ellipsis after first page if needed
      if (start > 2) {
        pages.push('...');
      }
      
      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      // Add ellipsis before last page if needed
      if (end < totalPages - 1) {
        pages.push('...');
      }
      
      // Always show last page
      pages.push(totalPages);
    }
    
    return pages;
  };

  // Reset to first page when filters or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, searchTerm, itemsPerPage]);

  const uniqueSources = [...new Set(leads.map(l => l.source))];
  const uniqueProducts = [...new Set(leads.map(l => l.product))];
  const uniqueCategories = [...new Set(leads.map(l => l.customer_category).filter(Boolean))];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading leads...</p>
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
              Leads & Enquiry 👥
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => {
                setShowModal(true);
                setEditingLead(null);
                setFormData({
                  name: '',
                  email: '',
                  customer_category: 'Uncategorized',
                  phone: '',
                  location: '',
                  source: 'India Mart',
                  source_reference: '',
                  product: 'Attendance',
                  product_name: '',
                  quantity: '',
                  interest: 'Medium',
                  requirement: '',
                  followups: [],
                  notes: '',
                  status: 'Only Inquiry'
                });
              }}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-3 py-1.5 rounded-lg font-medium shadow-md transition-all flex items-center gap-1.5 text-sm"
            >
              <Plus size={16} />
              <span>Add Lead</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-3 lg:p-4">

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-3 shadow-md text-white">
              <p className="text-xs opacity-90 font-medium mb-1">Total</p>
              <p className="text-2xl font-bold">{filteredLeads.length}</p>
            </div>
            <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg p-3 shadow-md text-white">
              <p className="text-xs opacity-90 font-medium mb-1">Very High</p>
              <p className="text-2xl font-bold">{filteredLeads.filter(l => l.interest === 'Very High').length}</p>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-3 shadow-md text-white">
              <p className="text-xs opacity-90 font-medium mb-1">Converted</p>
              <p className="text-2xl font-bold">{filteredLeads.filter(l => l.status === 'Converted').length}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-3 shadow-md text-white">
              <p className="text-xs opacity-90 font-medium mb-1">Quotes</p>
              <p className="text-2xl font-bold">{filteredLeads.filter(l => l.status === 'Quote Shared').length}</p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2.5 mb-4">
            <div className="flex flex-col lg:flex-row gap-2">

              {/* Search */}
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800"
                  />
                </div>
              </div>

              {/* Compact Buttons */}
              <div className="flex gap-1.5 flex-wrap flex-shrink-0">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium flex items-center gap-1"
                >
                  <Filter size={14} />
                  <span className="hidden sm:inline">Filter</span>
                </button>
                <button
                  onClick={handleExportExcel}
                  className="px-2.5 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs font-medium flex items-center gap-1"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">Excel</span>
                </button>
                <button
                  onClick={handleExportCSV}
                  className="px-2.5 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs font-medium flex items-center gap-1"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">CSV</span>
                </button>
                <label className="px-2.5 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded text-xs font-medium flex items-center gap-1 cursor-pointer">
                  <Upload size={14} />
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
                </label>
                {lastImportedIds.length > 0 && (
                  <button onClick={handleUndoImport} className="px-2.5 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded text-xs font-medium flex items-center gap-1">
                    <RotateCcw size={14} />
                  </button>
                )}
                <button
                  onClick={() => setShowTrash(!showTrash)}
                  className="px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium flex items-center gap-1"
                >
                  <Trash size={14} />
                  <span>({trashedLeads.length})</span>
                </button>
              </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <select name="source" value={filters.source} onChange={handleFilterChange} className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white">
                    <option value="">All Sources</option>
                    {uniqueSources.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select name="product" value={filters.product} onChange={handleFilterChange} className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white">
                    <option value="">All Products</option>
                    {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select name="interest" value={filters.interest} onChange={handleFilterChange} className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white">
                    <option value="">All Interest</option>
                    <option value="Very High">Very High</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                  <select name="status" value={filters.status} onChange={handleFilterChange} className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white">
                    <option value="">All Status</option>
                    <option value="Only Inquiry">Only Inquiry</option>
                    <option value="Quote Shared">Quote Shared</option>
                    <option value="DI Shared">DI Shared</option>
                    <option value="Converted">Converted</option>
                    <option value="Lost">Lost</option>
                    <option value="Wanted">Wanted</option>
                    <option value="Postponed">Postponed</option>
                  </select>
                  <select name="customer_category" value={filters.customer_category} onChange={handleFilterChange} className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white">
                    <option value="">All Categories</option>
                    {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {/* NEW: Follow-ups Filter */}
                  <select name="followups" value={filters.followups} onChange={handleFilterChange} className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white">
                    <option value="">All Follow-ups</option>
                    <option value="none">No Follow-ups</option>
                    <option value="1-2">1-2 Follow-ups</option>
                    <option value="3-5">3-5 Follow-ups</option>
                    <option value="5+">5+ Follow-ups</option>
                  </select>
                </div>
                <div className="mt-2 flex justify-end">
                  <button onClick={clearFilters} className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-medium">
                    Clear All Filters
                  </button>
                </div>
              </div>
            )}

            {/* Bulk Actions */}
            {selectedLeads.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                <p className="text-xs text-gray-600 font-medium">{selectedLeads.length} selected</p>
                <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium flex items-center gap-1">
                  <Trash size={14} />
                  Delete
                </button>
              </div>
            )}
          </div>

          {/* Tables */}
          {!showTrash ? (
            <>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 table-fixed text-xs">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <tr>
                        <th className="w-8 px-2 py-2">
                          <input 
                            type="checkbox" 
                            checked={currentLeads.length > 0 && currentLeads.every(lead => selectedLeads.includes(lead.id))} 
                            onChange={handleSelectAll} 
                            className="rounded" 
                          />
                        </th>
                        <th className="w-10 px-2 py-2 text-left font-semibold text-gray-700 uppercase tracking-tight">No</th>
                        <th className="w-32 px-2 py-2 text-left font-semibold text-gray-700 uppercase tracking-tight">Customer</th>
                        <th className="w-32 px-2 py-2 text-left font-semibold text-gray-700 uppercase tracking-tight">Contact</th>
                        <th className="w-24 px-2 py-2 text-left font-semibold text-gray-700 uppercase tracking-tight">Source</th>
                        <th className="w-28 px-2 py-2 text-left font-semibold text-gray-700 uppercase tracking-tight">Product</th>
                        <th className="w-20 px-2 py-2 text-left font-semibold text-gray-700 uppercase tracking-tight">Interest</th>
                        <th className="w-20 px-2 py-2 text-left font-semibold text-gray-700 uppercase tracking-tight whitespace-nowrap">Follow-ups</th>
                        <th className="w-32 px-2 py-2 text-left font-semibold text-gray-700 uppercase tracking-tight">Notes</th>
                        <th className="w-28 px-2 py-2 text-left font-semibold text-gray-700 uppercase tracking-tight">Status</th>
                        <th className="w-16 px-2 py-2 text-left font-semibold text-gray-700 uppercase tracking-tight">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {currentLeads.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="px-3 py-8 text-center text-gray-500 text-xs">
                            No leads found
                          </td>
                        </tr>
                      ) : (
                        currentLeads.map((lead, index) => (
                          <tr key={lead.id} className="hover:bg-gray-50">
                            <td className="px-2 py-2">
                              <input type="checkbox" checked={selectedLeads.includes(lead.id)} onChange={() => toggleLeadSelection(lead.id)} className="rounded" />
                            </td>
                            <td className="px-2 py-2 text-gray-600 font-medium">{startIndex + index + 1}</td>

                            {/* Customer */}
                            <td className="px-2 py-2">
                              <div className="font-semibold text-gray-900 truncate leading-tight">{lead.name}</div>
                              {lead.customer_category && <div className="text-[10px] text-gray-500 truncate">{lead.customer_category}</div>}
                            </td>

                            {/* Contact */}
                            <td className="px-2 py-2">
                              <div className="font-medium text-gray-900 truncate leading-tight">{lead.phone}</div>
                              <div className="text-[10px] text-gray-500 truncate">{lead.location}</div>
                            </td>

                            {/* Source */}
                            <td className="px-2 py-2">
                              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-medium inline-block truncate max-w-full whitespace-nowrap">
                                {lead.source}
                              </span>
                            </td>

                            {/* Product */}
                            <td className="px-2 py-2">
                              <div className="font-medium text-gray-900 truncate leading-tight">{lead.product}</div>
                              {lead.product_name && <div className="text-[10px] text-gray-500 truncate">{lead.product_name}</div>}
                            </td>

                            {/* Interest - Inline Editable */}
                            <td className="px-2 py-2">
                              <select
                                value={lead.interest}
                                onChange={(e) => handleInterestChange(lead.id, e.target.value as any)}
                                className={`w-full px-1.5 py-0.5 rounded text-[10px] font-semibold border-0 cursor-pointer ${getInterestBadge(lead.interest)}`}
                                style={{ appearance: 'none', backgroundImage: 'none' }}
                              >
                                <option value="Very High">Very High</option>
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                              </select>
                            </td>

                            {/* Follow-ups */}
                            <td className="px-2 py-2">
                              {lead.followups && lead.followups.length > 0 ? (
                                <button
                                  onClick={() => showFollowups(lead.followups)}
                                  className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded text-[10px] font-medium whitespace-nowrap"
                                >
                                  <Eye size={12} />
                                  ({lead.followups.length})
                                </button>
                              ) : (
                                <span className="text-[10px] text-gray-400 italic whitespace-nowrap">None</span>
                              )}
                            </td>

                            {/* Notes */}
                            <td className="px-2 py-2">
                              {lead.notes ? (
                                <div className="flex items-center gap-1">
                                  <span className="truncate text-[10px] text-gray-600 flex-1">
                                    {lead.notes.slice(0, 20)}...
                                  </span>
                                  <button
                                    onClick={() => showNotes(lead.notes)}
                                    className="text-indigo-600 hover:text-indigo-700 flex-shrink-0"
                                  >
                                    <Eye size={12} />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-gray-400 italic">None</span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="px-2 py-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap inline-block ${getStatusColor(lead.status)}`}>
                                {lead.status}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="px-2 py-2">
                              <div className="flex gap-1">
                                <button onClick={() => handleEdit(lead)} className="text-blue-600 hover:text-blue-800 p-0.5 hover:bg-blue-50 rounded" title="Edit">
                                  <Edit2 size={13} />
                                </button>
                                <button onClick={() => handleDelete(lead.id)} className="text-red-600 hover:text-red-800 p-0.5 hover:bg-red-50 rounded" title="Delete">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
                  {/* Items per page selector */}
                  <div className="mb-3 sm:mb-0">
                    <select
                      value={itemsPerPage}
                      onChange={(e) => setItemsPerPage(Number(e.target.value))}
                      className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-gray-700"
                    >
                      <option value={10}>10 per page</option>
                      <option value={20}>20 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={100}>100 per page</option>
                    </select>
                  </div>
                  
                  {/* Results count */}
                  <div className="mb-3 sm:mb-0 text-xs text-gray-600">
                    Showing <span className="font-semibold">{startIndex + 1}</span> to{" "}
                    <span className="font-semibold">{endIndex}</span> of{" "}
                    <span className="font-semibold">{totalItems}</span> results
                  </div>
                  
                  {/* Pagination buttons */}
                  <div className="flex items-center space-x-1">
                    {/* First Page */}
                    <button
                      onClick={goToFirstPage}
                      disabled={currentPage === 1}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded ${
                        currentPage === 1
                          ? "text-gray-400 cursor-not-allowed bg-gray-100"
                          : "text-gray-700 hover:bg-gray-100 bg-white border border-gray-300"
                      }`}
                    >
                      First
                    </button>
                    
                    {/* Previous Page */}
                    <button
                      onClick={goToPrevPage}
                      disabled={currentPage === 1}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded ${
                        currentPage === 1
                          ? "text-gray-400 cursor-not-allowed bg-gray-100"
                          : "text-gray-700 hover:bg-gray-100 bg-white border border-gray-300"
                      }`}
                    >
                      &lt; Prev
                    </button>
                    
                    {/* Page Numbers */}
                    {getPageNumbers().map((page, index) => (
                      <button
                        key={index}
                        onClick={() => typeof page === 'number' ? goToPage(page) : null}
                        disabled={page === '...'}
                        className={`px-3 py-1.5 text-xs font-medium rounded ${
                          page === currentPage
                            ? "bg-indigo-600 text-white border border-indigo-600"
                            : page === '...'
                            ? "text-gray-400 cursor-default bg-white"
                            : "text-gray-700 hover:bg-gray-100 bg-white border border-gray-300"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    
                    {/* Next Page */}
                    <button
                      onClick={goToNextPage}
                      disabled={currentPage === totalPages}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded ${
                        currentPage === totalPages
                          ? "text-gray-400 cursor-not-allowed bg-gray-100"
                          : "text-gray-700 hover:bg-gray-100 bg-white border border-gray-300"
                      }`}
                    >
                      Next &gt;
                    </button>
                    
                    {/* Last Page */}
                    <button
                      onClick={goToLastPage}
                      disabled={currentPage === totalPages}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded ${
                        currentPage === totalPages
                          ? "text-gray-400 cursor-not-allowed bg-gray-100"
                          : "text-gray-700 hover:bg-gray-100 bg-white border border-gray-300"
                      }`}
                    >
                      Last
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* ✅ TRASH VIEW - Matching Image Reference */
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">🗑️</div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-base">Trash Bin</h3>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <span className="text-red-500">⏰</span>
                      Auto-deletes after 7 days
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowTrash(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium"
                >
                  Back
                </button>
              </div>

              {trashedLeads.length === 0 ? (
                <div className="px-4 py-12 text-center text-gray-500 text-sm">
                  <div className="text-5xl mb-3">🗑️</div>
                  <p className="font-medium">Trash is empty</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 uppercase tracking-tight">Name</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 uppercase tracking-tight">Phone</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 uppercase tracking-tight">Amount</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 uppercase tracking-tight">Status</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 uppercase tracking-tight">Deleted Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 uppercase tracking-tight">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {trashedLeads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{lead.name}</td>
                          <td className="px-4 py-3 text-gray-600">{lead.phone}</td>
                          <td className="px-4 py-3 text-gray-600">₹23</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${lead.status === 'Converted' ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-orange-100 text-orange-700 border border-orange-300'}`}>
                              {lead.status === 'Converted' ? 'Received' : lead.status}
                            </span>

                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {lead.deleted_at ? new Date(lead.deleted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown'}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleRestore(lead.id)}
                              className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs font-medium"
                            >
                              Restore
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

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              px-4 py-2.5 rounded-lg shadow-lg text-white font-medium text-sm
              transform transition-all duration-300 animate-slide-in-right
              ${toast.type === 'success' ? 'bg-green-500' :
                toast.type === 'error' ? 'bg-red-500' :
                  toast.type === 'warning' ? 'bg-orange-500' :
                    'bg-blue-500'}
            `}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' && <CheckCircle size={18} />}
              {toast.type === 'error' && <AlertCircle size={18} />}
              {toast.type === 'warning' && <AlertCircle size={18} />}
              {toast.type === 'info' && <Info size={18} />}
              <span>{toast.message}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Confirm Modal */}
      {showConfirmModal && confirmAction && (
        <>
          <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setShowConfirmModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full pointer-events-auto">
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="text-red-600" size={20} />
                  </div>
                  <h3 className="text-base font-bold text-gray-900">Confirm Action</h3>
                </div>
                <p className="text-sm text-gray-600 mb-5">{confirmAction.message}</p>
                <div className="flex gap-2">
                  <button onClick={handleConfirm} className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                    Confirm
                  </button>
                  <button onClick={() => setShowConfirmModal(false)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium">
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
          <div className="fixed inset-0 bg-black/25 z-50" onClick={() => setShowNotesModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full pointer-events-auto border border-gray-200">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center gap-2">
                  <MessageSquare size={18} className="text-indigo-600" />
                  <h3 className="font-semibold text-gray-800 text-sm">Notes</h3>
                </div>
                <button onClick={() => setShowNotesModal(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded">
                  <X size={16} />
                </button>
              </div>
              <div className="p-4 max-h-[60vh] overflow-y-auto">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedNotes}</p>
              </div>
              <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button onClick={() => setShowNotesModal(false)} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium">
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Follow-ups Modal */}
      {showFollowupsModal && (
        <>
          <div className="fixed inset-0 bg-black/25 z-50" onClick={() => setShowFollowupsModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full pointer-events-auto border border-gray-200">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
                <div className="flex items-center gap-2">
                  <MessageSquare size={18} className="text-indigo-600" />
                  <h3 className="font-semibold text-gray-800 text-sm">Follow-up History</h3>
                </div>
                <button onClick={() => setShowFollowupsModal(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded">
                  <X size={16} />
                </button>
              </div>
              <div className="p-4 max-h-[60vh] overflow-y-auto">
                {selectedFollowups.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">No follow-ups recorded</p>
                ) : (
                  <div className="space-y-2.5">
                    {selectedFollowups.map((followup, index) => (
                      <div key={index} className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                              {followup.number}
                            </div>
                            <span className="font-semibold text-gray-800 text-xs">Follow-up #{followup.number}</span>
                          </div>
                          <span className="text-[10px] text-gray-600">{followup.date}</span>
                        </div>
                        <p className="text-xs text-gray-700 mb-1.5">{followup.discussion}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
                          <Users size={10} />
                          <span>By: {followup.done_by || 'Not specified'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200">
                <p className="text-[10px] text-gray-500">Total: {selectedFollowups.length}</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add/Edit Lead Modal */}
      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50" onClick={() => { setShowModal(false); setEditingLead(null); }} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl pointer-events-auto border border-gray-200 my-4">

              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <Users size={18} className="text-white" />
                    </div>
                    <h2 className="text-lg font-bold text-white">{editingLead ? 'Edit Lead' : 'Add New Lead'}</h2>
                  </div>
                  <button onClick={() => { setShowModal(false); setEditingLead(null); }} className="text-white hover:bg-white/20 p-1.5 rounded">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                  {/* LEFT COLUMN */}
                  <div className="space-y-4">

                    {/* Basic Details */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3">
                      <h3 className="font-semibold text-xs text-gray-800 mb-2 flex items-center gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-indigo-500"></div>
                        Basic Details
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" name="name" placeholder="Customer Name *" required value={formData.name} onChange={handleInputChange} className="col-span-2 px-2.5 py-2 border rounded text-xs text-gray-800 bg-white" />
                        <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleInputChange} className="col-span-2 px-2.5 py-2 border rounded text-xs text-gray-800 bg-white" />
                        <input type="tel" name="phone" placeholder="Phone *" required value={formData.phone} onChange={handleInputChange} className="px-2.5 py-2 border rounded text-xs text-gray-800 bg-white" />
                        <select name="customer_category" value={formData.customer_category} onChange={handleInputChange} className="px-2.5 py-2 border rounded text-xs text-gray-800 bg-white">
                          <option value="Office">Office</option>
                          <option value="Industry">Industry</option>
                          <option value="Education">Education</option>
                          <option value="Gym">Gym</option>
                          <option value="Hospital">Hospital</option>
                          <option value="Residence">Residence</option>
                          <option value="Uncategorized">Uncategorized</option>
                        </select>
                        <input type="text" name="location" placeholder="Location *" required value={formData.location} onChange={handleInputChange} className="col-span-2 px-2.5 py-2 border rounded text-xs text-gray-800 bg-white" />
                      </div>
                    </div>

                    {/* Source & Interest */}
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-3">
                      <h3 className="font-semibold text-xs text-gray-800 mb-2 flex items-center gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-purple-500"></div>
                        Source & Interest
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        <select name="source" value={formData.source} onChange={handleInputChange} className="px-2.5 py-2 border rounded text-xs text-gray-800 bg-white">
                          <option value="India Mart">India Mart</option>
                          <option value="YouTube">YouTube</option>
                          <option value="GMB">GMB</option>
                          <option value="ESSL">ESSL</option>
                          <option value="Website">Website</option>
                          <option value="Unknown">Unknown</option>
                          <option value="Reference">Reference</option>
                        </select>
                        {formData.source === 'Reference' && (
                          <select name="source_reference" value={formData.source_reference} onChange={handleInputChange} className="px-2.5 py-2 border rounded text-xs text-gray-800 bg-white">
                            <option value="">Select Reference</option>
                            <option value="ESSL">ESSL</option>
                            <option value="Advice">Advice</option>
                          </select>
                        )}
                        <select name="interest" value={formData.interest} onChange={handleInputChange} className={`px-2.5 py-2 border rounded text-xs text-gray-800 bg-white ${formData.source === 'Reference' ? '' : 'col-span-2'}`}>
                          <option value="Very High">Very High</option>
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>
                    </div>

                    {/* Product Details */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
                      <h3 className="font-semibold text-xs text-gray-800 mb-2 flex items-center gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-green-500"></div>
                        Product Details
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        <select name="product" value={formData.product} onChange={handleInputChange} className="px-2.5 py-2 border rounded text-xs text-gray-800 bg-white">
                          <option value="Attendance">Attendance</option>
                          <option value="Access">Access</option>
                          <option value="CCTV">CCTV</option>
                          <option value="Metal Detector">Metal Detector</option>
                          <option value="Automation">Automation</option>
                          <option value="Software">Software</option>
                          <option value="Service">Service</option>
                        </select>
                        <input type="text" name="product_name" placeholder="Product Name" value={formData.product_name} onChange={handleInputChange} className="px-2.5 py-2 border rounded text-xs text-gray-800 bg-white" />
                        <input type="text" name="quantity" placeholder="Qty" value={formData.quantity} onChange={handleInputChange} className="px-2.5 py-2 border rounded text-xs text-gray-800 bg-white" />
                      </div>
                    </div>

                    {/* Requirement */}
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3">
                      <h3 className="font-semibold text-xs text-gray-800 mb-2 flex items-center gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-amber-500"></div>
                        Requirement
                      </h3>
                      <textarea name="requirement" placeholder="Customer requirement..." rows={2} value={formData.requirement} onChange={handleInputChange} className="w-full px-2.5 py-2 border rounded text-xs text-gray-800 bg-white" />
                    </div>
                  </div>

                  {/* RIGHT COLUMN */}
                  <div className="space-y-4">

                    {/* Follow-ups */}
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-xs text-gray-800 flex items-center gap-1.5">
                          <div className="w-1 h-1 rounded-full bg-indigo-500"></div>
                          Follow-ups ({formData.followups.length}/5)
                        </h3>
                        <button type="button" onClick={addFollowup} disabled={formData.followups.length >= 5} className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded text-[10px] font-medium">
                          + Add
                        </button>
                      </div>
                      {formData.followups.length === 0 ? (
                        <p className="text-[10px] text-gray-500 italic text-center py-2">No follow-ups</p>
                      ) : (
                        <div className="space-y-2 max-h-[240px] overflow-y-auto">
                          {formData.followups.map((followup, index) => (
                            <div key={index} className="bg-white border rounded p-2 relative">
                              <button type="button" onClick={() => removeFollowup(index)} className="absolute top-1.5 right-1.5 text-red-500 hover:text-red-700">
                                <X size={12} />
                              </button>
                              <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                                <div>
                                  <label className="block text-[9px] font-medium text-gray-600 mb-0.5">Date</label>
                                  <input type="date" value={followup.date} onChange={(e) => updateFollowup(index, 'date', e.target.value)} className="w-full px-1.5 py-1 border rounded text-[10px] text-gray-800" />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-medium text-gray-600 mb-0.5">Done By</label>
                                  <input type="text" placeholder="Name" value={followup.done_by} onChange={(e) => updateFollowup(index, 'done_by', e.target.value)} className="w-full px-1.5 py-1 border rounded text-[10px] text-gray-800" />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[9px] font-medium text-gray-600 mb-0.5">Discussion</label>
                                <textarea placeholder="Summary..." value={followup.discussion} onChange={(e) => updateFollowup(index, 'discussion', e.target.value)} rows={2} className="w-full px-1.5 py-1 border rounded text-[10px] text-gray-800" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Status & Notes */}
                    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-lg p-3">
                      <h3 className="font-semibold text-xs text-gray-800 mb-2 flex items-center gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-teal-500"></div>
                        Status & Notes
                      </h3>
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[10px] font-medium text-gray-600 mb-1">Status</label>
                          <select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-2.5 py-2 border rounded text-xs text-gray-800 bg-white">
                            <option value="Only Inquiry">Only Inquiry</option>
                            <option value="Quote Shared">Quote Shared</option>
                            <option value="DI Shared">DI Shared</option>
                            <option value="Converted">Converted</option>
                            <option value="Lost">Lost</option>
                            <option value="Wanted">Wanted</option>
                            <option value="Postponed">Postponed</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-600 mb-1">Notes</label>
                          <textarea name="notes" placeholder="Notes..." rows={3} value={formData.notes} onChange={handleInputChange} className="w-full px-2.5 py-2 border rounded text-xs text-gray-800 bg-white" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex gap-2 mt-5 pt-3 border-t border-gray-200">
                  <button type="submit" className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium shadow-md">
                    {editingLead ? 'Update Lead' : 'Add Lead'}
                  </button>
                  <button type="button" onClick={() => { setShowModal(false); setEditingLead(null); }} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-5 py-2.5 rounded-lg text-sm font-medium">
                    Cancel
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