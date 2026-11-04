import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { 
  Manufacturer, 
  Product, 
  PurchaseOrder, 
  PurchaseOrderItem, 
  BedSize, 
  TextileCategory, 
  PriceRecord 
} from '../types';
import { 
  INITIAL_MANUFACTURERS, 
  INITIAL_PRODUCTS, 
  INITIAL_ORDERS 
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
  toggleAutoSaveToFolder: (enabled: boolean) => void;

  // CRUD actions
  addOrder: (orderData: Omit<PurchaseOrder, 'id' | 'createdAt'>) => PurchaseOrder;
  deleteOrder: (id: string) => void;
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
      if (!saved) return INITIAL_ORDERS;
      const parsed: PurchaseOrder[] = JSON.parse(saved);
      // Migración automática al 26.2% (IVA 21% + Recargo de Equivalencia 5.2%)
      return parsed.map(o => {
        if (o.vatRate === 21 || !o.vatRate) {
          return {
            ...o,
            vatRate: 26.2,
            total: Number((o.subtotal * 1.262).toFixed(2)),
          };
        }
        return o;
      });
    } catch {
      return INITIAL_ORDERS;
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

      // Immediately write files
      const backupData = {
        exportDate: new Date().toISOString(),
        appName: 'TramaHogar',
        taxRegime: 'Comunidad de Bienes - Recargo de Equivalencia (26.2%)',
        manufacturers,
        products,
        orders,
      };
      const csvContent = buildCsvContent();
      await fileSystemService.writeFilesToDirectory(handle, backupData, csvContent);

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

  const resetToSampleData = () => {
    setManufacturers(INITIAL_MANUFACTURERS);
    setProducts(INITIAL_PRODUCTS);
    setOrders(INITIAL_ORDERS);
    localStorage.removeItem(STORAGE_KEYS.MFGS);
    localStorage.removeItem(STORAGE_KEYS.PRODS);
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
  };

  const exportBackupJson = () => {
    const backup = {
      exportDate: new Date().toISOString(),
      appName: 'TramaHogar',
      version: '1.0',
      taxRegime: 'Comunidad de Bienes - Recargo de Equivalencia (26.2%)',
      manufacturers,
      products,
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
        return true;
      }
      return false;
    } catch {
      return false;
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
        manufacturers,
        products,
        orders,
        priceRecords,
        localFolder,
        selectDesktopFolder,
        disconnectDesktopFolder,
        syncToDesktopFolder,
        toggleAutoSaveToFolder,
        addOrder,
        deleteOrder,
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
