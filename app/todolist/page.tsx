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
  Clock,
  Tag,
  Calendar,
  Users,
  CreditCard,
  Settings,
  Package,
  DollarSign,
  Headphones
} from 'lucide-react';

// ============================================
// INTERFACES
// ============================================

interface Task {
  id: number;
  user_id?: string;
  title: string;
  description: string;
  category: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  task_date: string;
  due_time: string | null;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
  completed_at: string | null;
  assigned_to: string;
  tags: string[];
  notes: string;
  reminder_sent: boolean;
  deleted: boolean;
  deleted_at: string | null;
  created_at?: string;
  updated_at?: string;
}

interface FormData {
  title: string;
  description: string;
  category: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  task_date: string;
  due_time: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
  assigned_to: string;
  tags: string;
  notes: string;
}

interface Filters {
  category: string;
  priority: string;
  status: string;
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

export default function TodoListPage() {
  const [showTrash, setShowTrash] = useState(false);
  const [trashedTasks, setTrashedTasks] = useState<Task[]>([]);
  const supabase = createClient();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState('');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);
  const [lastImportedIds, setLastImportedIds] = useState<number[]>([]);

  // PAGINATION STATES
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  const [filters, setFilters] = useState<Filters>({
    category: '',
    priority: '',
    status: '',
    date_from: '',
    date_to: ''
  });

