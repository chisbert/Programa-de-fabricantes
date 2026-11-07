import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { BedSize, Manufacturer } from '../types';
import { 
  Package, 
  AlertTriangle, 
  CheckCircle2, 
  Phone, 
  Mail, 
  User, 
  Search, 
  Filter, 
  Check, 
  ExternalLink, 
  Copy, 
  Download,
  FileText,
  Clock,
  ArrowRight
} from 'lucide-react';

interface PendingItemsViewProps {
  onSelectOrderDetails?: (orderId: string) => void;
  onOpenNewOrder?: () => void;
}

export const PendingItemsView: React.FC<PendingItemsViewProps> = ({
  onSelectOrderDetails,
  onOpenNewOrder,
}) => {
  const { 
    orders, 
    manufacturers, 
    getManufacturerById, 
    updateOrderItemDelivery 
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMfgFilter, setSelectedMfgFilter] = useState<string>('todos');
  const [selectedSizeFilter, setSelectedSizeFilter] = useState<string>('todos');
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Extract all missing items across all purchase orders
  const allMissingItems = useMemo(() => {
    const list: Array<{
      orderId: string;
      orderNumber: string;
      orderDate: string;
      weekNumber: number;
      manufacturerId: string;
      itemId: string;
      productId: string;
      productName: string;
      ref: string;
      category: string;
      bedSize: BedSize;
      quantity: number;
      receivedQuantity: number;
      missingQuantity: number;
      unitCost: number;
      missingTotalCost: number;
    }> = [];

    orders.forEach(order => {
      order.items.forEach(item => {
        const receivedQty = item.receivedQuantity !== undefined
          ? item.receivedQuantity
          : (item.isReceived ? item.quantity : 0);
        
        const missingQty = Math.max(0, item.quantity - receivedQty);

        if (missingQty > 0) {
          list.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            orderDate: order.orderDate,
            weekNumber: order.weekNumber,
            manufacturerId: order.manufacturerId,
            itemId: item.id,
            productId: item.productId,
            productName: item.productName,
            ref: item.ref,
            category: item.category,
            bedSize: item.bedSize,
            quantity: item.quantity,
            receivedQuantity: receivedQty,
            missingQuantity: missingQty,
            unitCost: item.unitCost,
            missingTotalCost: missingQty * item.unitCost,
          });
        }
      });
    });

    return list;
  }, [orders]);

  // Filter missing items
  const filteredMissingItems = useMemo(() => {
    return allMissingItems.filter(item => {
      if (selectedMfgFilter !== 'todos' && item.manufacturerId !== selectedMfgFilter) {
        return false;
      }
      if (selectedSizeFilter !== 'todos' && item.bedSize !== selectedSizeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.productName.toLowerCase().includes(q);
        const matchesOrder = item.orderNumber.toLowerCase().includes(q);
        const mfg = getManufacturerById(item.manufacturerId);
        const matchesMfg = mfg?.name.toLowerCase().includes(q) || false;
        if (!matchesName && !matchesOrder && !matchesMfg) {
          return false;
        }
      }
      return true;
    });
  }, [allMissingItems, selectedMfgFilter, selectedSizeFilter, searchQuery, getManufacturerById]);

  // Group filtered items by manufacturer
  const itemsByManufacturer = useMemo(() => {
    const map = new Map<string, typeof filteredMissingItems>();
    filteredMissingItems.forEach(item => {
      const current = map.get(item.manufacturerId) || [];
      current.push(item);
      map.set(item.manufacturerId, current);
    });
    return map;
  }, [filteredMissingItems]);

  // Overall statistics
  const totalMissingUnits = allMissingItems.reduce((s, i) => s + i.missingQuantity, 0);
  const totalMissingCost = allMissingItems.reduce((s, i) => s + i.missingTotalCost, 0);
  const totalMissingCostWithRE = totalMissingCost * 1.262; // 26.2% Recargo de Equivalencia
  const affectedManufacturersCount = new Set(allMissingItems.map(i => i.manufacturerId)).size;

  // Manufacturers with missing items for dropdown
  const manufacturersWithMissing = useMemo(() => {
    const ids = Array.from(new Set(allMissingItems.map(i => i.manufacturerId)));
    return ids.map(id => getManufacturerById(id)).filter((m): m is Manufacturer => !!m);
  }, [allMissingItems, getManufacturerById]);

  // Copy structured list to clipboard for WhatsApp or quick messaging
  const handleCopySummary = () => {
    if (filteredMissingItems.length === 0) return;

    let text = `TRAMAHOGAR - RELACIÓN DE FALTAS Y MERCANCÍA PENDIENTE\n`;
    text += `Fecha: ${new Date().toLocaleDateString('es-ES')}\n`;
    text += `Total artículos pendientes: ${filteredMissingItems.reduce((s, i) => s + i.missingQuantity, 0)} unidades\n`;
    text += `--------------------------------------------------------\n\n`;

    itemsByManufacturer.forEach((items, mfgId) => {
      const mfg = getManufacturerById(mfgId);
      text += `🏢 FABRICANTE: ${mfg?.name || 'Desconocido'}\n`;
      if (mfg?.salesRepName && mfg?.salesRepPhone) {
        text += `   Comercial: ${mfg.salesRepName} (Tel: ${mfg.salesRepPhone})\n`;
      }
      if (mfg?.phone) {
        text += `   Teléfono pedidos: ${mfg.phone}\n`;
      }

      items.forEach(item => {
        text += `   • ${item.productName} - Cama ${item.bedSize}: Faltan ${item.missingQuantity} uds (Pedido ${item.orderNumber} del ${item.orderDate})\n`;
      });
      text += `\n`;
    });

    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 3000);
  };

  // Export missing items to CSV
  const handleExportCsv = () => {
    const headers = [
      'Fabricante',
      'Articulo',
      'Medida',
      'Uds. Faltan',
      'Uds. Pedidas',
      'Uds. Recibidas',
      'Coste Unitario (€)',
      'Total Falta Neto (€)',
      'Total Falta con R.E. 26.2% (€)',
      'Pedido / Albaran',
      'Fecha Pedido',
      'Telefono Pedidos',
      'Representante',
      'Telefono Representante',
    ];

    const rows = filteredMissingItems.map(item => {
      const mfg = getManufacturerById(item.manufacturerId);
      const totalNeto = item.missingQuantity * item.unitCost;
      const totalRE = totalNeto * 1.262;

      return [
        `"${mfg?.name || ''}"`,
        `"${item.productName.replace(/"/g, '""')}"`,
        `"Cama ${item.bedSize}"`,
        item.missingQuantity,
        item.quantity,
        item.receivedQuantity,
        `"${item.unitCost.toFixed(2).replace('.', ',')}"`,
        `"${totalNeto.toFixed(2).replace('.', ',')}"`,
        `"${totalRE.toFixed(2).replace('.', ',')}"`,
        `"${item.orderNumber}"`,
        item.orderDate,
        `"${mfg?.phone || ''}"`,
        `"${mfg?.salesRepName || ''}"`,
        `"${mfg?.salesRepPhone || ''}"`,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TramaHogar_Faltas_Mercancia_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Banner / Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-display">
              Faltas y Mercancía Pendiente de Entrega
            </h1>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Artículos que no han venido en los pedidos de los fabricantes. Revisa las entregas pendientes y márcalas recibidas cuando llegue el transportista.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {allMissingItems.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-xs transition-colors"
                title="Copiar lista de faltas al portapapeles"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedNotification ? '¡Copiado!' : 'Copiar Resumen'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-xs transition-colors"
                title="Exportar a archivo Excel / CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar CSV</span>
              </button>
            </>
          )}

          {onOpenNewOrder && (
            <button
              onClick={onOpenNewOrder}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg shadow-sm transition-all whitespace-nowrap cursor-pointer"
            >
              Nuevo Pedido
            </button>
          )}
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Missing Units */}
        <div className="p-4 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Prendas que Faltan
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono tracking-tight tabular-nums ${
              totalMissingUnits > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {totalMissingUnits}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">unidades pendientes</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {totalMissingUnits > 0 ? 'Repartidas en entregas parciales' : 'Todos los albaranes al día'}
          </div>
        </div>

        {/* Card 2: Affected Lines */}
        <div className="p-4 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Líneas Afectadas
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
              {allMissingItems.length}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">artículos y medidas</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Prendas individuales reclamables
          </div>
        </div>

        {/* Card 3: Pending Value */}
        <div className="p-4 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Coste Pendiente (con R.E. 26.2%)
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
              {totalMissingCostWithRE.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Base: {totalMissingCost.toFixed(2)} € sin IVA
          </div>
        </div>

        {/* Card 4: Affected Suppliers */}
        <div className="p-4 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Fabricantes con Faltas
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
              {affectedManufacturersCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">proveedores con incidencias</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {affectedManufacturersCount > 0 ? 'Con albaranes pendientes' : 'Sin incidencias de proveedores'}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar artículo, modelo o número de albarán..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none dark:text-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Manufacturer Filter */}
            <select
              value={selectedMfgFilter}
              onChange={e => setSelectedMfgFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none dark:text-white"
            >
              <option value="todos">Todos los Fabricantes ({manufacturersWithMissing.length})</option>
              {manufacturersWithMissing.map(mfg => (
                <option key={mfg.id} value={mfg.id}>
                  {mfg.name}
                </option>
              ))}
            </select>

            {/* Bed Size Filter */}
            <select
              value={selectedSizeFilter}
              onChange={e => setSelectedSizeFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none dark:text-white"
            >
              <option value="todos">Todas las Medidas</option>
              <option value="90">90 cm</option>
              <option value="105">105 cm</option>
              <option value="135">135 cm</option>
              <option value="150">150 cm</option>
              <option value="160">160 cm</option>
              <option value="180">180 cm</option>
              <option value="200">200 cm</option>
              <option value="Especial">Especial</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content: Grouped by Manufacturer */}
      {allMissingItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center shadow-xs">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">
            ¡Todos los pedidos están al día!
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
            No hay ninguna mercancía pendiente de recibir. Todos los albaranes de los fabricantes han sido completados al 100%.
          </p>
        </div>
      ) : filteredMissingItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs">
          No hay faltas que coincidan con los filtros seleccionados.
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(itemsByManufacturer.entries()).map(([mfgId, items]) => {
            const mfg = getManufacturerById(mfgId);
            const mfgMissingUnits = items.reduce((s, i) => s + i.missingQuantity, 0);
            const mfgMissingTotalCost = items.reduce((s, i) => s + i.missingTotalCost, 0);

            // Construct mailto link
            const emailSubject = encodeURIComponent(`Reclamación de Faltas de Pedidos - TramaHogar`);
            const emailBodyLines = [
              `Estimado/a ${mfg?.salesRepName || mfg?.name || 'Proveedor'},`,
              '',
              `Les escribimos desde TramaHogar para reclamar la siguiente mercancía que ha quedado pendiente de entrega en los albaranes recibidos:`,
              '',
              ...items.map(i => `- ${i.productName} (Cama ${i.bedSize}): Faltan ${i.missingQuantity} uds de ${i.quantity} pedidas [Albarán ${i.orderNumber} del ${i.orderDate}]`),
              '',
              `Total de prendas pendientes: ${mfgMissingUnits} unidades.`,
              '',
              `Les agradecemos que nos confirmen cuándo nos enviarán la reposición.`,
              '',
              `Atentamente,`,
              `TramaHogar - Tienda de Ropa de Hogar`,
            ];
            const emailBody = encodeURIComponent(emailBodyLines.join('\n'));
            const emailTarget = mfg?.orderEmail || mfg?.email || '';
            const mailtoUrl = emailTarget ? `mailto:${emailTarget}?subject=${emailSubject}&body=${emailBody}` : '';

            return (
              <div 
                key={mfgId} 
                className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs"
              >
                {/* Manufacturer Header Strip with Direct Contacts */}
                <div className="p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900 dark:text-white font-display">
                        {mfg?.name || 'Fabricante'}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                        {mfgMissingUnits} prendas pendientes
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                      <span>{items.length} artículos afectados</span>
                      <span>·</span>
                      <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                        Coste pendiente: {mfgMissingTotalCost.toFixed(2)} € neto ({ (mfgMissingTotalCost * 1.262).toFixed(2) } € con R.E.)
                      </span>
                    </div>
                  </div>

                  {/* Contact Shortcuts */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Representative Phone */}
                    {mfg?.salesRepPhone && (
                      <a
                        href={`tel:${mfg.salesRepPhone}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        title={`Llamar al representante: ${mfg.salesRepName || ''}`}
                      >
                        <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Rep: {mfg.salesRepPhone}</span>
                      </a>
                    )}

                    {/* Manufacturer Orders Phone */}
                    {mfg?.phone && (
                      <a
                        href={`tel:${mfg.phone}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        title="Llamar a teléfono de pedidos del fabricante"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Fábrica: {mfg.phone}</span>
                      </a>
                    )}

                    {/* Reclamar por Email Button */}
                    {mailtoUrl ? (
                      <a
                        href={mailtoUrl}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 transition-colors"
                        title="Abrir correo de reclamación preparado con todas las faltas"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Reclamar por Email</span>
                      </a>
                    ) : null}
                  </div>
                </div>

                {/* Missing Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100/70 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">Artículo / Modelo</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-28">Medida</th>
                        <th className="py-2.5 px-3 font-semibold w-40">Pedido / Albarán</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-36">Estado Entrega</th>
                        <th className="py-2.5 px-3 font-semibold text-center w-28">Faltan</th>
                        <th className="py-2.5 px-3 font-semibold text-right w-28">Coste Pendiente</th>
                        <th className="py-2.5 px-4 font-semibold text-center w-44">Acción al Recibir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {items.map(item => {
                        return (
                          <tr key={`${item.orderId}-${item.itemId}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                            {/* Product Name */}
                            <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                              <div>{item.productName}</div>
                              <div className="text-[10px] text-slate-400 capitalize">{item.category.replace('_', ' ')}</div>
                            </td>

                            {/* Bed Size */}
                            <td className="py-3 px-3 text-center">
                              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-semibold text-slate-700 dark:text-slate-300">
                                {item.bedSize === 'Especial' ? 'Especial' : `${item.bedSize} cm`}
                              </span>
                            </td>

                            {/* Order Ref & Date */}
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                                  {item.orderNumber}
                                </span>
                                {onSelectOrderDetails && (
                                  <button
                                    type="button"
                                    onClick={() => onSelectOrderDetails(item.orderId)}
                                    className="p-0.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline"
                                    title="Abrir este pedido en el historial"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>{item.orderDate} (Sem. {item.weekNumber})</span>
                              </div>
                            </td>

                            {/* Delivery progress */}
                            <td className="py-3 px-3 text-center">
                              <span className="text-slate-600 dark:text-slate-300 font-mono text-xs">
                                Recibidas: <strong>{item.receivedQuantity}</strong> de {item.quantity}
                              </span>
                            </td>

                            {/* Missing Quantity Badge */}
                            <td className="py-3 px-3 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold font-mono text-xs bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                {item.missingQuantity} uds
                              </span>
                            </td>

                            {/* Pending Cost */}
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                              {item.missingTotalCost.toFixed(2)} €
                            </td>

                            {/* Quick Action: Mark as Arrived */}
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  // Mark fully received
                                  updateOrderItemDelivery(item.orderId, item.itemId, true, item.quantity);
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
                                title="Marcar que el transportista ya ha entregado esta mercancía"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Ya ha venido</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
