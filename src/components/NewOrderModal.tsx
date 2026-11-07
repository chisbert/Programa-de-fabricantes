import React, { useState, useId } from 'react';
import { useStore } from '../context/StoreContext';
import { BedSize, PurchaseOrderItem, TextileCategory } from '../types';
import { INITIAL_BED_SIZES } from '../data/seedData';
import { 
  X, 
  Plus, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  AlertCircle, 
  Save, 
  Sparkles,
  CheckCircle2,
  PackagePlus,
  Calendar
} from 'lucide-react';

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: (orderId: string) => void;
}

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  isOpen,
  onClose,
  onOrderCreated,
}) => {
  const { manufacturers, products, categories, addCategory, addOrder, addProduct, getLatestPriceByMfg } = useStore();

  const [selectedMfgId, setSelectedMfgId] = useState<string>(manufacturers[0]?.id || '');
  const [orderDate, setOrderDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [orderNumber, setOrderNumber] = useState<string>(() => {
    const today = new Date();
    const week = getWeekNumber(today);
    return `ALB-${today.getFullYear()}-W${week}-${Math.floor(100 + Math.random() * 900)}`;
  });
  const [status, setStatus] = useState<'recibido' | 'en_transito' | 'pendiente_albaran'>('recibido');
  const [notes, setNotes] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // New quick-product inline modal state
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdRef, setNewProdRef] = useState('');
  const [newProdCategory, setNewProdCategory] = useState<TextileCategory>('sabanas');
  const [newProdComposition, setNewProdComposition] = useState('100% Algodón');
  const [isInlineAddingCat, setIsInlineAddingCat] = useState(false);
  const [inlineCatName, setInlineCatName] = useState('');

  // Order items draft lines
  interface DraftItem {
    id: string;
    productId: string;
    bedSize: BedSize;
    quantity: number;
    unitCost: number;
    notes?: string;
  }

  const [items, setItems] = useState<DraftItem[]>([
    {
      id: `draft-1`,
      productId: '',
      bedSize: '150',
      quantity: 10,
      unitCost: 0,
    },
  ]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter products by selected manufacturer
  const availableProducts = products.filter(p => p.manufacturerId === selectedMfgId);
  const selectedMfg = manufacturers.find(m => m.id === selectedMfgId);

  function getWeekNumber(d: Date): number {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  const handleMfgChange = (mfgId: string) => {
    setSelectedMfgId(mfgId);
    // Reset products in items if they don't belong to new mfg
    setItems(prev => prev.map(item => ({
      ...item,
      productId: '',
      unitCost: 0,
    })));
  };

  const handleAddItemRow = () => {
    setItems(prev => [
      ...prev,
      {
        id: `draft-${Date.now()}-${Math.random()}`,
        productId: availableProducts[0]?.id || '',
        bedSize: '150',
        quantity: 5,
        unitCost: 0,
      },
    ]);
  };

  const handleRemoveItemRow = (id: string) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleItemChange = (id: string, field: keyof DraftItem, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };

      // If user changed product or bedSize, auto-fill unitCost with previous purchase price if unitCost is 0
      if ((field === 'productId' || field === 'bedSize') && updated.productId) {
        const prevPrice = getLatestPriceByMfg(selectedMfgId, updated.productId, updated.bedSize);
        if (prevPrice && item.unitCost === 0) {
          updated.unitCost = prevPrice.unitCost;
        }
      }

      return updated;
    }));
  };

  // Quick product creation
  const handleSaveQuickProduct = () => {
    if (!newProdName.trim()) {
      return;
    }
    const autoRef = (selectedMfg?.code || 'ART') + '-' + Math.floor(100 + Math.random() * 900);
    const created = addProduct({
      ref: autoRef,
      name: newProdName.trim(),
      category: newProdCategory,
      manufacturerId: selectedMfgId,
      composition: newProdComposition.trim() || '100% Algodón',
      availableSizes: INITIAL_BED_SIZES,
      stockBySize: { '90': 0, '105': 0, '135': 0, '150': 0, '160': 0, '180': 0, '200': 0 },
      minStockBySize: { '90': 2, '105': 2, '135': 3, '150': 4, '160': 2, '180': 2, '200': 1 },
    });

    // Automatically set into the first empty row
    setItems(prev => {
      const idx = prev.findIndex(i => !i.productId);
      if (idx !== -1) {
        return prev.map((item, i) => i === idx ? { ...item, productId: created.id } : item);
      }
      return [...prev, { id: `draft-${Date.now()}`, productId: created.id, bedSize: '150', quantity: 6, unitCost: 0 }];
    });

    setIsCreatingProduct(false);
    setNewProdName('');
  };

  // Calculations - Comunidad de Bienes (Recargo de Equivalencia 26.2%)
  const totalUnits = items.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  const rawSubtotal = items.reduce((acc, curr) => acc + ((Number(curr.quantity) || 0) * (Number(curr.unitCost) || 0)), 0);
  const discountAmount = rawSubtotal * (discountPercent / 100);
  const subtotal = Math.max(0, rawSubtotal - discountAmount);
  const vatAmount = subtotal * 0.21;
  const reAmount = subtotal * 0.052;
  const totalTaxAmount = subtotal * 0.262; // 26.2%
  const totalWithVat = subtotal + totalTaxAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedMfgId) {
      setErrorMsg('Por favor selecciona un fabricante.');
      return;
    }

    if (!orderNumber.trim()) {
      setErrorMsg('Introduce un número de albarán o referencia de pedido.');
      return;
    }

    const validLines = items.filter(i => i.productId && i.quantity > 0 && i.unitCost > 0);
    if (validLines.length === 0) {
      setErrorMsg('Debes añadir al menos una línea con producto, cantidad y precio de coste válido.');
      return;
    }

    const orderItems: PurchaseOrderItem[] = validLines.map(line => {
      const prod = products.find(p => p.id === line.productId)!;
      const prevPriceRecord = getLatestPriceByMfg(selectedMfgId, line.productId, line.bedSize);

      const isDelivered = status === 'recibido';

      return {
        id: `item-${Date.now()}-${Math.random()}`,
        productId: line.productId,
        productName: prod.name,
        ref: prod.ref,
        category: prod.category,
        bedSize: line.bedSize,
        quantity: Number(line.quantity),
        receivedQuantity: isDelivered ? Number(line.quantity) : 0,
        isReceived: isDelivered,
        unitCost: Number(line.unitCost),
        previousUnitCost: prevPriceRecord?.unitCost,
        recommendedPvp: Number((line.unitCost * 1.262 * 1.7).toFixed(2)),
        notes: line.notes,
      };
    });

    const parsedDate = new Date(orderDate);
    const week = getWeekNumber(parsedDate);

    const createdOrder = addOrder({
      orderNumber: orderNumber.trim(),
      orderDate,
      weekNumber: week,
      year: parsedDate.getFullYear(),
      manufacturerId: selectedMfgId,
      status,
      items: orderItems,
      discountPercentage: discountPercent,
      vatRate: 26.2,
      subtotal: Number(subtotal.toFixed(2)),
      total: Number(totalWithVat.toFixed(2)),
      notes: notes.trim(),
    });

    if (onOrderCreated) {
      onOrderCreated(createdOrder.id);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Registrar Pedido Semanal a Fabricante
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Controla las prendas compradas, cantidades exactas y detecta variaciones de precio en tiempo real.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Order Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Fabricante / Proveedor *
              </label>
              <select
                value={selectedMfgId}
                onChange={e => handleMfgChange(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
              >
                {manufacturers.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.city})
                  </option>
                ))}
              </select>
              {selectedMfg && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Condición: {selectedMfg.paymentTerms}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nº Albarán o Factura *
              </label>
              <input
                type="text"
                value={orderNumber}
                onChange={e => setOrderNumber(e.target.value)}
                placeholder="Ej. ALB-2026-4402"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Fecha del Pedido
              </label>
              <input
                type="date"
                value={orderDate}
                onChange={e => setOrderDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Estado de la Entrega
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
              >
                <option value="recibido">Mercancía Recibida Completa</option>
                <option value="parcial">Entrega Parcial / Falta mercancía</option>
                <option value="en_transito">En tránsito / Esperando envío</option>
                <option value="pendiente_albaran">Pendiente de albarán final</option>
              </select>
            </div>
          </div>

          {/* Section 2: Order Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Prendas del Pedido ({items.length} líneas)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Introduce artículo, medida de cama, unidades y coste unitario sin IVA.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingProduct(!isCreatingProduct)}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nueva Referencia Textil
                </button>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 rounded-md transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Añadir Línea
                </button>
              </div>
            </div>

            {/* Quick Product Drawer */}
            {isCreatingProduct && (
              <div className="mb-4 p-4 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                    Crear nuevo artículo para {selectedMfg?.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingProduct(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Nombre del artículo / prenda *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Juego de Sábanas Satén 300 Hilos"
                      value={newProdName}
                      onChange={e => setNewProdName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Tejido / Composición
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. 100% Algodón Peinado"
                      value={newProdComposition}
                      onChange={e => setNewProdComposition(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded dark:text-white"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Categoría</label>
                      <button
                        type="button"
                        onClick={() => setIsInlineAddingCat(!isInlineAddingCat)}
                        className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                      >
                        {isInlineAddingCat ? 'Cancelar' : '+ Nueva'}
                      </button>
                    </div>

                    {isInlineAddingCat ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="Nombre categoría..."
                          value={inlineCatName}
                          onChange={e => setInlineCatName(e.target.value)}
                          className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-blue-400 rounded dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (inlineCatName.trim()) {
                              const created = addCategory({ label: inlineCatName.trim() });
                              setNewProdCategory(created.id);
                              setInlineCatName('');
                              setIsInlineAddingCat(false);
                            }
                          }}
                          className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded"
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <select
                        value={newProdCategory}
                        onChange={e => setNewProdCategory(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded dark:text-white"
                      >
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleSaveQuickProduct}
                    className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                  >
                    Guardar y Usar en Pedido
                  </button>
                </div>
              </div>
            )}

            {/* Line items list */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Artículo ({selectedMfg?.name || 'Fabricante'})</th>
                      <th className="py-2.5 px-3 font-semibold w-28 text-center">Medida</th>
                      <th className="py-2.5 px-3 font-semibold w-24 text-right">Uds. Compradas</th>
                      <th className="py-2.5 px-3 font-semibold w-28 text-right">Precio Coste (€)</th>
                      <th className="py-2.5 px-3 font-semibold w-28 text-right">Total (€)</th>
                      <th className="py-2.5 px-3 font-semibold w-48 text-center">Última Compra</th>
                      <th className="py-2.5 px-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {items.map((line) => {
                      const prevPrice = line.productId 
                        ? getLatestPriceByMfg(selectedMfgId, line.productId, line.bedSize)
                        : null;
                      
                      const lineTotal = (Number(line.quantity) || 0) * (Number(line.unitCost) || 0);

                      let priceDelta: { diff: number; pct: number } | null = null;
                      if (prevPrice && Number(line.unitCost) > 0) {
                        const diff = Number(line.unitCost) - prevPrice.unitCost;
                        const pct = (diff / prevPrice.unitCost) * 100;
                        priceDelta = { diff, pct };
                      }

                      // Format date to DD/MM/AAAA
                      const formatLastPurchaseDate = (dateStr: string) => {
                        if (!dateStr) return '';
                        const parts = dateStr.split('-');
                        if (parts.length === 3) {
                          return `${parts[2]}/${parts[1]}/${parts[0]}`;
                        }
                        return dateStr;
                      };

                      return (
                        <tr key={line.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                          {/* Product select - without [REF] */}
                          <td className="py-2 px-3">
                            <select
                              value={line.productId}
                              onChange={e => handleItemChange(line.id, 'productId', e.target.value)}
                              className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none dark:text-white font-medium"
                            >
                              <option value="">-- Seleccionar artículo --</option>
                              {availableProducts.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Bed Size */}
                          <td className="py-2 px-3">
                            <select
                              value={line.bedSize}
                              onChange={e => handleItemChange(line.id, 'bedSize', e.target.value)}
                              className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none dark:text-white font-medium text-center"
                            >
                              <option value="90">90 cm</option>
                              <option value="105">105 cm</option>
                              <option value="135">135 cm</option>
                              <option value="150">150 cm</option>
                              <option value="160">160 cm</option>
                              <option value="180">180 cm</option>
                              <option value="200">200 cm</option>
                              <option value="Especial">Especial</option>
                            </select>
                          </td>

                          {/* Quantity */}
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={line.quantity}
                              onChange={e => handleItemChange(line.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full text-right px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none dark:text-white tabular-nums font-semibold"
                            />
                          </td>

                          {/* Unit Cost */}
                          <td className="py-2 px-3 text-right">
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                step="0.05"
                                value={line.unitCost || ''}
                                onChange={e => handleItemChange(line.id, 'unitCost', parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                className="w-full text-right pr-6 pl-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none dark:text-white tabular-nums font-semibold"
                              />
                              <span className="absolute right-2 top-2 text-[11px] text-slate-400">€</span>
                            </div>
                          </td>

                          {/* Total line (Quantity * Unit Cost) */}
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums text-sm">
                            {lineTotal.toFixed(2)} €
                          </td>

                          {/* Cuándo fue la última compra & variación */}
                          <td className="py-2 px-3 text-center">
                            {prevPrice ? (
                              <div className="flex flex-col items-center justify-center text-[11px] leading-tight">
                                <div className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  <span>{formatLastPurchaseDate(prevPrice.date)}</span>
                                  <span className="text-slate-500 font-mono">({prevPrice.unitCost.toFixed(2)} €)</span>
                                </div>
                                {priceDelta && Math.abs(priceDelta.diff) > 0.02 && (
                                  <div className="mt-0.5">
                                    {priceDelta.diff > 0 ? (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded">
                                        <TrendingUp className="w-2.5 h-2.5" />
                                        +{priceDelta.diff.toFixed(2)}€ ({priceDelta.pct > 0 ? `+${priceDelta.pct.toFixed(0)}%` : ''})
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded">
                                        <TrendingDown className="w-2.5 h-2.5" />
                                        {priceDelta.diff.toFixed(2)}€ ({priceDelta.pct.toFixed(0)}%)
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center text-[11px] text-slate-400 dark:text-slate-500 italic">
                                Sin compras previas
                              </span>
                            )}
                          </td>

                          {/* Delete button */}
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(line.id)}
                              disabled={items.length <= 1}
                              className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title="Eliminar fila"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 3: Notes & Totals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notas del Pedido o Incidencias del Albarán
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Ej. Promoción de feria, falta servir 2 bajeras de 150 cm que enviarán el martes..."
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md focus:ring-1 focus:ring-blue-500 focus:outline-none dark:text-white"
              />
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto-stock"
                  defaultChecked
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="auto-stock" className="text-xs text-slate-600 dark:text-slate-400">
                  Sumar automáticamente las unidades recibidas al stock de la tienda
                </label>
              </div>
            </div>

            {/* Calculations block */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Total Prendas Textil:</span>
                <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                  {totalUnits} unidades
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Base Imponible Neta:</span>
                <span className="font-mono text-slate-900 dark:text-white tabular-nums">
                  {subtotal.toFixed(2)} €
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>IVA General (21%):</span>
                <span className="font-mono text-slate-900 dark:text-white tabular-nums">
                  {vatAmount.toFixed(2)} €
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Recargo de Equivalencia (5,2%):</span>
                <span className="font-mono text-slate-900 dark:text-white tabular-nums">
                  {reAmount.toFixed(2)} €
                </span>
              </div>
              <div className="flex justify-between text-slate-700 dark:text-slate-300 font-semibold bg-blue-50/50 dark:bg-blue-950/30 px-2 py-1 rounded">
                <span>Total Impuestos C.B. (26,2%):</span>
                <span className="font-mono text-blue-700 dark:text-blue-300 tabular-nums">
                  {totalTaxAmount.toFixed(2)} €
                </span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between items-baseline text-sm">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    Total Factura / Albarán:
                  </span>
                  <div className="text-[10px] text-slate-400">
                    Régimen: Comunidad de Bienes (26,2% R.E.)
                  </div>
                </div>
                <span className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400 tabular-nums">
                  {totalWithVat.toFixed(2)} €
                </span>
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
            {selectedMfg && (
              <span>
                {selectedMfg.name}
                {selectedMfg.salesRepName ? ` · Rep: ${selectedMfg.salesRepName}` : ''}
                {selectedMfg.orderEmail || selectedMfg.phone ? ` (${selectedMfg.orderEmail || selectedMfg.phone})` : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all flex items-center gap-2 focus:ring-2 focus:ring-blue-500/20"
            >
              <Save className="w-4 h-4" />
              Guardar Pedido y Actualizar Precios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
