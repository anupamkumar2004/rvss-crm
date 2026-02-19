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
  Search,
  Tag,
  AlertCircle,
  CheckCircle,
  Info,
  RotateCcw,
  Trash,
  Download,
  Upload,
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

// ============================================
// INTERFACES
// ============================================

interface Product {
  id: number;
  user_id?: string;
  brand: string;
  category: string;
  subcategory: string;
  product_name: string;
  model_number: string;
  selling_price: number;
  remarks: string;
  last_updated: string;
  deleted: boolean;
  deleted_at: string | null;
  created_at?: string;
}

interface FormData {
  brand: string;
  customBrand: string;
  category: string;
  subcategory: string;
  product_name: string;
  model_number: string;
  selling_price: string;
  remarks: string;
}

interface Filters {
  brand: string;
  category: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface Brand {
  name: string;
  emoji: string;
  color: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function PricingPage() {
  const supabase = createClient();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [showTrash, setShowTrash] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [lastImportedIds, setLastImportedIds] = useState<number[]>([]);

  // PAGINATION STATES
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  const [filters, setFilters] = useState<Filters>({
    brand: '',
    category: ''
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [trashedProducts, setTrashedProducts] = useState<Product[]>([]);

  const [formData, setFormData] = useState<FormData>({
    brand: 'ESSL',
    customBrand: '',
    category: '',
    subcategory: '',
    product_name: '',
    model_number: '',
    selling_price: '',
    remarks: ''
  });

  const defaultBrands: Brand[] = [
    { name: 'ESSL', emoji: '🔷', color: 'from-blue-500 to-blue-600' },
    { name: 'Realtime', emoji: '🟢', color: 'from-green-500 to-green-600' },
    { name: 'ZKTeco', emoji: '🔴', color: 'from-red-500 to-red-600' },
    { name: 'Hikvision', emoji: '🟠', color: 'from-orange-500 to-orange-600' },
    { name: 'Dahua', emoji: '🟣', color: 'from-purple-500 to-purple-600' },
    { name: 'CP Plus', emoji: '🔵', color: 'from-indigo-500 to-indigo-600' }
  ];

  // Get all unique brands from products (includes custom brands)
  const allBrands = React.useMemo(() => {
    const customBrands = [...new Set(products.map(p => p.brand))]
      .filter(brand => !defaultBrands.find(db => db.name === brand))
      .map(brand => ({
        name: brand,
        emoji: '⚪',
        color: 'from-gray-500 to-gray-600'
      }));
    return [...defaultBrands, ...customBrands];
  }, [products]);

  // Fix hydration issue
  useEffect(() => {
    setMounted(true);
  }, []);

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

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
      fetchProducts();
      autoCleanupOldDeleted();
    }
  }, [mounted]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error('Auth error:', userError);
        showToast('Please login to continue', 'error');
        router.push('/login');
        return;
      }

      const { data: activeData, error: activeError } = await supabase
        .from('pricing_products')
        .select('*')
        .eq('user_id', user.id)
        .eq('deleted', false)
        .order('created_at', { ascending: false });

      if (activeError) throw activeError;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: trashedData, error: trashedError } = await supabase
        .from('pricing_products')
        .select('*')
        .eq('user_id', user.id)
        .eq('deleted', true)
        .gte('deleted_at', sevenDaysAgo.toISOString())
        .order('deleted_at', { ascending: false });

      if (trashedError) throw trashedError;

