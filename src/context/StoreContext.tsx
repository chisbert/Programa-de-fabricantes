import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { 
  Manufacturer, 
  Product, 
  PurchaseOrder, 
  PurchaseOrderItem, 
  BedSize, 
  TextileCategory, 
  CategoryInfo,
  PriceRecord 
} from '../types';
import { 
  INITIAL_MANUFACTURERS, 
  INITIAL_PRODUCTS, 
  INITIAL_ORDERS,
  TEXTILE_CATEGORIES 
} from '../data/seedData';
import { 
  fileSystemService, 
  getSavedDirectoryHandle, 
  clearSavedDirectoryHandle 
} from '../services/fileSystemService';

export interface LocalFolderState {
  isSupported: boolean;
  isConnected: boolean;
  folderName: string | null;
  lastSyncTime: string | null;
  autoSave: boolean;
  errorMessage: string | null;
}

interface StoreContextType {
  manufacturers: Manufacturer[];
  products: Product[];
  orders: PurchaseOrder[];
  priceRecords: PriceRecord[];

  // Local Desktop Folder Sync
  localFolder: LocalFolderState;
  selectDesktopFolder: () => Promise<boolean>;
  disconnectDesktopFolder: () => Promise<void>;
  syncToDesktopFolder: () => Promise<{ success: boolean; message?: string }>;
  loadFromDesktopFolder: () => Promise<{ success: boolean; message: string }>;
  toggleAutoSaveToFolder: (enabled: boolean) => void;

  // Categories
  categories: CategoryInfo[];
  addCategory: (cat: { label: string; description?: string }) => CategoryInfo;
  updateCategory: (id: string, updated: Partial<CategoryInfo>) => void;
  deleteCategory: (id: string) => { success: boolean; message?: string };
  getCategoryById: (id: string) => CategoryInfo | undefined;

  // CRUD actions
  addOrder: (orderData: Omit<PurchaseOrder, 'id' | 'createdAt'>) => PurchaseOrder;
  updateOrder: (id: string, updated: Partial<PurchaseOrder>) => void;
  deleteOrder: (id: string) => void;
  updateOrderItemDelivery: (orderId: string, itemId: string, isReceived: boolean, receivedQuantity?: number) => void;
  markAllOrderItemsReceived: (orderId: string, received: boolean) => void;
  importSingleOrderJson: (jsonOrText: string) => { success: boolean; message: string; order?: PurchaseOrder };
  addProduct: (productData: Omit<Product, 'id'>) => Product;
  updateProduct: (id: string, updated: Partial<Product>) => void;
  addManufacturer: (mfgData: Omit<Manufacturer, 'id'>) => Manufacturer;
  updateManufacturer: (id: string, updated: Partial<Manufacturer>) => void;
  deleteManufacturer: (id: string) => boolean;

  // Stock adjustments
  updateStock: (productId: string, bedSize: BedSize, quantityChange: number) => void;

  // Lookups & Analytics helpers
  getManufacturerById: (id: string) => Manufacturer | undefined;
  getProductById: (id: string) => Product | undefined;
  getLatestPrice: (productId: string, bedSize: BedSize) => { unitCost: number; date: string; orderNumber: string; mfgName: string } | null;
  getLatestPriceByMfg: (mfgId: string, productId: string, bedSize: BedSize) => { unitCost: number; date: string; orderNumber: string } | null;
  getPriceHistoryByItem: (productId: string, bedSize: BedSize) => PriceRecord[];

