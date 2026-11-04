import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { BedSize, TextileCategory } from '../types';
import { TEXTILE_CATEGORIES, INITIAL_BED_SIZES } from '../data/seedData';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Search, 
  SlidersHorizontal, 
  Calendar, 
  FileText, 
  Calculator,
  ChevronDown,
  ChevronUp,
  Download,
  Info
} from 'lucide-react';

export const PriceComparatorView: React.FC = () => {
  const { products, manufacturers, orders, priceRecords, getManufacturerById } = useStore();

  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [selectedBedSize, setSelectedBedSize] = useState<string>('todas');
  const [selectedMfg, setSelectedMfg] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Target markup multiplier (e.g. 2.10 means PVP = unitCost * 2.10)
  const [markupMultiplier, setMarkupMultiplier] = useState<number>(2.10);

  // Compile every unique combination of (Product + BedSize) that has purchase records or catalog presence
  const comparisonRows = useMemo(() => {
    interface CompItem {
      key: string;
      productId: string;
      productName: string;
      ref: string;
      category: TextileCategory;
      bedSize: BedSize;
      manufacturerId: string;
      mfgName: string;
      composition: string;
      latestPrice: number | null;
      previousPrice: number | null;
      latestOrderDate: string | null;
      latestOrderNumber: string | null;
      totalUnitsPurchased: number;
      priceHistory: Array<{
        date: string;
        orderNumber: string;
        unitCost: number;
        quantity: number;
      }>;
    }

    const map = new Map<string, CompItem>();

    // 1. Seed from products and their available sizes
    products.forEach(p => {
      const mfg = getManufacturerById(p.manufacturerId);
      p.availableSizes.forEach(size => {
        const key = `${p.id}-${size}`;
        map.set(key, {
          key,
          productId: p.id,
          productName: p.name,
          ref: p.ref,
          category: p.category,
          bedSize: size,
          manufacturerId: p.manufacturerId,
          mfgName: mfg?.name || 'Desconocido',
          composition: p.composition,
          latestPrice: null,
          previousPrice: null,
          latestOrderDate: null,
          latestOrderNumber: null,
          totalUnitsPurchased: 0,
          priceHistory: [],
        });
      });
    });

    // 2. Populate with historical purchase orders
    // Orders are iterated to build exact timeline
    orders.forEach(order => {
      order.items.forEach(item => {
        const key = `${item.productId}-${item.bedSize}`;
        let entry = map.get(key);
        if (!entry) {
          const mfg = getManufacturerById(order.manufacturerId);
          entry = {
            key,
            productId: item.productId,
            productName: item.productName,
            ref: item.ref,
            category: item.category,
            bedSize: item.bedSize,
            manufacturerId: order.manufacturerId,
            mfgName: mfg?.name || 'Desconocido',
            composition: '',
            latestPrice: null,
            previousPrice: null,
            latestOrderDate: null,
            latestOrderNumber: null,
            totalUnitsPurchased: 0,
            priceHistory: [],
          };
          map.set(key, entry);
        }

        entry.totalUnitsPurchased += item.quantity;
        entry.priceHistory.push({
          date: order.orderDate,
          orderNumber: order.orderNumber,
          unitCost: item.unitCost,
          quantity: item.quantity,
        });
      });
    });

    // Sort priceHistory chronologically for each entry
    map.forEach(entry => {
      entry.priceHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (entry.priceHistory.length > 0) {
        entry.latestPrice = entry.priceHistory[0].unitCost;
        entry.latestOrderDate = entry.priceHistory[0].date;
        entry.latestOrderNumber = entry.priceHistory[0].orderNumber;
        if (entry.priceHistory.length > 1) {
          entry.previousPrice = entry.priceHistory[1].unitCost;
        }
      }
    });

    return Array.from(map.values());
  }, [products, orders, manufacturers]);

  // Filter rows
  const filteredRows = useMemo(() => {
    return comparisonRows.filter(row => {
      if (selectedCategory !== 'todas' && row.category !== selectedCategory) return false;
      if (selectedBedSize !== 'todas' && row.bedSize !== selectedBedSize) return false;
      if (selectedMfg !== 'todos' && row.manufacturerId !== selectedMfg) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = row.productName.toLowerCase().includes(q);
        const matchRef = row.ref.toLowerCase().includes(q);
        const matchMfg = row.mfgName.toLowerCase().includes(q);
        const matchComp = row.composition.toLowerCase().includes(q);
        if (!matchName && !matchRef && !matchMfg && !matchComp) return false;
      }
      return true;
    });
  }, [comparisonRows, selectedCategory, selectedBedSize, selectedMfg, searchQuery]);

  const toggleExpand = (key: string) => {
    setExpandedItemId(prev => prev === key ? null : key);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-display">
            Comparador de Costes por Fabricante y Medida
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Consulta a qué precio compraste cada prenda, detecta incrementos de tarifa por proveedor y calcula tu margen de venta.
          </p>
        </div>

        {/* Multiplier / Markup Interactive Tool */}
        <div className="flex items-center gap-3 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg shadow-xs shrink-0">
          <Calculator className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">Multiplicador PVP:</span>
            <select
              value={markupMultiplier}
              onChange={e => setMarkupMultiplier(parseFloat(e.target.value))}
              className="font-mono font-bold bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white rounded px-2 py-1 text-xs border-0 focus:ring-1 focus:ring-blue-500"
            >
              <option value="1.80">x1.80 (+80%)</option>
              <option value="2.00">x2.00 (Doble / 50% margen)</option>
              <option value="2.10">x2.10 (Recomendado textil)</option>
              <option value="2.25">x2.25 (+125%)</option>
              <option value="2.50">x2.50 (Alta gama)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search query */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por prenda, ref o tejido..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
            >
              <option value="todas">Todas las categorías textiles</option>
              {TEXTILE_CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Bed Size Filter */}
          <div>
            <select
              value={selectedBedSize}
              onChange={e => setSelectedBedSize(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white font-medium"
            >
              <option value="todas">Todas las medidas de cama</option>
              <option value="90">Cama 90 cm</option>
              <option value="105">Cama 105 cm</option>
              <option value="135">Cama 135 cm (Matrimonio estándar)</option>
              <option value="150">Cama 150 cm (Queen / Superventas)</option>
              <option value="160">Cama 160 cm</option>
              <option value="180">Cama 180 cm (King Size)</option>
              <option value="200">Cama 200 cm (Presidential)</option>
            </select>
          </div>

          {/* Manufacturer Filter */}
          <div>
            <select
              value={selectedMfg}
              onChange={e => setSelectedMfg(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
            >
              <option value="todos">Todos los fabricantes</option>
              {manufacturers.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.city})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results summary unboxed text */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span>
            Mostrando <strong>{filteredRows.length}</strong> referencias textiles por medida
          </span>
          <span className="hidden sm:inline">
            Haz clic en cualquier fila para desplegar su histórico de precios por pedido
          </span>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-4 font-semibold">Prenda Textil & Referencia</th>
                <th className="py-3 px-3 font-semibold">Fabricante</th>
                <th className="py-3 px-3 font-semibold text-center w-28">Medida Cama</th>
                <th className="py-3 px-3 font-semibold text-right w-36">Último Coste (Neto / R.E.)</th>
                <th className="py-3 px-3 font-semibold text-center w-36">Tendencia Coste</th>
                <th className="py-3 px-3 font-semibold text-right w-32">PVP Recomendado</th>
                <th className="py-3 px-3 font-semibold text-right w-24">Compradas</th>
                <th className="py-3 px-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <Info className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                    No se encontraron artículos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredRows.map(item => {
                  const isExpanded = expandedItemId === item.key;
                  const price = item.latestPrice;
                  const prev = item.previousPrice;

                  let delta: { diff: number; pct: number } | null = null;
                  if (price !== null && prev !== null) {
                    const diff = price - prev;
                    const pct = (diff / prev) * 100;
                    delta = { diff, pct };
                  }

                  const recommendedPvp = price !== null ? (price * markupMultiplier) : null;

                  return (
                    <React.Fragment key={item.key}>
                      <tr
                        onClick={() => toggleExpand(item.key)}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${
                          isExpanded ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                        }`}
                      >
                        {/* Name & Reference */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {item.productName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-slate-600 dark:text-slate-300 font-medium">
                              {item.ref}
                            </span>
                            {item.composition && (
                              <>
                                <span>·</span>
                                <span className="truncate max-w-[200px]">{item.composition}</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Manufacturer */}
                        <td className="py-3 px-3">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {item.mfgName}
                          </span>
                        </td>

                        {/* Bed Size */}
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-700/60 rounded text-slate-800 dark:text-slate-200 font-semibold font-mono">
                            Cama {item.bedSize}
                          </span>
                        </td>

                        {/* Latest Cost */}
                        <td className="py-3 px-3 text-right">
                          {price !== null ? (
                            <div>
                              <span className="font-mono font-bold text-sm text-slate-900 dark:text-white tabular-nums">
                                {price.toFixed(2)} €
                              </span>
                              <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                                {(price * 1.262).toFixed(2)} € c/ R.E. (26,2%)
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Sin compras aún</span>
                          )}
                        </td>

                        {/* Price Trend */}
                        <td className="py-3 px-3 text-center">
                          {delta ? (
                            delta.diff > 0.05 ? (
                              <div className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded">
                                <TrendingUp className="w-3.5 h-3.5" />
                                <span>+{delta.diff.toFixed(2)}€ (+{delta.pct.toFixed(1)}%)</span>
                              </div>
                            ) : delta.diff < -0.05 ? (
                              <div className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                                <TrendingDown className="w-3.5 h-3.5" />
                                <span>{delta.diff.toFixed(2)}€ ({delta.pct.toFixed(1)}%)</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Estable</span>
                            )
                          ) : price !== null ? (
                            <span className="text-slate-400 text-[11px]">Precio base</span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>

                        {/* Recommended PVP */}
                        <td className="py-3 px-3 text-right">
                          {recommendedPvp !== null ? (
                            <div>
                              <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                                {recommendedPvp.toFixed(2)} €
                              </span>
                              <div className="text-[10px] text-slate-400">
                                con margen x{markupMultiplier.toFixed(2)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Units purchased */}
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          {item.totalUnitsPurchased} uds
                        </td>

                        {/* Expand indicator */}
                        <td className="py-3 px-2 text-center text-slate-400">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </td>
                      </tr>

                      {/* Expanded View: History of Orders */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 dark:bg-slate-900/60">
                          <td colSpan={8} className="p-4 pl-8 border-b border-slate-200 dark:border-slate-700">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                                  <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                  Historial de Compras en Albaranes: {item.productName} (Cama {item.bedSize})
                                </h4>
                                <span className="text-xs text-slate-500">
                                  Proveedor: <strong>{item.mfgName}</strong>
                                </span>
                              </div>

                              {item.priceHistory.length === 0 ? (
                                <p className="text-xs text-slate-500 italic">
                                  No hay pedidos registrados para esta medida aún. Añádela en un nuevo pedido semanal.
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  {item.priceHistory.map((hist, hIdx) => (
                                    <div
                                      key={hIdx}
                                      className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                                    >
                                      <div className="flex justify-between items-baseline font-mono text-[11px] text-slate-500">
                                        <span>{hist.date}</span>
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">{hist.orderNumber}</span>
                                      </div>
                                      <div className="mt-2 flex justify-between items-baseline">
                                        <span className="text-slate-600 dark:text-slate-400">Coste de compra:</span>
                                        <span className="font-mono font-bold text-sm text-slate-900 dark:text-white tabular-nums">
                                          {hist.unitCost.toFixed(2)} €
                                        </span>
                                      </div>
                                      <div className="mt-1 flex justify-between items-baseline text-[11px] text-slate-500">
                                        <span>Cantidad servida:</span>
                                        <span className="font-semibold tabular-nums">{hist.quantity} unidades</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
