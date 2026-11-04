import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
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

interface StoreContextType {
  manufacturers: Manufacturer[];
  products: Product[];
  orders: PurchaseOrder[];
  priceRecords: PriceRecord[];

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

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MFGS, JSON.stringify(manufacturers));
    } catch (e) {
      console.error('Error guardando fabricantes en localStorage', e);
    }
  }, [manufacturers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PRODS, JSON.stringify(products));
    } catch (e) {
      console.error('Error guardando productos en localStorage', e);
    }
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    } catch (e) {
      console.error('Error guardando pedidos en localStorage', e);
    }
  }, [orders]);

  // Derived price records from all purchase orders sorted by date descending
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

  // Add new order & optionally update product stocks
  const addOrder = (orderData: Omit<PurchaseOrder, 'id' | 'createdAt'>): PurchaseOrder => {
    const newId = `ord-${Date.now()}`;
    const newOrder: PurchaseOrder = {
      ...orderData,
      id: newId,
      createdAt: new Date().toISOString(),
    };

    setOrders(prev => [newOrder, ...prev]);

    // Update product stock automatically with the received items
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
      return false; // Can't delete if has products or orders
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
      'Coste Unitario (€)',
      'Subtotal Línea (€)',
    ];

    const rows: string[][] = [];

    orders.forEach(order => {
      const mfg = getManufacturerById(order.manufacturerId)?.name || 'Desconocido';
      order.items.forEach(item => {
        const lineTotal = (item.quantity * item.unitCost).toFixed(2);
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
          `"${lineTotal.replace('.', ',')}"`,
        ]);
      });
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TramaHogar_RegistroCompras_${new Date().toISOString().split('T')[0]}.csv`;
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
