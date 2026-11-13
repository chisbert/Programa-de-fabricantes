import React, { useState, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { PurchaseOrder } from '../types';
import { 
  Package, 
  Calendar, 
  Trash2, 
  Copy, 
  Search, 
  Filter, 
  Download, 
  Upload, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  AlertCircle,
  AlertTriangle,
  Check,
  X,
  Loader2
} from 'lucide-react';
import { parseAlbaranDocumentFile, ParsedPdfAlbaranResult } from '../utils/pdfOrderImport';
import { PdfImportPreviewModal } from './PdfImportPreviewModal';

interface OrderHistoryViewProps {
  onOpenNewOrder: () => void;
  selectedOrderId?: string | null;
}

export const OrderHistoryView: React.FC<OrderHistoryViewProps> = ({
  onOpenNewOrder,
  selectedOrderId,
}) => {
  const { 
    orders, 
    manufacturers, 
    deleteOrder, 
    getManufacturerById, 
    addOrder, 
    exportOrdersToCsv, 
    importSingleOrderJson,
    importParsedOrder,
    updateOrderItemDelivery,
    markAllOrderItemsReceived
  } = useStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadMessage, setUploadMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [pdfPreviewData, setPdfPreviewData] = useState<{
    fileName: string;
    result: ParsedPdfAlbaranResult;
  } | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(selectedOrderId || (orders[0]?.id || null));
  const [filterMfg, setFilterMfg] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const isDocument =
      file.name.toLowerCase().endsWith('.pdf') ||
      file.type === 'application/pdf' ||
      file.type.startsWith('image/') ||
      /\.(jpg|jpeg|png|webp|heic|bmp)$/i.test(file.name.toLowerCase());

    if (isDocument) {
      setIsParsingPdf(true);
      setUploadMessage(null);
      try {
        const res = await parseAlbaranDocumentFile(file, manufacturers);
        if (!res.success) {
          setUploadMessage({ text: res.error || 'No se pudo leer el documento.', isError: true });
        } else {
          setPdfPreviewData({ fileName: file.name, result: res });
        }
      } catch (err: any) {
        setUploadMessage({
          text: `Error al procesar el documento: ${err?.message || 'archivo no compatible'}`,
          isError: true,
        });
      } finally {
        setIsParsingPdf(false);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      let content = '';
      try {
        content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        content = new TextDecoder('windows-1252').decode(buffer);
      }

      const res = importSingleOrderJson(content, file.name);
      if (res.success) {
        setUploadMessage({ text: res.message });
        if (res.order) {
          setExpandedOrderId(res.order.id);
        }
      } else {
        setUploadMessage({ text: res.message, isError: true });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    if (filterMfg !== 'todos' && order.manufacturerId !== filterMfg) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const mfg = getManufacturerById(order.manufacturerId)?.name.toLowerCase() || '';
      const orderNum = order.orderNumber.toLowerCase();
      const hasProduct = order.items.some(i => i.productName.toLowerCase().includes(q) || i.ref.toLowerCase().includes(q));
      if (!mfg.includes(q) && !orderNum.includes(q) && !hasProduct) return false;
    }
    return true;
  });

  const toggleExpand = (id: string) => {
    setExpandedOrderId(prev => prev === id ? null : id);
  };

  const handleDuplicateOrder = (order: PurchaseOrder) => {
    const today = new Date();
    addOrder({
      orderNumber: `ALB-${order.orderNumber.replace(/ALB-/, '')}-REP`,
      orderDate: today.toISOString().split('T')[0],
      weekNumber: Math.ceil((((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / 86400000) + 1) / 7),
      year: today.getFullYear(),
      manufacturerId: order.manufacturerId,
      status: 'recibido',
      items: order.items.map(item => ({
        ...item,
        id: `item-${Date.now()}-${Math.random()}`,
      })),
      discountPercentage: order.discountPercentage,
      shippingCost: order.shippingCost || 0,
      vatRate: 26.2,
      subtotal: order.subtotal,
      total: Number((order.subtotal * 1.262).toFixed(2)),
      notes: `Reposición rápida basada en ${order.orderNumber} (Régimen R.E. 26.2%)`,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-display">
            Histórico de Pedidos Semanales y Albaranes
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Registro cronológico de todas las compras: fabricante, artículos, medidas, cantidades y precio unitario pagado.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".json,.csv,.pdf,.jpg,.jpeg,.png,.webp,.bmp"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsingPdf}
            className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-60"
            title="Importar albarán CSV, PDF, foto o hoja escrita a mano (JPG/PNG)"
          >
            {isParsingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin" />
                Leyendo documento...
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Importar Albarán
              </>
            )}
          </button>
          <button
            onClick={exportOrdersToCsv}
            className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar CSV
          </button>
          <button
            onClick={onOpenNewOrder}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
          >
            <Package className="w-3.5 h-3.5" />
            Registrar Nuevo Pedido
          </button>
        </div>
      </div>

      {/* Upload Feedback banner */}
      {uploadMessage && (
        <div className={`p-3 rounded-lg text-xs flex items-center justify-between gap-2 ${
          uploadMessage.isError 
            ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900' 
            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
        }`}>
          <div className="flex items-center gap-2">
            {uploadMessage.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{uploadMessage.text}</span>
          </div>
          <button 
            onClick={() => setUploadMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Filter row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por fabricante, nº de albarán o prenda..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
          />
        </div>

        <div>
          <select
            value={filterMfg}
            onChange={e => setFilterMfg(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
          >
            <option value="todos">Todos los fabricantes</option>
            {manufacturers.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-500 dark:text-slate-400 text-xs">
            <Package className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            No se encontraron pedidos con los criterios de búsqueda.
          </div>
        ) : (
          filteredOrders.map(order => {
            const mfg = getManufacturerById(order.manufacturerId);
            const isExpanded = expandedOrderId === order.id;
            const totalUnits = order.items.reduce(
              (s, i) => s + (i.isFabricPiece && i.quantity === 0 ? 1 : i.quantity),
              0
            );
            const receivedUnits = order.items.reduce((s, i) => {
              if (i.isFabricPiece && i.quantity === 0) {
                return s + (i.isReceived ? 1 : 0);
              }
              return s + (i.receivedQuantity ?? (i.isReceived ? i.quantity : 0));
            }, 0);
            const fabricPieceCount = order.items.filter(i => i.isFabricPiece && i.quantity === 0).length;
            const regularUnits = order.items.reduce((s, i) => s + i.quantity, 0);
            const missingUnits = Math.max(0, totalUnits - receivedUnits);
            const isComplete = missingUnits === 0;

            return (
              <div
                key={order.id}
                className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs transition-shadow"
              >
                {/* Order Summary Strip */}
                <div
                  onClick={() => toggleExpand(order.id)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {mfg?.name || 'Fabricante'}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="font-mono text-xs text-slate-600 dark:text-slate-300 font-semibold">
                          {order.orderNumber}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                        <span>Semana {order.weekNumber} · {order.orderDate}</span>
                        <span>·</span>
                        <span>
                          {regularUnits > 0 ? `${regularUnits} prendas` : ''}
                          {regularUnits > 0 && fabricPieceCount > 0 ? ' + ' : ''}
                          {fabricPieceCount > 0 ? `${fabricPieceCount} pieza(s) tela` : ''}
                        </span>
                        <span>·</span>
                        {isComplete ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded text-[11px]">
                            <CheckCircle2 className="w-3 h-3" />
                            Completo
                          </span>
                        ) : receivedUnits > 0 ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded text-[11px]">
                            <AlertTriangle className="w-3 h-3" />
                            Parcial: Faltan {missingUnits} uds
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded text-[11px]">
                            <AlertCircle className="w-3 h-3" />
                            Pendiente ({totalUnits} uds)
                          </span>
                        )}
                        {(order.shippingCost || 0) > 0 && (
                          <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded text-[11px] tabular-nums">
                            Portes: {order.shippingCost!.toFixed(2)} €
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5">
                    <div className="text-right">
                      <div className="font-mono font-bold text-base text-slate-900 dark:text-white tabular-nums">
                        {order.total.toFixed(2)} €
                      </div>
                      <div className="text-[11px] text-slate-400 tabular-nums">
                        Base: {order.subtotal.toFixed(2)}€
                        {(order.shippingCost || 0) > 0 ? ` (incl. ${order.shippingCost!.toFixed(2)}€ portes)` : ''}
                        {' '}· +{order.vatRate || 26.2}% (IVA + R.E.)
                      </div>
                    </div>

                    <div className="text-slate-400">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details: Line Items Table & Delivery Check */}
                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 p-4 sm:p-6 space-y-4">
                    {/* Delivery Control Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Revisión del Albarán:
                        </span>
                        {isComplete ? (
                          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Han venido todas las prendas ({receivedUnits} de {totalUnits} uds)
                          </span>
                        ) : (
                          <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Faltan {missingUnits} prendas de este albarán ({receivedUnits} de {totalUnits} recibidas)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAllOrderItemsReceived(order.id, true);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded transition-colors flex items-center gap-1 cursor-pointer"
                          title="Marcar todas las prendas como recibidas"
                        >
                          <Check className="w-3 h-3" />
                          Marcar todo recibido
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAllOrderItemsReceived(order.id, false);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded transition-colors flex items-center gap-1 cursor-pointer"
                          title="Marcar todas las prendas como pendientes"
                        >
                          <X className="w-3 h-3" />
                          Marcar todo pendiente
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                          <tr>
                            <th className="py-2.5 px-3 font-semibold">Artículo</th>
                            <th className="py-2.5 px-3 font-semibold text-center w-28">Medida</th>
                            <th className="py-2.5 px-3 font-semibold text-right w-24">Cantidad</th>
                            <th className="py-2.5 px-3 font-semibold text-right w-28">Precio Coste (€)</th>
                            <th className="py-2.5 px-3 font-semibold text-right w-28">Total Línea</th>
                            <th className="py-2.5 px-3 font-semibold text-center w-32">Variación</th>
                            <th className="py-2.5 px-3 font-semibold text-center w-52">¿Ha venido? (Revisión)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {order.items.map((item, idx) => {
                            const lineTotal = item.quantity * item.unitCost;
                            const prev = item.previousUnitCost;
                            let delta: { diff: number; pct: number } | null = null;
                            if (prev && item.unitCost) {
                              const diff = item.unitCost - prev;
                              const pct = (diff / prev) * 100;
                              delta = { diff, pct };
                            }

                            const isVariablePiece = Boolean(item.isFabricPiece && item.quantity === 0);
                            const itemReceivedQty = item.receivedQuantity !== undefined
                              ? item.receivedQuantity
                              : (item.isReceived ? item.quantity : 0);
                            const isItemComplete = isVariablePiece
                              ? Boolean(item.isReceived)
                              : itemReceivedQty >= item.quantity;
                            const isItemPartial = !isVariablePiece && itemReceivedQty > 0 && itemReceivedQty < item.quantity;

                            return (
                              <tr 
                                key={item.id || idx} 
                                className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                                  !isItemComplete ? 'bg-amber-50/30 dark:bg-amber-950/15' : ''
                                }`}
                              >
                                <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span>{item.productName}</span>
                                    {item.isFabricPiece && (
                                      <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded">
                                        Pieza tela
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-semibold text-slate-700 dark:text-slate-300">
                                    {item.bedSize === 'Especial' ? 'Especial' : `${item.bedSize} cm`}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                                  {isVariablePiece ? (
                                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                      Variable (m.)
                                    </span>
                                  ) : (
                                    `${item.quantity} ${item.isFabricPiece ? 'm/uds' : 'uds'}`
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                                  {item.unitCost.toFixed(2)} €
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                                  {isVariablePiece ? (
                                    <span className="text-xs font-sans font-semibold text-amber-700 dark:text-amber-400">
                                      Variable
                                    </span>
                                  ) : (
                                    `${lineTotal.toFixed(2)} €`
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {delta ? (
                                    delta.diff > 0.05 ? (
                                      <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded tabular-nums">
                                        ▲ +{delta.diff.toFixed(2)}€ (+{delta.pct.toFixed(1)}%)
                                      </span>
                                    ) : delta.diff < -0.05 ? (
                                      <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded tabular-nums">
                                        ▼ {delta.diff.toFixed(2)}€ ({delta.pct.toFixed(1)}%)
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-slate-400">= Mismo precio</span>
                                    )
                                  ) : (
                                    <span className="text-[11px] text-slate-400">1ª Compra</span>
                                  )}
                                </td>

                                {/* ¿Ha venido? (Revisión interactiva) */}
                                <td className="py-2.5 px-3 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextState = !isItemComplete;
                                        updateOrderItemDelivery(order.id, item.id, nextState, nextState ? item.quantity : 0);
                                      }}
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border transition-all cursor-pointer ${
                                        isItemComplete
                                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                                          : isItemPartial
                                            ? 'bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800 hover:bg-orange-100'
                                            : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                                      }`}
                                      title={isItemComplete ? "Pulsar para marcar que no vino" : "Pulsar para marcar como recibido"}
                                    >
                                      {isItemComplete ? (
                                        <>
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                          <span>{isVariablePiece ? 'Ha venido' : `Ha venido (${item.quantity})`}</span>
                                        </>
                                      ) : isItemPartial ? (
                                        <>
                                          <AlertTriangle className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                                          <span>Parcial ({itemReceivedQty}/{item.quantity})</span>
                                        </>
                                      ) : (
                                        <>
                                          <X className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                          <span>Falta (No vino)</span>
                                        </>
                                      )}
                                    </button>

                                    {!isVariablePiece && item.quantity > 1 && (
                                      <div className="flex items-center text-slate-500 text-[11px]" title="Modificar número de unidades recibidas">
                                        <input
                                          type="number"
                                          min="0"
                                          max={item.quantity}
                                          value={itemReceivedQty}
                                          onChange={(e) => {
                                            const val = Math.max(0, Math.min(item.quantity, parseInt(e.target.value) || 0));
                                            updateOrderItemDelivery(order.id, item.id, val >= item.quantity, val);
                                          }}
                                          className="w-12 text-center py-0.5 px-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-mono font-semibold dark:text-white"
                                        />
                                        <span className="ml-0.5 text-[10px] text-slate-400 font-mono">/{item.quantity}</span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Order Footer & Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                        {(order.shippingCost || 0) > 0 && (
                          <p className="text-indigo-700 dark:text-indigo-300 font-medium tabular-nums">
                            <strong>Portes del albarán:</strong> {order.shippingCost!.toFixed(2)} € sin IVA ({(order.shippingCost! * 1.262).toFixed(2)} € c/ R.E. 26,2%)
                          </p>
                        )}
                        {order.notes && <p><strong>Observaciones:</strong> {order.notes}</p>}
                        {mfg && <p>Condiciones: {mfg.paymentTerms} · Tel: {mfg.phone}</p>}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDuplicateOrder(order)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5"
                          title="Duplicar para el pedido de esta semana"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Repetir Pedido
                        </button>

                        {confirmDeleteId === order.id ? (
                          <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/40 p-1 rounded-lg border border-red-200 dark:border-red-900">
                            <span className="text-[11px] text-red-700 dark:text-red-300 font-medium px-1">
                              ¿Eliminar albarán?
                            </span>
                            <button
                              onClick={() => {
                                deleteOrder(order.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-0.5 bg-red-600 text-white text-[11px] font-bold rounded"
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-0.5 text-slate-600 text-[11px] rounded"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(order.id)}
                            className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                            title="Eliminar registro de albarán"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* PDF Import Preview & Confirmation Modal */}
      <PdfImportPreviewModal
        isOpen={Boolean(pdfPreviewData)}
        fileName={pdfPreviewData?.fileName || ''}
        parsedData={pdfPreviewData?.result || null}
        onClose={() => setPdfPreviewData(null)}
        onConfirm={(data) => {
          const res = importParsedOrder(data);
          setPdfPreviewData(null);
          if (res.success) {
            setUploadMessage({ text: res.message });
            if (res.order) {
              setExpandedOrderId(res.order.id);
            }
          } else {
            setUploadMessage({ text: res.message, isError: true });
          }
        }}
      />
    </div>
  );
};
