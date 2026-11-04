export type BedSize = '90' | '105' | '135' | '150' | '160' | '180' | '200' | 'Especial';

export type TextileCategory = 
  | 'sabanas'
  | 'fundas_nordicas'
  | 'colchas_edredones'
  | 'rellenos_nordicos'
  | 'almohadas_fundas'
  | 'protectores_cubrecolchones'
  | 'mantas_plaids';

export interface CategoryInfo {
  id: TextileCategory;
  label: string;
  description: string;
  typicalSizes: BedSize[];
}

export interface Manufacturer {
  id: string;
  name: string;
  cif?: string;
  code: string;
  contactPerson: string;
  email: string;
  phone: string;
  city: string;
  paymentTerms: string;
  deliveryDays: number;
  notes?: string;
}

export interface Product {
  id: string;
  ref: string;
  name: string;
  category: TextileCategory;
  manufacturerId: string;
  composition: string;
  availableSizes: BedSize[];
  stockBySize: Record<string, number>;
  minStockBySize: Record<string, number>;
  defaultPvpBySize?: Record<string, number>;
  description?: string;
}

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  productName: string;
  ref: string;
  category: TextileCategory;
  bedSize: BedSize;
  quantity: number;
  unitCost: number; // Coste unitario neto (sin IVA)
  previousUnitCost?: number; // Último coste previo registrado
  recommendedPvp?: number;
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  orderDate: string; // YYYY-MM-DD
  weekNumber: number;
  year: number;
  manufacturerId: string;
  status: 'recibido' | 'en_transito' | 'pendiente_albaran';
  items: PurchaseOrderItem[];
  discountPercentage?: number;
  vatRate: number; // 26.2% = IVA 21% + Recargo de Equivalencia 5.2% (Comunidad de Bienes)
  reRate?: number; // 5.2%
  subtotal: number;
  total: number;
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
}

export interface PriceRecord {
  id: string;
  productId: string;
  productName: string;
  ref: string;
  manufacturerId: string;
  category: TextileCategory;
  bedSize: BedSize;
  unitCost: number;
  orderId: string;
  orderNumber: string;
  date: string;
}

export type ActiveTab = 'resumen' | 'nuevo_pedido' | 'pedidos' | 'comparador' | 'proveedores' | 'inventario';