  // Data management
  resetToSampleData: () => void;
  exportBackupJson: () => void;
  importBackupJson: (jsonData: string) => boolean;
  exportOrdersToCsv: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const STORAGE_KEYS = {
  MFGS: 'tramahogar_manufacturers_v1',
  PRODS: 'tramahogar_products_v1',
  ORDERS: 'tramahogar_orders_v1',
  CATEGORIES: 'tramahogar_categories_v1',
  AUTOSAVE: 'tramahogar_autosave_folder_v1',
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MFGS);
      return saved ? JSON.parse(saved) : INITIAL_MANUFACTURERS;
    } catch {
      return INITIAL_MANUFACTURERS;
    }
  });

  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PRODS);
      return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
    } catch {
      return INITIAL_PRODUCTS;
    }
  });

  const [orders, setOrders] = useState<PurchaseOrder[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ORDERS);
      const rawOrders: PurchaseOrder[] = saved ? JSON.parse(saved) : INITIAL_ORDERS;
      // Normalización de IVA al 26.2% y estado de entrega de artículos
      return rawOrders.map(o => {
        let vat = o.vatRate;
        let tot = o.total;
        if (o.vatRate === 21 || !o.vatRate) {
          vat = 26.2;
          tot = Number((o.subtotal * 1.262).toFixed(2));
        }

        const normalizedItems = (o.items || []).map(item => {
          const hasRecQty = item.receivedQuantity !== undefined;
          const hasIsRec = item.isReceived !== undefined;
          if (!hasRecQty && !hasIsRec) {
            const isFull = o.status === 'recibido';
            return {
              ...item,
              isReceived: isFull,
              receivedQuantity: isFull ? item.quantity : 0,
            };
          }
          return {
            ...item,
            isReceived: item.isReceived ?? ((item.receivedQuantity ?? 0) >= item.quantity),
            receivedQuantity: item.receivedQuantity ?? (item.isReceived ? item.quantity : 0),
          };
        });

        return {
          ...o,
          vatRate: vat,
          total: tot,
          items: normalizedItems,
        };
      });
    } catch {
      return INITIAL_ORDERS;
    }
  });

  const [categories, setCategories] = useState<CategoryInfo[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      return saved ? JSON.parse(saved) : TEXTILE_CATEGORIES;
    } catch {
      return TEXTILE_CATEGORIES;
    }
  });

  // Local folder handle reference
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);

  const [localFolder, setLocalFolder] = useState<LocalFolderState>({
    isSupported: fileSystemService.isSupported(),
    isConnected: false,
    folderName: null,
    lastSyncTime: null,
    autoSave: (() => {
      try {
        return localStorage.getItem(STORAGE_KEYS.AUTOSAVE) !== 'false';
      } catch {
        return true;
      }
    })(),
    errorMessage: null,
  });

  // Helper to build CSV content
  const buildCsvContent = () => {
    const headers = [
      'Nº Albarán/Pedido',
      'Fecha',
      'Semana',
      'Fabricante',
      'Referencia',
      'Artículo',
      'Categoría',
      'Medida Cama',
      'Cantidad',
      'Coste Unitario Neto (€)',
      'Coste Real c/ R.E. 26,2% (€)',
      'Subtotal Neto (€)',
      'Total con R.E. 26,2% (€)',
    ];

    const rows: string[][] = [];

    orders.forEach(order => {
      const mfg = manufacturers.find(m => m.id === order.manufacturerId)?.name || 'Desconocido';
      order.items.forEach(item => {
        const lineNet = item.quantity * item.unitCost;
        const lineWithRE = lineNet * 1.262;
        const unitWithRE = item.unitCost * 1.262;

        rows.push([
          `"${order.orderNumber}"`,
          `"${order.orderDate}"`,
          `"Semana ${order.weekNumber}"`,
          `"${mfg}"`,
          `"${item.ref}"`,
          `"${item.productName.replace(/"/g, '""')}"`,
          `"${item.category}"`,
          `"Cama ${item.bedSize}"`,
          `"${item.quantity}"`,
          `"${item.unitCost.toFixed(2).replace('.', ',')}"`,
          `"${unitWithRE.toFixed(2).replace('.', ',')}"`,
          `"${lineNet.toFixed(2).replace('.', ',')}"`,
          `"${lineWithRE.toFixed(2).replace('.', ',')}"`,
        ]);
      });
    });

    return '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  };

  // Attempt to recover previously selected folder on load
  useEffect(() => {
    async function recoverFolder() {
      if (!fileSystemService.isSupported()) return;
      try {
        const savedHandle = await getSavedDirectoryHandle();
        if (savedHandle) {
          dirHandleRef.current = savedHandle;
          setLocalFolder(prev => ({
            ...prev,
            isConnected: true,
            folderName: savedHandle.name,
          }));
        }
      } catch (e) {
        console.warn('No se pudo recuperar la carpeta previa', e);
      }
    }
    recoverFolder();
  }, []);

  // Sync current state to the desktop folder
  const syncToDesktopFolder = async (): Promise<{ success: boolean; message?: string }> => {
    if (!dirHandleRef.current) {
      return { success: false, message: 'No hay ninguna carpeta de escritorio seleccionada.' };
    }

    try {
      const hasPerm = await fileSystemService.verifyPermission(dirHandleRef.current, true);
      if (!hasPerm) {
        return { success: false, message: 'Permiso de escritura denegado en la carpeta del escritorio.' };
      }

      const backupData = {
        exportDate: new Date().toISOString(),
        appName: 'TramaHogar',
        taxRegime: 'Comunidad de Bienes - Recargo de Equivalencia (26.2%)',
        manufacturers,
        products,
        categories,
        orders,
      };

      const csvContent = buildCsvContent();
      const res = await fileSystemService.writeFilesToDirectory(dirHandleRef.current, backupData, csvContent);

      const nowStr = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLocalFolder(prev => ({
        ...prev,
        isConnected: true,
        lastSyncTime: nowStr,
        errorMessage: null,
      }));

      return { 
        success: true, 
        message: `Guardado en "${dirHandleRef.current.name}": ${res.filesWritten.join(', ')}` 
      };
    } catch (err: any) {
      console.error('Error al sincronizar con carpeta del escritorio', err);
      setLocalFolder(prev => ({
        ...prev,
        errorMessage: err.message || 'Error al guardar en la carpeta local',
      }));
      return { success: false, message: err.message };
    }
  };

  // Select a new folder (e.g. on Desktop)
  const selectDesktopFolder = async (): Promise<boolean> => {
    try {
      const handle = await fileSystemService.pickDirectory();
      if (!handle) return false;

      dirHandleRef.current = handle;
      setLocalFolder(prev => ({
        ...prev,
        isConnected: true,
        folderName: handle.name,
        errorMessage: null,
      }));

      // Check if the chosen folder already contains store data
      const existingData = await fileSystemService.readDataFromDirectory(handle);
      if (existingData && (existingData.orders || existingData.products || existingData.manufacturers)) {
        importBackupJson(JSON.stringify(existingData));
      } else {
        // First time in folder: write current data
        const backupData = {
          exportDate: new Date().toISOString(),
          appName: 'TramaHogar',
          taxRegime: 'Comunidad de Bienes - Recargo de Equivalencia (26.2%)',
          manufacturers,
          products,
          categories,
          orders,
        };
        const csvContent = buildCsvContent();
        await fileSystemService.writeFilesToDirectory(handle, backupData, csvContent);
      }

      const nowStr = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLocalFolder(prev => ({
        ...prev,
        lastSyncTime: nowStr,
      }));

      return true;
    } catch (err: any) {
      alert(`No se pudo seleccionar la carpeta: ${err.message}`);
      return false;
    }
  };

  // Explicitly load/reload data from the connected desktop folder
  const loadFromDesktopFolder = async (): Promise<{ success: boolean; message: string }> => {
    if (!dirHandleRef.current) {
      return { success: false, message: 'No hay ninguna carpeta de escritorio seleccionada.' };
    }

    try {
      const hasPerm = await fileSystemService.verifyPermission(dirHandleRef.current, false);
      if (!hasPerm) {
        return { success: false, message: 'Permiso de lectura denegado para la carpeta del escritorio.' };
      }

      const existingData = await fileSystemService.readDataFromDirectory(dirHandleRef.current);
      if (!existingData) {
        return { 
          success: false, 
          message: 'No se encontró el archivo "tramahogar_datos_tienda.json" en la carpeta seleccionada.' 
        };
      }

      const success = importBackupJson(JSON.stringify(existingData));
      if (!success) {
        return { 
          success: false, 
          message: 'El archivo de datos encontrado en la carpeta no tiene un formato válido.' 
        };
      }

      const nowStr = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLocalFolder(prev => ({
        ...prev,
        lastSyncTime: nowStr,
      }));

      const orderCount = existingData.orders?.length || 0;
      const prodCount = existingData.products?.length || 0;

      return { 
        success: true, 
        message: `Datos cargados con éxito desde la carpeta: ${orderCount} pedidos y ${prodCount} artículos actualizados.` 
      };
    } catch (err: any) {
      return { success: false, message: `Error al leer de la carpeta: ${err.message}` };
    }
  };

  const disconnectDesktopFolder = async () => {
    dirHandleRef.current = null;
    await clearSavedDirectoryHandle();
    setLocalFolder(prev => ({
      ...prev,
      isConnected: false,
      folderName: null,
      lastSyncTime: null,
      errorMessage: null,
    }));
  };

  const toggleAutoSaveToFolder = (enabled: boolean) => {
    setLocalFolder(prev => ({ ...prev, autoSave: enabled }));
    try {
      localStorage.setItem(STORAGE_KEYS.AUTOSAVE, enabled ? 'true' : 'false');
    } catch {
      // Ignore
    }
  };

  // Auto-save whenever data changes if connected and enabled
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MFGS, JSON.stringify(manufacturers));
    } catch (e) {
      console.error(e);
    }
  }, [manufacturers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PRODS, JSON.stringify(products));
    } catch (e) {
      console.error(e);
    }
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    } catch (e) {
      console.error(e);
    }
  }, [categories]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    } catch (e) {
      console.error(e);
    }

    // Auto-save files directly to the Desktop folder if connected
    if (localFolder.isConnected && localFolder.autoSave && dirHandleRef.current) {
      syncToDesktopFolder();
    }
  }, [orders]);

  // Derived price records
  const priceRecords = useMemo(() => {
    const list: PriceRecord[] = [];
    orders.forEach(order => {
      order.items.forEach(item => {
        list.push({
          id: `${order.id}-${item.id}`,
          productId: item.productId,
          productName: item.productName,
          ref: item.ref,
          manufacturerId: order.manufacturerId,
          category: item.category,
          bedSize: item.bedSize,
          unitCost: item.unitCost,
          orderId: order.id,
          orderNumber: order.orderNumber,
          date: order.orderDate,
        });
      });
    });
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders]);

  const getManufacturerById = (id: string) => manufacturers.find(m => m.id === id);
  const getProductById = (id: string) => products.find(p => p.id === id);

  const getLatestPrice = (productId: string, bedSize: BedSize) => {
    const match = priceRecords.find(r => r.productId === productId && r.bedSize === bedSize);
    if (!match) return null;
    const mfg = getManufacturerById(match.manufacturerId);
    return {
      unitCost: match.unitCost,
      date: match.date,
      orderNumber: match.orderNumber,
      mfgName: mfg?.name || 'Proveedor desconocido',
    };
  };

  const getLatestPriceByMfg = (mfgId: string, productId: string, bedSize: BedSize) => {
    const match = priceRecords.find(
      r => r.manufacturerId === mfgId && r.productId === productId && r.bedSize === bedSize
    );
    if (!match) return null;
    return {
      unitCost: match.unitCost,
      date: match.date,
      orderNumber: match.orderNumber,
    };
  };

  const getPriceHistoryByItem = (productId: string, bedSize: BedSize) => {
    return priceRecords
      .filter(r => r.productId === productId && r.bedSize === bedSize)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const addOrder = (orderData: Omit<PurchaseOrder, 'id' | 'createdAt'>): PurchaseOrder => {
    const newId = `ord-${Date.now()}`;
    const newOrder: PurchaseOrder = {
      ...orderData,
      id: newId,
      createdAt: new Date().toISOString(),
    };

    setOrders(prev => [newOrder, ...prev]);

    // Update product stock automatically
    setProducts(prevProducts => {
      return prevProducts.map(prod => {
        const orderItemsForProd = newOrder.items.filter(item => item.productId === prod.id);
        if (orderItemsForProd.length === 0) return prod;

        const updatedStockBySize = { ...prod.stockBySize };
        orderItemsForProd.forEach(item => {
          const current = updatedStockBySize[item.bedSize] || 0;
          updatedStockBySize[item.bedSize] = current + item.quantity;
        });

        return {
          ...prod,
          stockBySize: updatedStockBySize,
        };
      });
    });

    return newOrder;
  };

  const deleteOrder = (id: string) => {
    setOrders(prev => prev.filter(o => o.id !== id));
  };

  const updateOrder = (id: string, updated: Partial<PurchaseOrder>) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updated } : o));
  };

  const updateOrderItemDelivery = (
    orderId: string,
    itemId: string,
    isReceived: boolean,
    receivedQuantity?: number
  ) => {
    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order;

      const updatedItems = order.items.map(item => {
        if (item.id !== itemId) return item;
        const finalReceivedQty = receivedQuantity !== undefined
          ? Math.max(0, Math.min(item.quantity, receivedQuantity))
          : (isReceived ? item.quantity : 0);
        const finalIsReceived = isReceived !== undefined
          ? isReceived
          : finalReceivedQty >= item.quantity;
        return {
          ...item,
          isReceived: finalIsReceived,
          receivedQuantity: finalReceivedQty,
        };
      });

      // Compute total ordered vs total received
      const totalOrdered = updatedItems.reduce((sum, i) => sum + i.quantity, 0);
      const totalReceived = updatedItems.reduce((sum, i) => sum + (i.receivedQuantity ?? (i.isReceived ? i.quantity : 0)), 0);

      let newStatus: PurchaseOrder['status'] = order.status;
      if (totalReceived >= totalOrdered) {
        newStatus = 'recibido';
      } else if (totalReceived > 0) {
        newStatus = 'parcial';
      } else {
        newStatus = order.status === 'recibido' ? 'en_transito' : order.status;
      }

      return {
        ...order,
        status: newStatus,
        items: updatedItems,
      };
    }));
  };

  const markAllOrderItemsReceived = (orderId: string, received: boolean) => {
    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order;

      const updatedItems = order.items.map(item => ({
        ...item,
        isReceived: received,
        receivedQuantity: received ? item.quantity : 0,
      }));

      return {
        ...order,
        status: received ? 'recibido' : 'en_transito',
        items: updatedItems,
      };
    }));
  };

  const addProduct = (productData: Omit<Product, 'id'>): Product => {
    const newProduct: Product = {
      ...productData,
      id: `prod-${Date.now()}`,
    };
    setProducts(prev => [...prev, newProduct]);
    return newProduct;
  };

  const updateProduct = (id: string, updated: Partial<Product>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
  };

  const addManufacturer = (mfgData: Omit<Manufacturer, 'id'>): Manufacturer => {
    const newMfg: Manufacturer = {
      ...mfgData,
      id: `mfg-${Date.now()}`,
    };
    setManufacturers(prev => [...prev, newMfg]);
    return newMfg;
  };

  const updateManufacturer = (id: string, updated: Partial<Manufacturer>) => {
    setManufacturers(prev => prev.map(m => m.id === id ? { ...m, ...updated } : m));
  };

  const deleteManufacturer = (id: string) => {
    const hasProducts = products.some(p => p.manufacturerId === id);
    const hasOrders = orders.some(o => o.manufacturerId === id);
    if (hasProducts || hasOrders) {
      return false;
    }
    setManufacturers(prev => prev.filter(m => m.id !== id));
    return true;
  };

  const updateStock = (productId: string, bedSize: BedSize, quantityChange: number) => {
    setProducts(prev => prev.map(prod => {
      if (prod.id !== productId) return prod;
      const current = prod.stockBySize[bedSize] || 0;
      return {
        ...prod,
        stockBySize: {
          ...prod.stockBySize,
          [bedSize]: Math.max(0, current + quantityChange),
        },
      };
    }));
  };

  // Category management methods
  const addCategory = (catData: { label: string; description?: string }): CategoryInfo => {
    const slug = catData.label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || `cat_${Date.now()}`;

    const finalId = categories.some(c => c.id === slug) ? `${slug}_${Date.now()}` : slug;

    const newCat: CategoryInfo = {
      id: finalId,
      label: catData.label.trim(),
      description: catData.description?.trim() || '',
      isCustom: true,
    };
    setCategories(prev => [...prev, newCat]);
    return newCat;
  };

  const updateCategory = (id: string, updated: Partial<CategoryInfo>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
  };

  const deleteCategory = (id: string): { success: boolean; message?: string } => {
    const hasProducts = products.some(p => p.category === id);
    if (hasProducts) {
      return { success: false, message: 'No se puede eliminar la categoría porque hay prendas en el catálogo asignadas a ella.' };
    }
    setCategories(prev => prev.filter(c => c.id !== id));
    return { success: true };
  };

  const getCategoryById = (id: string) => categories.find(c => c.id === id);

  const resetToSampleData = () => {
    setManufacturers(INITIAL_MANUFACTURERS);
    setProducts(INITIAL_PRODUCTS);
    setOrders(INITIAL_ORDERS);
    setCategories(TEXTILE_CATEGORIES);
    localStorage.removeItem(STORAGE_KEYS.MFGS);
    localStorage.removeItem(STORAGE_KEYS.PRODS);
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.removeItem(STORAGE_KEYS.CATEGORIES);
  };

  const exportBackupJson = () => {
    const backup = {
      exportDate: new Date().toISOString(),
      appName: 'TramaHogar',
      version: '1.0',
      taxRegime: 'Comunidad de Bienes - Recargo de Equivalencia (26.2%)',
      manufacturers,
      products,
      categories,
      orders,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TramaHogar_CopiaSeguridad_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackupJson = (jsonData: string): boolean => {
    try {
      const data = JSON.parse(jsonData);
      if (data.manufacturers && data.products && data.orders) {
        setManufacturers(data.manufacturers);
        setProducts(data.products);
        setOrders(data.orders);
        if (data.categories && Array.isArray(data.categories)) {
          setCategories(data.categories);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const importSingleOrderJson = (jsonOrText: string): { success: boolean; message: string; order?: PurchaseOrder } => {
    try {
      const parsed = JSON.parse(jsonOrText);
      // Check if it's a full backup
      if (parsed.manufacturers && parsed.products && parsed.orders) {
        const ok = importBackupJson(jsonOrText);
        return ok 
          ? { success: true, message: `Copia de seguridad cargada: ${parsed.orders.length} pedidos y ${parsed.products.length} prendas.` }
          : { success: false, message: 'El archivo no tiene una estructura válida.' };
      }

      // Check if it's a single order object
      if (parsed.orderNumber && Array.isArray(parsed.items) && parsed.items.length > 0) {
        const mfgId = parsed.manufacturerId || manufacturers[0]?.id;
        const today = new Date();
        const newOrder = addOrder({
          orderNumber: parsed.orderNumber,
          orderDate: parsed.orderDate || today.toISOString().split('T')[0],
          weekNumber: parsed.weekNumber || Math.ceil((((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / 86400000) + 1) / 7),
          year: parsed.year || today.getFullYear(),
          manufacturerId: mfgId,
          status: parsed.status || 'recibido',
          items: parsed.items,
          discountPercentage: parsed.discountPercentage || 0,
          vatRate: 26.2,
          subtotal: parsed.subtotal || parsed.items.reduce((s: number, i: any) => s + (i.unitCost * i.quantity), 0),
          total: parsed.total || Number(((parsed.subtotal || 0) * 1.262).toFixed(2)),
          notes: parsed.notes || 'Pedido importado desde archivo.',
        });
        return { 
          success: true, 
          message: `Pedido ${newOrder.orderNumber} importado correctamente con ${newOrder.items.length} artículos.`,
          order: newOrder 
        };
      }

      return { success: false, message: 'El archivo no contiene un pedido con formato reconocido.' };
    } catch (e: any) {
      return { success: false, message: `Error al procesar el archivo: ${e.message}` };
    }
  };

  const exportOrdersToCsv = () => {
    const csvContent = buildCsvContent();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TramaHogar_RegistroCompras_RE26.2_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <StoreContext.Provider
      value={{
        categories,
        addCategory,
        updateCategory,
        deleteCategory,
        getCategoryById,
        manufacturers,
        products,
        orders,
        priceRecords,
        localFolder,
        selectDesktopFolder,
        disconnectDesktopFolder,
        syncToDesktopFolder,
        loadFromDesktopFolder,
        toggleAutoSaveToFolder,
        addOrder,
        updateOrder,
        deleteOrder,
        updateOrderItemDelivery,
        markAllOrderItemsReceived,
        importSingleOrderJson,
        addProduct,
        updateProduct,
        addManufacturer,
        updateManufacturer,
        deleteManufacturer,
        updateStock,
        getManufacturerById,
        getProductById,
        getLatestPrice,
        getLatestPriceByMfg,
        getPriceHistoryByItem,
        resetToSampleData,
        exportBackupJson,
        importBackupJson,
        exportOrdersToCsv,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore debe usarse dentro de un StoreProvider');
  }
  return context;
};