  const [tasks, setTasks] = useState<Task[]>([]);

  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    category: 'Work',
    priority: 'Medium',
    task_date: new Date().toISOString().split('T')[0],
    due_time: '',
    status: 'Pending',
    assigned_to: '',
    tags: '',
    notes: ''
  });

  const categories = [
    { name: 'Work', emoji: '💼', color: 'from-blue-500 to-blue-600' },
    { name: 'Personal', emoji: '👤', color: 'from-purple-500 to-purple-600' },
    { name: 'Meeting', emoji: '🤝', color: 'from-green-500 to-green-600' },
    { name: 'Call', emoji: '📞', color: 'from-orange-500 to-orange-600' },
    { name: 'Follow Up', emoji: '🔔', color: 'from-pink-500 to-pink-600' },
    { name: 'Installation', emoji: '🔧', color: 'from-teal-500 to-teal-600' },
    { name: 'Service', emoji: '🛠️', color: 'from-red-500 to-red-600' },
    { name: 'Other', emoji: '📝', color: 'from-gray-500 to-gray-600' }
  ];

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
  // DATA FETCHING - AUTO CLEANUP OLD DELETED
  // ============================================

  useEffect(() => {
    if (mounted) {
      fetchTasks();
      autoCleanupOldDeleted();
    }
  }, [mounted]);

  const fetchTasks = async () => {
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

      // ✅ 2. Fetch ACTIVE tasks (deleted = false)
      const { data: activeData, error: activeError } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('deleted', false)
        .order('task_date', { ascending: true })
        .order('created_at', { ascending: false });

      if (activeError) throw activeError;

      setTasks(activeData || []);

      // ✅ 3. Fetch TRASHED tasks (deleted = true, last 7 days only)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: trashedData, error: trashedError } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('deleted', true)
        .gte('deleted_at', sevenDaysAgo.toISOString())
        .order('deleted_at', { ascending: false });

      if (trashedError) throw trashedError;

      setTrashedTasks(trashedData || []);

    } catch (error: any) {
      console.error('Error:', error);
      showToast('Failed to fetch tasks', 'error');
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

      // PERMANENT DELETE records marked as deleted and older than 7 days
      const { error } = await supabase
        .from('daily_tasks')
        .delete()
        .eq('user_id', user.id)
        .eq('deleted', true)
        .lt('deleted_at', sevenDaysAgo.toISOString());

      if (error) {
        console.error('Auto-delete error:', error);
      } else {
        console.log('Old deleted tasks auto-cleaned');
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
      const dataToExport = (showTrash ? trashedTasks : tasks).map((task, index) => ({
        'S.No': index + 1,
        'Title': task.title,
        'Description': task.description || '',
        'Category': task.category,
        'Priority': task.priority,
        'Date': task.task_date,
        'Due Time': task.due_time || '',
        'Status': task.status,
        'Assigned To': task.assigned_to || '',
        'Tags': task.tags?.join(', ') || '',
        'Notes': task.notes || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, showTrash ? 'Trashed Tasks' : 'Tasks');
      worksheet['!cols'] = Array(10).fill({ wch: 15 });
      XLSX.writeFile(workbook, `${showTrash ? 'Trashed_' : ''}Tasks_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast(`Exported ${dataToExport.length} tasks`, 'success');
    } catch (error) {
      showToast('Export failed', 'error');
    }
  };

  const handleExportCSV = () => {
    try {
      const dataToExport = (showTrash ? trashedTasks : tasks).map((task, index) => ({
        'S.No': index + 1,
        'Title': task.title,
        'Category': task.category,
        'Priority': task.priority,
        'Date': task.task_date,
        'Status': task.status,
        'Assigned': task.assigned_to || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${showTrash ? 'Trashed_' : ''}Tasks_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      showToast(`Exported ${dataToExport.length} tasks`, 'success');
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

          const tasksToImport = data.map((row: any) => {
            const normalized: any = {};
            Object.keys(row).forEach(key => {
              normalized[key.toLowerCase().trim().replace(/\s+/g, '_')] = row[key];
            });

            return {
              user_id: user.id,
              title: normalized['title'] || 'Untitled Task',
              description: normalized['description'] || '',
              category: normalized['category'] || 'Other',
              priority: ['Low', 'Medium', 'High', 'Urgent'].includes(normalized['priority']) ? normalized['priority'] : 'Medium',
              task_date: normalized['date'] || new Date().toISOString().split('T')[0],
              due_time: normalized['due_time'] || null,
              status: ['Pending', 'In Progress', 'Completed', 'Cancelled'].includes(normalized['status']) ? normalized['status'] : 'Pending',
              assigned_to: normalized['assigned_to'] || '',
              tags: normalized['tags'] ? normalized['tags'].split(',').map((t: string) => t.trim()) : [],
              notes: normalized['notes'] || '',
              reminder_sent: false,
              deleted: false,
              deleted_at: null
            };
          }).filter(task => task.title && task.title !== 'Untitled Task');

          if (tasksToImport.length === 0) {
            showToast('No valid tasks found', 'warning');
            e.target.value = '';
            return;
          }

          const { data: insertedData, error } = await supabase
            .from('daily_tasks')
            .insert(tasksToImport)
            .select('id');

          if (error) throw error;

          const importedIds = insertedData?.map(item => item.id) || [];
          setLastImportedIds(importedIds);
          await fetchTasks();
          showToast(`Imported ${tasksToImport.length} tasks!`, 'success');
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

    showConfirm(`Delete ${lastImportedIds.length} imported tasks?`, async () => {
      try {
        const { error } = await supabase.from('daily_tasks').delete().in('id', lastImportedIds);
        if (error) throw error;
        await fetchTasks();
        showToast(`Deleted ${lastImportedIds.length} tasks`, 'success');
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

      if (!formData.title.trim()) {
        showToast('Task title is required', 'error');
        return;
      }

      const tagsArray = formData.tags ? formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

      const taskData = {
        user_id: user.id,
        title: formData.title.trim(),
        description: formData.description?.trim() || '',
        category: formData.category,
        priority: formData.priority,
        task_date: formData.task_date,
        due_time: formData.due_time || null,
        status: formData.status,
        assigned_to: formData.assigned_to?.trim() || '',
        tags: tagsArray,
        notes: formData.notes?.trim() || '',
        completed_at: formData.status === 'Completed' ? new Date().toISOString() : null,
        deleted: false,
        deleted_at: null
      };

      if (editingTask) {
        const { error } = await supabase.from('daily_tasks').update(taskData).eq('id', editingTask.id).eq('user_id', user.id);
        if (error) throw error;
        showToast('Task updated!', 'success');
      } else {
        const { error } = await supabase.from('daily_tasks').insert([taskData]);
        if (error) throw error;
        showToast('Task added!', 'success');
      }

      await fetchTasks();
      setShowModal(false);
      setEditingTask(null);
      setFormData({
        title: '', description: '', category: 'Work', priority: 'Medium',
        task_date: new Date().toISOString().split('T')[0], due_time: '',
        status: 'Pending', assigned_to: '', tags: '', notes: ''
      });
    } catch (error: any) {
      showToast(`Save failed: ${error?.message || 'Unknown error'}`, 'error');
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      task_date: task.task_date,
      due_time: task.due_time || '',
      status: task.status,
      assigned_to: task.assigned_to,
      tags: task.tags?.join(', ') || '',
      notes: task.notes
    });
    setShowModal(true);
  };

  const handleQuickStatusChange = async (id: number, newStatus: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled') => {
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'Completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase.from('daily_tasks').update(updateData).eq('id', id);
      if (error) throw error;
      await fetchTasks();
      showToast('Status updated!', 'success');
    } catch (error) {
      showToast('Update failed', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    showConfirm('Move this task to trash? (Auto-deletes in 7 days)', async () => {
      try {
        const { error } = await supabase
          .from('daily_tasks')
          .update({ deleted: true, deleted_at: new Date().toISOString() })
          .eq('id', id);

        if (error) throw error;
        await fetchTasks();
        showToast('Task moved to trash', 'success');
      } catch (error) {
        showToast('Delete failed', 'error');
      }
    });
  };

  const handleRestore = async (id: number) => {
    showConfirm('Restore this task from trash?', async () => {
      try {
        const { error } = await supabase
          .from('daily_tasks')
          .update({
            deleted: false,
            deleted_at: null
          })
          .eq('id', id);

        if (error) throw error;
        await fetchTasks();
        showToast('Task restored successfully!', 'success');
      } catch (error) {
        showToast('Restore failed', 'error');
      }
    });
  };

  const handleEmptyTrash = async () => {
    showConfirm('Empty trash? All trashed items will be permanently deleted.', async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { error } = await supabase.from('daily_tasks').delete().eq('user_id', user.id).eq('deleted', true);
        if (error) throw error;
        await fetchTasks();
        showToast('Trash emptied', 'success');
      } catch (error) {
        showToast('Failed', 'error');
      }
    });
  };

  // ============================================
  // BULK OPERATIONS
  // ============================================

  const handleBulkDelete = async () => {
    if (selectedTasks.length === 0) {
      showToast('No tasks selected', 'warning');
      return;
    }

    showConfirm(`Move ${selectedTasks.length} tasks to trash? (Auto-deletes in 7 days)`, async () => {
      try {
        const { error } = await supabase
          .from('daily_tasks')
          .update({ deleted: true, deleted_at: new Date().toISOString() })
          .in('id', selectedTasks);

        if (error) throw error;
        await fetchTasks();
        setSelectedTasks([]);
        showToast(`${selectedTasks.length} tasks moved to trash`, 'success');
      } catch (error) {
        showToast('Delete failed', 'error');
      }
    });
  };

  const handleBulkComplete = async () => {
    if (selectedTasks.length === 0) {
      showToast('No tasks selected', 'warning');
      return;
    }

    showConfirm(`Mark ${selectedTasks.length} tasks as completed?`, async () => {
      try {
        const { error } = await supabase
          .from('daily_tasks')
          .update({ status: 'Completed', completed_at: new Date().toISOString() })
          .in('id', selectedTasks);

        if (error) throw error;
        await fetchTasks();
        setSelectedTasks([]);
        showToast(`${selectedTasks.length} marked as completed`, 'success');
      } catch (error) {
        showToast('Update failed', 'error');
      }
    });
  };

  const handleBulkRestore = async () => {
    if (selectedTasks.length === 0) {
      showToast('No tasks selected', 'warning');
      return;
    }

    showConfirm(`Restore ${selectedTasks.length} tasks from trash?`, async () => {
      try {
        const { error } = await supabase
          .from('daily_tasks')
          .update({
            deleted: false,
            deleted_at: null
          })
          .in('id', selectedTasks);

        if (error) throw error;
        await fetchTasks();
        setSelectedTasks([]);
        showToast(`${selectedTasks.length} tasks restored`, 'success');
      } catch (error) {
        showToast('Restore failed', 'error');
      }
    });
  };

  const handleSelectAll = () => {
    const currentDataSource = showTrash ? filteredTrashTasks : filteredTasks;
    const currentPageItems = currentDataSource.slice(indexOfFirstItem, indexOfLastItem);

    if (selectedTasks.length === currentPageItems.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(currentPageItems.map(task => task.id));
    }
  };

  const toggleTaskSelection = (id: number) => {
    setSelectedTasks(prev => prev.includes(id) ? prev.filter(taskId => taskId !== id) : [...prev, id]);
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
      category: '', priority: '', status: '', date_from: '', date_to: ''
    });
    setSearchTerm('');
    showToast('Filters cleared', 'info');
  };

  const showNotes = (notes: string) => {
    setSelectedNotes(notes);
    setShowNotesModal(true);
  };

  // ============================================
  // STYLING FUNCTIONS
  // ============================================

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'Low': 'bg-green-50 text-green-700 border border-green-200',
      'Medium': 'bg-blue-50 text-blue-700 border border-blue-200',
      'High': 'bg-orange-50 text-orange-700 border border-orange-200',
      'Urgent': 'bg-red-50 text-red-700 border border-red-200'
    };
    return colors[priority] || 'bg-gray-50 text-gray-700 border border-gray-200';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Pending': 'bg-yellow-50 text-yellow-700 border border-yellow-200',
      'In Progress': 'bg-blue-50 text-blue-700 border border-blue-200',
      'Completed': 'bg-green-50 text-green-700 border border-green-200',
      'Cancelled': 'bg-gray-50 text-gray-700 border border-gray-200'
    };
    return colors[status] || 'bg-gray-50 text-gray-700 border border-gray-200';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Completed': return <CheckCircle size={12} />;
      case 'In Progress': return <Clock size={12} />;
      case 'Cancelled': return <X size={12} />;
      default: return <Clock size={12} />;
    }
  };

  // ============================================
  // FILTERING AND CALCULATIONS
  // ============================================

 // Add a new state for exact date filter
const [exactDateFilter, setExactDateFilter] = useState('');

// Then modify your filter functions:
const filteredTasks = tasks.filter(task => {
  const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.assigned_to?.toLowerCase().includes(searchTerm.toLowerCase());

  if (!matchesSearch) return false;
  if (filters.category && task.category !== filters.category) return false;
  if (filters.priority && task.priority !== filters.priority) return false;
  if (filters.status && task.status !== filters.status) return false;
  
  // For exact date matching (if you want to filter by specific date only)
  if (filters.date_from && !filters.date_to) {
    // If only date_from is set, treat it as exact date
    if (task.task_date !== filters.date_from) return false;
  } else {
    // Original range logic
    if (filters.date_from) {
      const taskDate = new Date(task.task_date);
      const filterDateFrom = new Date(filters.date_from);
      if (taskDate < filterDateFrom) return false;
    }
    
    if (filters.date_to) {
      const taskDate = new Date(task.task_date);
      const filterDateTo = new Date(filters.date_to);
      if (taskDate > filterDateTo) return false;
    }
  }
  
  return true;
});
  const filteredTrashTasks = trashedTasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.category.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (filters.category && task.category !== filters.category) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.status && task.status !== filters.status) return false;
    if (filters.date_from && task.task_date < filters.date_from) return false;
    if (filters.date_to && task.task_date > filters.date_to) return false;
    return true;
  });

  const categoryCounts = categories.map(cat => ({
    name: cat.name,
    count: tasks.filter(t => t.category === cat.name).length
  }));

  const totalTasks = tasks.length;
  const pendingCount = tasks.filter(t => t.status === 'Pending').length;
  const completedCount = tasks.filter(t => t.status === 'Completed').length;
  const inProgressCount = tasks.filter(t => t.status === 'In Progress').length;

  // ============================================
  // PAGINATION LOGIC
  // ============================================

  const currentDataSource = showTrash ? filteredTrashTasks : filteredTasks;
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

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-white border-t border-gray-200 gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>
            Showing <span className="font-semibold">{indexOfFirstItem + 1}</span> to{' '}
            <span className="font-semibold">{Math.min(indexOfLastItem, currentDataSource.length)}</span> of{' '}
            <span className="font-semibold">{currentDataSource.length}</span> {showTrash ? 'trashed' : ''} tasks
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
                ? 'bg-indigo-600 text-white border-indigo-600'
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tasks...</p>
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
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="text-indigo-600" size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Confirm Action</h3>
                </div>
                <p className="text-gray-600 mb-6">{confirmAction?.message}</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleConfirm}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-indigo-600 hover:from-indigo-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-all"
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
     {/* Notes Modal - No Scrolling Version */}
{showNotesModal && (
  <>
    <div 
      className="fixed inset-0 bg-black/50 z-[90] backdrop-blur-sm" 
      onClick={() => setShowNotesModal(false)} 
    />
    <div className="fixed inset-0 flex items-center justify-center p-4 z-[90] pointer-events-none">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full pointer-events-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-600 text-white p-6 rounded-t-xl flex items-center justify-between">
          <h3 className="text-xl font-bold">📝 Task Details</h3>
          <button 
            onClick={() => setShowNotesModal(false)} 
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        
        {/* Content Area - No max height, no scrolling */}
        <div className="p-6">
          <div className="bg-gray-50 rounded-lg p-6">
            <p className="text-gray-700 whitespace-pre-wrap break-words leading-relaxed text-base">
              {selectedNotes || 'No details available'}
            </p>
          </div>
          
          {/* Close button */}
          <div className="mt-6">
            <button
              onClick={() => setShowNotesModal(false)}
              className="w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-600 hover:from-indigo-700 hover:to-indigo-700 text-white rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </>
)}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-lg lg:text-xl font-bold text-gray-800 truncate">
              {showTrash ? '🗑️ Task Trash' : '✅ Daily To-Do List'}
            </h1>
            {showTrash && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                {trashedTasks.length} items (Auto-deletes in 7 days)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!showTrash && (
              <button
                onClick={() => {
                  setShowModal(true);
                  setEditingTask(null);
                  setFormData({
                    title: '', description: '', category: 'Work', priority: 'Medium',
                    task_date: new Date().toISOString().split('T')[0], due_time: '',
                    status: 'Pending', assigned_to: '', tags: '', notes: ''
                  });
                }}
                className="bg-gradient-to-r from-indigo-600 to-indigo-600 hover:from-indigo-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-md transition-all flex items-center gap-2 text-sm"
              >
                <Plus size={18} />
                <span>Add Task</span>
              </button>
            )}
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-4">

          {/* Stats Cards (Only show when not in trash) */}
          {!showTrash && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 shadow-md text-white">
                <p className="text-xs opacity-90 font-medium mb-1">Total Tasks</p>
                <p className="text-2xl font-bold">{totalTasks}</p>
                <p className="text-xs opacity-75 mt-1">All tasks</p>
              </div>
              <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-4 shadow-md text-white">
                <p className="text-xs opacity-90 font-medium mb-1">Pending</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-xs opacity-75 mt-1">Waiting</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 shadow-md text-white">
                <p className="text-xs opacity-90 font-medium mb-1">In Progress</p>
                <p className="text-2xl font-bold">{inProgressCount}</p>
                <p className="text-xs opacity-75 mt-1">Working on it</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 shadow-md text-white">
                <p className="text-xs opacity-90 font-medium mb-1">Completed</p>
                <p className="text-2xl font-bold">{completedCount}</p>
                <p className="text-xs opacity-75 mt-1">Done!</p>
              </div>
            </div>
          )}

          {/* Browse by Category Section */}
          {/* {!showTrash && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Browse by Category</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                {categories.map((category) => {
                  const count = categoryCounts.find(c => c.name === category.name)?.count || 0;
                  return (
                    <button 
                      key={category.name} 
                      onClick={() => setFilters(prev => ({ ...prev, category: category.name }))}
                      className={`p-4 rounded-xl border-2 transition-all ${filters.category === category.name
                        ? 'border-indigo-500 bg-indigo-50 shadow-md' : 'border-gray-200 bg-white hover:border-indigo-300'
                        }`}
                    >
                      <div className="text-3xl mb-2">{category.emoji}</div>
                      <div className="text-xs font-semibold text-gray-700 truncate">{category.name}</div>
                      <div className="text-lg font-bold text-indigo-600">{count}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
            */}

          {/* Action Bar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
            <div className="flex flex-col lg:flex-row gap-3">

              {/* Search */}
              <div className="w-full lg:w-64 flex-shrink-0">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder={`Search ${showTrash ? 'trash' : 'tasks'}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm
                     focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 flex-wrap flex-1">

                {!showTrash ? (
                  <>
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className="px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700
                       rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
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
                        className="px-4 py-2.5 bg-orange-50 border border-orange-200 hover:bg-orange-100 text-orange-700
                         rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
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
                      className="px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700
                       rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                      <Download size={18} />
                      <span>Export Excel</span>
                    </button>

                    <button
                      onClick={handleExportCSV}
                      className="px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700
                       rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                      <Download size={18} />
                      <span>Export CSV</span>
                    </button>

                    {trashedTasks.length > 0 && (
                      <button
                        onClick={handleEmptyTrash}
                        className="px-4 py-2.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700
                         rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                      >
                        <Trash2 size={18} />
                        <span>Empty Trash</span>
                      </button>
                    )}
                  </>
                )}

                {/* Trash Toggle Button (Always Visible) */}
                <button
                  onClick={() => setShowTrash(!showTrash)}
                  className="px-4 py-2.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700
                   rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ml-auto"
                >
                  {showTrash ? (
                    <>
                      <Undo2 size={18} />
                      <span>Back to Tasks</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={18} />
                      <span>Trash ({trashedTasks.length})</span>
                    </>
                  )}
                </button>

              </div>
            </div>
          </div>

          {/* Filter Section (Only show when not in trash) */}
          {showFilters && !showTrash && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800">Advanced Filters</h3>
                <button
                  onClick={clearFilters}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm font-medium"
                >
                  Clear All
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <select
                  name="category"
                  value={filters.category}
                  onChange={handleFilterChange}
                  className="px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                >
                  <option value="">All Categories</option>
                  {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
                <select
                  name="priority"
                  value={filters.priority}
                  onChange={handleFilterChange}
                  className="px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                >
                  <option value="">All Priorities</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
                <select
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                  className="px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                >
                  <option value="">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
                <input
                  type="date"
                  name="date_from"
                  placeholder="From"
                  value={filters.date_from}
                  onChange={handleFilterChange}
                  className="px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                />
                {/* <input
                  type="date"
                  name="date_to"
                  placeholder="To"
                  value={filters.date_to}
                  onChange={handleFilterChange}
                  className="px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                /> */}
              </div>
            </div>
          )}

          {/* Bulk Action Bar */}
          {selectedTasks.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-indigo-800">{selectedTasks.length} tasks selected</p>
              <div className="flex gap-2">
                {showTrash ? (
                  <button
                    onClick={handleBulkRestore}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    <Undo2 size={16} />
                    Restore Selected
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleBulkComplete}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                      <CheckCircle size={16} />
                      Mark Complete
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                      <Trash2 size={16} />
                      Move to Trash
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Table Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <thead className="bg-gradient-to-r from-indigo-600 to-indigo-600 text-white">
                  <tr>
                    <th className="p-3 text-left font-semibold whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedTasks.length === currentRecords.length && currentRecords.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded cursor-pointer"
                      />
                    </th>
                    <th className="p-3 text-left font-semibold whitespace-nowrap">Task</th>
                    <th className="p-3 text-left font-semibold whitespace-nowrap">Category</th>
                    <th className="p-3 text-left font-semibold whitespace-nowrap">Priority</th>
                    <th className="p-3 text-left font-semibold whitespace-nowrap">Date & Time</th>
                    {!showTrash && <th className="p-3 text-left font-semibold whitespace-nowrap">Status</th>}
                    <th className="p-3 text-left font-semibold whitespace-nowrap">Assigned</th>

                    {showTrash && <th className="p-3 text-left font-semibold whitespace-nowrap">Deleted On</th>}
                    <th className="p-3 text-left font-semibold whitespace-nowrap">Notes</th>
                    <th className="p-3 text-center font-semibold whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRecords.length === 0 ? (
                    <tr>
                      <td colSpan={showTrash ? 10 : 9} className="p-8 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle size={40} className="text-gray-400" />
                          <p className="text-base font-medium">
                            {showTrash ? 'No trashed tasks found' : 'No tasks found'}
                          </p>
                          {showTrash && trashedTasks.length === 0 && (
                            <p className="text-sm text-gray-400">Trash is empty. Items are automatically deleted after 7 days</p>
                          )}
                          {!showTrash && (
                            <button
                              onClick={() => {
                                setShowModal(true);
                                setEditingTask(null);
                              }}
                              className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                              Create Your First Task
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentRecords.map((task, index) => (
                      <tr key={task.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedTasks.includes(task.id)}
                            onChange={() => toggleTaskSelection(task.id)}
                            className="w-4 h-4 rounded cursor-pointer"
                          />
                        </td>
                        <td className="p-3">
                          <div className="font-medium text-gray-900">{task.title}</div>
                          {task.description && (
                            <div className="text-xs text-gray-500 mt-1 truncate max-w-xs">
                              {task.description}
                              {task.description.length > 50 && (
                                <button onClick={() => showNotes(task.description)} className="text-indigo-600 ml-1 text-xs hover:underline">
                                  View More
                                </button>
                              )}
                            </div>
                          )}
                          {task.tags && task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {task.tags.slice(0, 3).map((tag, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                  {tag}
                                </span>
                              ))}
                              {task.tags.length > 3 && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded text-xs">
                                  +{task.tags.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{categories.find(c => c.name === task.category)?.emoji || '📝'}</span>
                            <span className="text-gray-700">{task.category}</span>
                          </div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                            {task.priority === 'Urgent' && '🔥 '}
                            {task.priority}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">{formatDateToDisplay(task.task_date)}</div>
                            <div className="text-gray-500">{task.due_time || 'No time set'}</div>
                          </div>
                        </td>
                        {!showTrash && (
                          <td className="p-3 whitespace-nowrap">
                            <select
                              value={task.status}
                              onChange={(e) => handleQuickStatusChange(task.id, e.target.value as any)}
                              className={`px-3 py-1 rounded-full text-xs font-medium border-0 ${getStatusColor(task.status)}`}
                            >
                              <option value="Pending">Pending</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Completed">Completed</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                          </td>
                        )}
                        <td className="p-3 whitespace-nowrap">
                          <div className="text-sm text-gray-700">{task.assigned_to || '-'}</div>
                        </td>
                        <td className="p-3">
                          {task.notes && task.notes.trim() ? (
                            <button
                              onClick={() => {
                                setSelectedNotes(task.notes);
                                setShowNotesModal(true);
                              }}
                              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium hover:underline transition-colors px-2 py-1 rounded hover:bg-indigo-50"
                            >
                              View More
                            </button>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </td>
                        {showTrash && (
                          <td className="p-3 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {formatDateTime(task.deleted_at)}
                            </div>
                          </td>
                        )}
                        <td className="p-3 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            {showTrash ? (
                              <button
                                onClick={() => handleRestore(task.id)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Restore"
                              >
                                <Undo2 size={18} />
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleEdit(task)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 size={18} />
                                </button>
                                <button
                                  onClick={() => handleDelete(task.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Move to Trash"
                                >
                                  <Trash2 size={18} />
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

      {/* Add/Edit Task Modal */}
      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[90]" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[90] pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto">
              <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-600 text-white p-6 rounded-t-xl flex items-center justify-between">
                <h3 className="text-xl font-bold">{editingTask ? 'Edit Task' : 'Add New Task'}</h3>
                <button onClick={() => setShowModal(false)} className="text-white hover:text-gray-200">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Task Title *</label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                      placeholder="Enter task title"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                    placeholder="Task description (optional)"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                    >
                      {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                    <select
                      name="priority"
                      value={formData.priority}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">🔥 Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                    <input
                      type="date"
                      name="task_date"
                      value={formData.task_date}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                      required
                    />
                  </div>

                  {/* <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                      <input
                        type="time"
                        name="due_time"
                        value={formData.due_time}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                      />
                    </div>
                  </div> */}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Assigned To</label>
                    <input
                      type="text"
                      name="assigned_to"
                      value={formData.assigned_to}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                      placeholder="Assign to someone (optional)"
                    />
                  </div>

                  {/* <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                    <input
                      type="text"
                      name="tags"
                      value={formData.tags}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                      placeholder="Tags (comma separated)"
                    />
                  </div> */}

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                      placeholder="Additional notes"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-medium transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-600 hover:from-indigo-700 hover:to-indigo-700 text-white rounded-lg font-medium transition-all"
                  >
                    {editingTask ? 'Update Task' : 'Add Task'}
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