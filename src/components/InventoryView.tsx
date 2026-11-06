import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { BedSize, TextileCategory, Product } from '../types';
import { INITIAL_BED_SIZES } from '../data/seedData';
import { 
  Layers, 
  Search, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  PlusCircle, 
  MinusCircle, 
  TrendingDown, 
  Package, 
  X,
  Edit2,
  Tag
} from 'lucide-react';

interface InventoryViewProps {
  onOpenNewOrder: () => void;
  onOpenCategoryManager?: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ onOpenNewOrder, onOpenCategoryManager }) => {
  const { products, manufacturers, categories, updateStock, addProduct, updateProduct, getLatestPrice, getManufacturerById } = useStore();

  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [selectedBedSize, setSelectedBedSize] = useState<string>('todas');
  const [selectedMfg, setSelectedMfg] = useState<string>('todos');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // New Product Modal
  const [isAddingProduct, setIsAddingProduct] = useState<boolean>(false);
  const [newProd, setNewProd] = useState<{
    ref: string;
    name: string;
    category: TextileCategory;
    manufacturerId: string;
    composition: string;
    description: string;
  }>({
    ref: '',
    name: '',
    category: 'sabanas',
    manufacturerId: manufacturers[0]?.id || '',
    composition: '100% Algodón',
    description: '',
  });

  // Calculate total inventory valuation at cost
  let totalInventoryUnits = 0;
  let totalValuationAtCost = 0;
  let totalLowStockAlerts = 0;

  products.forEach(p => {
    p.availableSizes.forEach(size => {
      const stock = p.stockBySize[size] || 0;
      const min = p.minStockBySize[size] || 0;
      totalInventoryUnits += stock;
      if (stock <= min) {
        totalLowStockAlerts++;
      }
      const priceRec = getLatestPrice(p.id, size);
      if (priceRec) {
        totalValuationAtCost += stock * priceRec.unitCost;
      }
    });
  });

  // Filter products and their size variants
  interface StockRow {
    product: Product;
    bedSize: BedSize;
    stock: number;
    minStock: number;
    isLow: boolean;
    latestCost: number | null;
    mfgName: string;
    stockValuation: number;
  }

  const stockRows: StockRow[] = [];

  products.forEach(p => {
    const mfg = getManufacturerById(p.manufacturerId);
    const mfgName = mfg?.name || 'Desconocido';

    p.availableSizes.forEach(size => {
      const stock = p.stockBySize[size] || 0;
      const minStock = p.minStockBySize[size] || 0;
      const isLow = stock <= minStock;
      const priceRec = getLatestPrice(p.id, size);
      const latestCost = priceRec?.unitCost || null;
      const stockValuation = latestCost ? stock * latestCost : 0;

      // Apply filters
      if (selectedCategory !== 'todas' && p.category !== selectedCategory) return;
      if (selectedBedSize !== 'todas' && size !== selectedBedSize) return;
      if (selectedMfg !== 'todos' && p.manufacturerId !== selectedMfg) return;
      if (filterLowStockOnly && !isLow) return;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchRef = p.ref.toLowerCase().includes(q);
        const matchMfg = mfgName.toLowerCase().includes(q);
        if (!matchName && !matchRef && !matchMfg) return;
      }

      stockRows.push({
        product: p,
        bedSize: size,
        stock,
        minStock,
        isLow,
        latestCost,
        mfgName,
        stockValuation,
      });
    });
  });

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProd.name.trim() || !newProd.ref.trim()) return;

    addProduct({
      ref: newProd.ref.toUpperCase().trim(),
      name: newProd.name.trim(),
      category: newProd.category,
      manufacturerId: newProd.manufacturerId,
      composition: newProd.composition.trim(),
      availableSizes: INITIAL_BED_SIZES,
      stockBySize: { '90': 0, '105': 0, '135': 0, '150': 0, '160': 0, '180': 0, '200': 0 },
      minStockBySize: { '90': 2, '105': 2, '135': 3, '150': 4, '160': 2, '180': 2, '200': 1 },
      description: newProd.description.trim(),
    });

    setIsAddingProduct(false);
    setNewProd({
      ref: '',
      name: '',
      category: 'sabanas',
      manufacturerId: manufacturers[0]?.id || '',
      composition: '100% Algodón',
      description: '',
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-display">
            Control de Inventario y Medidas de Cama
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Gestión de existencias por prenda textil y tamaño de cama, valoración a precio de coste y alertas de reposición.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onOpenCategoryManager && (
            <button
              onClick={onOpenCategoryManager}
              className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Gestionar Categorías
            </button>
          )}
          <button
            onClick={() => setIsAddingProduct(true)}
            className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva Referencia al Catálogo
          </button>
          <button
            onClick={onOpenNewOrder}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
          >
            <Package className="w-3.5 h-3.5" />
            Hacer Pedido de Reposición
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Total Prendas en Tienda
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
            {totalInventoryUnits} unidades
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Sumando todas las medidas y calidades
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Valoración Total a Precio de Coste
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 tabular-nums">
            {totalValuationAtCost.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Basado en el último coste de compra neto
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Alertas de Reposición Semanal
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono tabular-nums ${totalLowStockAlerts > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {totalLowStockAlerts}
            </span>
            <span className="text-xs text-slate-500">tallas bajo mínimo</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Revisar antes de cerrar el pedido con los fabricantes
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar prenda o referencia..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
            >
              <option value="todas">Todas las categorías</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedBedSize}
              onChange={e => setSelectedBedSize(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white font-medium"
            >
              <option value="todas">Todas las medidas de cama</option>
              <option value="90">Cama 90</option>
              <option value="105">Cama 105</option>
              <option value="135">Cama 135</option>
              <option value="150">Cama 150</option>
              <option value="160">Cama 160</option>
              <option value="180">Cama 180</option>
              <option value="200">Cama 200</option>
            </select>
          </div>

          <div>
            <select
              value={selectedMfg}
              onChange={e => setSelectedMfg(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
            >
              <option value="todos">Todos los fabricantes</option>
              {manufacturers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
            <input
              type="checkbox"
              checked={filterLowStockOnly}
              onChange={e => setFilterLowStockOnly(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Mostrar únicamente tallas bajo stock mínimo ({totalLowStockAlerts})</span>
          </label>

          <span className="text-slate-400">
            {stockRows.length} tallas listadas
          </span>
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-4 font-semibold">Prenda Textil</th>
                <th className="py-3 px-3 font-semibold">Fabricante</th>
                <th className="py-3 px-3 font-semibold text-center w-28">Medida Cama</th>
                <th className="py-3 px-3 font-semibold text-right w-28">Stock Actual</th>
                <th className="py-3 px-3 font-semibold text-right w-24">Mínimo</th>
                <th className="py-3 px-3 font-semibold text-right w-28">Último Coste</th>
                <th className="py-3 px-3 font-semibold text-right w-28">Valoración</th>
                <th className="py-3 px-3 font-semibold text-center w-32">Ajuste Rápido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {stockRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No hay prendas que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                stockRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    {/* Product Name & SKU */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {row.product.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {row.product.ref} {row.product.composition && `· ${row.product.composition}`}
                      </div>
                    </td>

                    {/* Manufacturer */}
                    <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                      {row.mfgName}
                    </td>

                    {/* Bed Size */}
                    <td className="py-3 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded font-semibold font-mono text-slate-800 dark:text-slate-200">
                        Cama {row.bedSize}
                      </span>
                    </td>

                    {/* Current Stock */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {row.isLow && (
                          <span title="Bajo stock mínimo">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          </span>
                        )}
                        <span className={`font-mono font-bold text-sm tabular-nums ${
                          row.isLow ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
                        }`}>
                          {row.stock} uds
                        </span>
                      </div>
                      {row.isLow && (
                        <div className="text-[10px] text-amber-600 font-medium">
                          Reponer en albarán
                        </div>
                      )}
                    </td>

                    {/* Min Stock */}
                    <td className="py-3 px-3 text-right font-mono text-slate-400 tabular-nums">
                      {row.minStock} uds
                    </td>

                    {/* Latest Unit Cost */}
                    <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {row.latestCost ? `${row.latestCost.toFixed(2)} €` : '-'}
                    </td>

                    {/* Stock Valuation */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                      {row.stockValuation.toFixed(2)} €
                    </td>

                    {/* Quick Adjustment (+ / -) */}
                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => updateStock(row.product.id, row.bedSize, -1)}
                          disabled={row.stock <= 0}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 rounded"
                          title="Restar 1 ud (Venta en tienda)"
                        >
                          <MinusCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => updateStock(row.product.id, row.bedSize, 1)}
                          className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                          title="Sumar 1 ud (Entrada manual)"
                        >
                          <PlusCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Product */}
      {isAddingProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Nueva Prenda para Catálogo Textil
              </h3>
              <button
                onClick={() => setIsAddingProduct(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Referencia / SKU *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. BAS-SAT-400"
                    value={newProd.ref}
                    onChange={e => setNewProd(prev => ({ ...prev, ref: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Fabricante *</label>
                  <select
                    value={newProd.manufacturerId}
                    onChange={e => setNewProd(prev => ({ ...prev, manufacturerId: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded dark:text-white"
                  >
                    {manufacturers.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre Comercial de la Prenda *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Juego de Sábanas Satén 400 Hilos"
                  value={newProd.name}
                  onChange={e => setNewProd(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300">Categoría Textil *</label>
                    {onOpenCategoryManager && (
                      <button
                        type="button"
                        onClick={onOpenCategoryManager}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                      >
                        + Nueva
                      </button>
                    )}
                  </div>
                  <select
                    value={newProd.category}
                    onChange={e => setNewProd(prev => ({ ...prev, category: e.target.value as TextileCategory }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded dark:text-white"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Composición / Tejido</label>
                  <input
                    type="text"
                    placeholder="Ej. 100% Algodón Peinado"
                    value={newProd.composition}
                    onChange={e => setNewProd(prev => ({ ...prev, composition: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Descripción corta</label>
                <textarea
                  rows={2}
                  placeholder="Acabado, colores, características destacadas..."
                  value={newProd.description}
                  onChange={e => setNewProd(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddingProduct(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded"
                >
                  Guardar en Catálogo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