      setProducts(activeData || []);
      setTrashedProducts(trashedData || []);
    } catch (error: any) {
      console.error('Error:', error);
      showToast('Failed to fetch products', 'error');
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
        .from('pricing_products')
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
      const dataToExport = products.map((product, index) => ({
        'S.No': index + 1,
        'Brand': product.brand,
        'Category': product.category,
        'Subcategory': product.subcategory || '',
        'Product Name': product.product_name,
        'Model Number': product.model_number,
        'Selling Price': product.selling_price,
        'Remarks': product.remarks || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
      worksheet['!cols'] = Array(8).fill({ wch: 15 });
      XLSX.writeFile(workbook, `Products_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast(`Exported ${products.length} products`, 'success');
    } catch (error) {
      showToast('Export failed', 'error');
    }
  };

  const handleExportCSV = () => {
    try {
      const dataToExport = products.map((product, index) => ({
        'S.No': index + 1,
        'Brand': product.brand,
        'Product': product.product_name,
        'Model': product.model_number,
        'Price': product.selling_price
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Products_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      showToast(`Exported ${products.length} products`, 'success');
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

          const productsToImport = data.map((row: any) => {
            const normalized: any = {};
            Object.keys(row).forEach(key => {
              normalized[key.toLowerCase().trim().replace(/\s+/g, '_')] = row[key];
            });

            return {
              user_id: user.id,
              brand: normalized['brand'] || 'Other',
              category: normalized['category'] || '',
              subcategory: normalized['subcategory'] || '',
              product_name: normalized['product_name'] || '',
              model_number: normalized['model_number'] || '',
              selling_price: parseFloat(normalized['selling_price'] || '0'),
              remarks: normalized['remarks'] || '',
              last_updated: new Date().toISOString().split('T')[0],
              deleted: false,
              deleted_at: null
            };
          }).filter(product => product.product_name && product.model_number);

          if (productsToImport.length === 0) {
            showToast('No valid products found', 'warning');
            e.target.value = '';
            return;
          }

          const { data: insertedData, error } = await supabase
            .from('pricing_products')
            .insert(productsToImport)
            .select('id');

          if (error) throw error;

          const importedIds = insertedData?.map(item => item.id) || [];
          setLastImportedIds(importedIds);
          await fetchProducts();
          showToast(`Imported ${productsToImport.length} products!`, 'success');
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

    showConfirm(`Delete ${lastImportedIds.length} imported products?`, async () => {
      try {
        const { error } = await supabase.from('pricing_products').delete().in('id', lastImportedIds);
        if (error) throw error;
        await fetchProducts();
        showToast(`Deleted ${lastImportedIds.length} products`, 'success');
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

      if (!formData.product_name || !formData.model_number || !formData.category) {
        showToast('Please fill all required fields', 'error');
        return;
      }

      // Use custom brand if "Custom" is selected and customBrand is filled
      const finalBrand = formData.brand === 'Custom' && formData.customBrand.trim() 
        ? formData.customBrand.trim() 
        : formData.brand;

      if (formData.brand === 'Custom' && !formData.customBrand.trim()) {
        showToast('Please enter custom brand name', 'error');
        return;
      }

      const productData = {
        user_id: user.id,
        brand: finalBrand,
        category: formData.category.trim(),
        subcategory: formData.subcategory?.trim() || '',
        product_name: formData.product_name.trim(),
        model_number: formData.model_number.trim(),
        selling_price: parseFloat(formData.selling_price) || 0,
        remarks: formData.remarks?.trim() || '',
        last_updated: new Date().toISOString().split('T')[0],
        deleted: false,
        deleted_at: null
      };

      if (editingProduct) {
        const { error } = await supabase.from('pricing_products').update(productData).eq('id', editingProduct.id).eq('user_id', user.id);
        if (error) throw error;
        showToast('Product updated!', 'success');
      } else {
        const { error } = await supabase.from('pricing_products').insert([productData]);
        if (error) throw error;
        showToast('Product added!', 'success');
      }

      await fetchProducts();
      setShowModal(false);
      setEditingProduct(null);
      setFormData({
        brand: 'ESSL', customBrand: '', category: '', subcategory: '', product_name: '',
        model_number: '', selling_price: '', remarks: ''
      });
    } catch (error: any) {
      showToast(`Save failed: ${error?.message || 'Unknown error'}`, 'error');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);

    // Check if brand is in default list
    const isDefaultBrand = defaultBrands.find(b => b.name === product.brand);

    setFormData({
      brand: isDefaultBrand ? product.brand : 'Custom',
      customBrand: isDefaultBrand ? '' : product.brand,
      category: product.category,
      subcategory: product.subcategory,
      product_name: product.product_name,
      model_number: product.model_number,
      selling_price: product.selling_price.toString(),
      remarks: product.remarks
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    showConfirm('Move to trash? (Auto-deleted in 7 days)', async () => {
      try {
        const { error } = await supabase.from('pricing_products').update({ deleted: true, deleted_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
        await fetchProducts();
        showToast('Moved to trash', 'success');
      } catch (error) {
        showToast('Delete failed', 'error');
      }
    });
  };

  // RESTORE FUNCTION
  const handleRestore = async (id: number) => {
    showConfirm('Restore this product?', async () => {
      try {
        const { error } = await supabase.from('pricing_products').update({ deleted: false, deleted_at: null }).eq('id', id);
        if (error) throw error;
        await fetchProducts();
        showToast('Product restored!', 'success');
      } catch (error) {
        showToast('Restore failed', 'error');
      }
    });
  };

  // ============================================
  // BULK OPERATIONS
  // ============================================

  const handleBulkDelete = async () => {
    if (selectedProducts.length === 0) {
      showToast('No products selected', 'warning');
      return;
    }

    showConfirm(`Move ${selectedProducts.length} products to trash?`, async () => {
      try {
        const { error } = await supabase
          .from('pricing_products')
          .update({ deleted: true, deleted_at: new Date().toISOString() })
          .in('id', selectedProducts);

        if (error) throw error;
        await fetchProducts();
        setSelectedProducts([]);
        showToast(`${selectedProducts.length} moved to trash`, 'success');
      } catch (error) {
        showToast('Delete failed', 'error');
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === currentProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(currentProducts.map(product => product.id));
    }
  };

  const toggleProductSelection = (id: number) => {
    setSelectedProducts(prev => prev.includes(id) ? prev.filter(productId => productId !== id) : [...prev, id]);
  };

  // ============================================
  // FILTER FUNCTIONS
  // ============================================

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({ brand: '', category: '' });
    setSearchQuery('');
    setSelectedBrand('All');
    showToast('Filters cleared', 'info');
  };

  const showNotes = (notes: string) => {
    setSelectedNotes(notes);
    setShowNotesModal(true);
  };

  // ============================================
  // FILTERING AND CALCULATIONS
  // ============================================

  const filteredProducts = products.filter(product => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        product.product_name.toLowerCase().includes(query) ||
        product.model_number.toLowerCase().includes(query) ||
        product.brand.toLowerCase().includes(query) ||
        `${product.brand} ${product.model_number}`.toLowerCase().includes(query);

      if (!matchesSearch) return false;
    }

    if (selectedBrand !== 'All' && product.brand !== selectedBrand) return false;
    if (filters.brand && product.brand !== filters.brand) return false;
    if (filters.category && product.category.toLowerCase() !== filters.category.toLowerCase()) return false;

    return true;
  });

  // ============================================
  // PAGINATION LOGIC
  // ============================================

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters.brand, filters.category, selectedBrand]);

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
            <span className="font-semibold">{Math.min(indexOfLastItem, filteredProducts.length)}</span> of{' '}
            <span className="font-semibold">{filteredProducts.length}</span> results
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
              className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                currentPage === number
                  ? 'bg-teal-600 text-white border-teal-600'
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

  const uniqueCategories = [...new Set(products.map(p => p.category).filter(Boolean))];
  const totalProducts = products.length;
  const brandCounts = allBrands.map(brand => ({
    name: brand.name,
    emoji: brand.emoji,
    count: products.filter(p => p.brand === brand.name).length
  }));

  if (!mounted) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading products...</p>
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
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] ${
              toast.type === 'success' ? 'bg-green-500 text-white' :
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
                  <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="text-teal-600" size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Confirm Action</h3>
                </div>
                <p className="text-gray-600 mb-6">{confirmAction?.message}</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleConfirm}
                    className="flex-1 bg-gradient-to-r from-teal-600 to-teal-600 hover:from-teal-700 hover:to-teal-700 text-white px-4 py-2 rounded-lg font-medium transition-all"
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
              <div className="bg-gradient-to-r from-teal-600 to-teal-600 text-white p-4 rounded-t-xl flex items-center justify-between">
                <h3 className="text-xl font-bold">📝 Remarks</h3>
                <button onClick={() => setShowNotesModal(false)} className="text-white hover:text-gray-200">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6">
                <p className="text-gray-700 whitespace-pre-wrap">{selectedNotes || 'No remarks available'}</p>
              </div>
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
              {showTrash ? '🗑️ Trash Bin' : '💰 Product Pricing'}
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {showTrash ? (
              <button
                onClick={() => setShowTrash(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded-lg font-medium shadow-md transition-all flex items-center gap-1.5 text-sm"
              >
                <X size={16} />
                <span>Back</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setShowModal(true);
                  setEditingProduct(null);
                  setFormData({
                    brand: 'ESSL', customBrand: '', category: '', subcategory: '', product_name: '',
                    model_number: '', selling_price: '', remarks: ''
                  });
                }}
                className="bg-gradient-to-r from-teal-600 to-teal-600 hover:from-teal-700 hover:to-teal-700 text-white px-3 py-1.5 rounded-lg font-medium shadow-md transition-all flex items-center gap-1.5 text-sm"
              >
                <Plus size={16} />
                <span>Add Product</span>
              </button>
            )}
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-3 lg:p-4">

          {/* Brand Cards - BROWSE BY BRAND */}
          {!showTrash && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Browse by Brand</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                <button
                  onClick={() => setSelectedBrand('All')}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    selectedBrand === 'All' ? 'border-teal-500 bg-teal-50 shadow-md' : 'border-gray-200 bg-white hover:border-teal-300'
                  }`}
                >
                  <div className="text-2xl mb-1">🏢</div>
                  <div className="text-xs font-semibold text-gray-700">All</div>
                  <div className="text-lg font-bold text-teal-600">{totalProducts}</div>
                </button>
                {brandCounts.filter(b => b.count > 0).map((brand) => (
                  <button
                    key={brand.name}
                    onClick={() => setSelectedBrand(brand.name)}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      selectedBrand === brand.name ? 'border-teal-500 bg-teal-50 shadow-md' : 'border-gray-200 bg-white hover:border-teal-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">{brand.emoji}</div>
                    <div className="text-xs font-semibold text-gray-700 truncate">{brand.name}</div>
                    <div className="text-lg font-bold text-teal-600">{brand.count}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Bar */}
          {!showTrash && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2.5 mb-4">
              <div className="flex flex-col lg:flex-row gap-2">
                <div className="w-full lg:w-64 flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-800"
                    />
                  </div>
                </div>

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
                    <span>Trash ({trashedProducts.length})</span>
                  </button>
                </div>
              </div>

              {showFilters && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <select
                      name="brand"
                      value={filters.brand}
                      onChange={handleFilterChange}
                      className="px-2 py-1.5 border rounded text-xs text-gray-800 bg-white"
                    >
                      <option value="">All Brands</option>
                      {allBrands.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                    </select>
                    <input
                      type="text"
                      name="category"
                      placeholder="Filter by category"
                      value={filters.category}
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

              {selectedProducts.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-xs text-gray-600 font-medium">{selectedProducts.length} selected</p>
                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium flex items-center gap-1"
                  >
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
                  <thead className="bg-gradient-to-r from-teal-600 to-teal-600 text-white">
                    <tr>
                      <th className="p-2 text-left font-semibold whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedProducts.length === currentProducts.length && currentProducts.length > 0}
                          onChange={handleSelectAll}
                          className="w-3 h-3 rounded cursor-pointer"
                        />
                      </th>
                      <th className="p-2 text-left font-semibold whitespace-nowrap">S.No</th>
                      <th className="p-2 text-left font-semibold whitespace-nowrap">Brand</th>
                      <th className="p-2 text-left font-semibold whitespace-nowrap">Product</th>
                      <th className="p-2 text-left font-semibold whitespace-nowrap">Category</th>
                      <th className="p-2 text-left font-semibold whitespace-nowrap">Model</th>
                      <th className="p-2 text-left font-semibold whitespace-nowrap">Selling Price</th>
                      <th className="p-2 text-left font-semibold whitespace-nowrap">Remarks</th>
                      <th className="p-2 text-center font-semibold whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentProducts.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-gray-500">
                          <div className="flex flex-col items-center gap-2">
                            <AlertCircle size={32} className="text-gray-400" />
                            <p className="text-sm">No products found</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      currentProducts.map((product, index) => (
                        <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={selectedProducts.includes(product.id)}
                              onChange={() => toggleProductSelection(product.id)}
                              className="w-3 h-3 rounded cursor-pointer"
                            />
                          </td>
                          <td className="p-2 text-gray-600 whitespace-nowrap">{indexOfFirstItem + index + 1}</td>
                          <td className="p-2 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <span className="text-lg">{allBrands.find(b => b.name === product.brand)?.emoji || '🏷️'}</span>
                              <span className="font-medium text-gray-900">{product.brand}</span>
                            </div>
                          </td>
                          <td className="p-2 font-medium text-gray-900 whitespace-nowrap">{product.product_name}</td>
                          <td className="p-2 text-gray-600 whitespace-nowrap">
                            <div>{product.category}</div>
                            {product.subcategory && <div className="text-xs text-gray-500">{product.subcategory}</div>}
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-800">
                              {product.model_number}
                            </span>
                          </td>
                          <td className="p-2 text-teal-600 font-semibold whitespace-nowrap">₹{product.selling_price.toLocaleString()}</td>
                          <td className="p-2 whitespace-nowrap">
                            {product.remarks ? (
                              <button
                                onClick={() => showNotes(product.remarks)}
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
                                onClick={() => handleEdit(product)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(product.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 size={14} />
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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-red-50 border-b border-red-200">
                <div className="flex items-center gap-3">
                  <Trash className="text-red-600" size={24} />
                  <div>
                    <h3 className="text-lg font-bold text-red-800">🗑️ Trash Bin</h3>
                    <p className="text-sm text-red-600">⚠️ Auto-deletes after 7 days</p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left font-semibold">Brand</th>
                      <th className="p-2 text-left font-semibold">Product</th>
                      <th className="p-2 text-left font-semibold">Model</th>
                      <th className="p-2 text-left font-semibold">Price</th>
                      <th className="p-2 text-left font-semibold">Deleted Date</th>
                      <th className="p-2 text-center font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trashedProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-500">
                          <p className="text-sm">Trash is empty</p>
                        </td>
                      </tr>
                    ) : (
                      trashedProducts.map(product => (
                        <tr key={product.id} className="border-b border-gray-100">
                          <td className="p-2 font-medium text-gray-900">{product.brand}</td>
                          <td className="p-2 text-gray-600">{product.product_name}</td>
                          <td className="p-2 text-gray-600">{product.model_number}</td>
                          <td className="p-2 text-gray-600">₹{product.selling_price.toLocaleString()}</td>
                          <td className="p-2 text-gray-600">
                            {product.deleted_at ? new Date(product.deleted_at).toLocaleDateString() : '-'}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => handleRestore(product.id)}
                              className="px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs font-medium inline-flex items-center gap-1"
                            >
                              <RefreshCw size={12} />
                              Restore
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl pointer-events-auto max-h-[95vh] overflow-hidden flex flex-col">

              <div className="sticky top-0 bg-gradient-to-r from-teal-600 to-teal-600 text-white p-4 rounded-t-xl flex items-center justify-between">
                <h3 className="text-xl font-bold">
                  {editingProduct ? '✏️ Edit Product' : '➕ Add New Product'}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingProduct(null);
                  }}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 overflow-y-auto">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Brand <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="brand"
                      value={formData.brand}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-800"
                      required
                    >
                      {defaultBrands.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                      <option value="Custom">➕ Add Custom Brand</option>
                    </select>
                  </div>

                  {formData.brand === 'Custom' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Custom Brand Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="customBrand"
                        value={formData.customBrand}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-800"
                        placeholder="Enter new brand name"
                        required
                      />
                    </div>
                  )}

                  <div className={formData.brand !== 'Custom' ? 'md:col-start-2' : ''}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Category <span className="text-red-500">*</span> <span className="text-gray-500 text-xs">(Type your own)</span>
                    </label>
                    <input
                      type="text"
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-800"
                      placeholder="e.g. Biometric, CCTV, Access Control"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Subcategory
                    </label>
                    <input
                      type="text"
                      name="subcategory"
                      value={formData.subcategory}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-800"
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Product Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="product_name"
                      value={formData.product_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-800"
                      placeholder="Enter product name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Model Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="model_number"
                      value={formData.model_number}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-800"
                      placeholder="Enter model number"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Selling Price <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="selling_price"
                      value={formData.selling_price}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-800"
                      placeholder="₹0"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Remarks / Notes
                    </label>
                    <textarea
                      name="remarks"
                      value={formData.remarks}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-800"
                      placeholder="Additional notes..."
                      rows={2}
                    />
                  </div>

                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-teal-600 to-teal-600 hover:from-teal-700 hover:to-teal-700 text-white px-6 py-3 rounded-lg font-semibold shadow-md transition-all text-sm"
                  >
                    {editingProduct ? 'Update Product' : 'Add Product'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingProduct(null);
                    }}
                    className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-semibold transition-all text-sm"
                  >
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