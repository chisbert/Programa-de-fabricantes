import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { BedSize } from '../types';
import {
  ParsedPdfAlbaranResult,
  ParsedPdfLineItem,
  runHandwritingOcrOnDataUrls,
} from '../utils/pdfOrderImport';

interface PdfImportPreviewModalProps {
  isOpen: boolean;
  fileName: string;
  parsedData: ParsedPdfAlbaranResult | null;
  onClose: () => void;
  onConfirm: (data: {
    orderDate: string;
    manufacturerId?: string | null;
    newManufacturerName?: string;
    items: Array<{
      productName: string;
      bedSize: BedSize;
      quantity: number;
      unitCost: number;
      isFabricPiece?: boolean;
    }>;
  }) => void;
}

const BED_SIZE_OPTIONS: BedSize[] = ['90', '105', '135', '150', '160', '180', '200', 'Especial'];

export const PdfImportPreviewModal: React.FC<PdfImportPreviewModalProps> = ({
  isOpen,
  fileName,
  parsedData,
  onClose,
  onConfirm,
}) => {
  const { manufacturers } = useStore();

  const [orderDate, setOrderDate] = useState('');
  const [selectedMfgId, setSelectedMfgId] = useState<string>('__NEW__');
  const [newManufacturerName, setNewManufacturerName] = useState('');
  const [items, setItems] = useState<ParsedPdfLineItem[]>([]);
  const [rawText, setRawText] = useState('');
  const [usedOcr, setUsedOcr] = useState(false);
  const [ocrError, setOcrError] = useState<string | undefined>(undefined);
  const [isReRunningOcr, setIsReRunningOcr] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const applyParsedResult = (data: ParsedPdfAlbaranResult) => {
    setOrderDate(data.orderDate || new Date().toISOString().split('T')[0]);
    if (data.matchedManufacturerId) {
      setSelectedMfgId(data.matchedManufacturerId);
      setNewManufacturerName('');
    } else {
      setSelectedMfgId('__NEW__');
      setNewManufacturerName(data.suggestedManufacturerName || '');
    }

    setItems(data.items.length > 0 ? data.items.map(item => ({ ...item })) : []);
    setRawText(data.rawText || '');
    setUsedOcr(Boolean(data.usedOcr));
    setOcrError(data.ocrError);
    setShowRawText(data.items.length === 0 && Boolean(data.rawText));
    setShowImagePreview(
      Boolean(data.previewImageUrls && data.previewImageUrls.length > 0) &&
        (data.sourceType === 'image' || data.isScannedImage || data.items.length === 0)
    );
    setFormError(null);
  };

  useEffect(() => {
    if (!isOpen || !parsedData) return;
    applyParsedResult(parsedData);
  }, [isOpen, parsedData]);

  if (!isOpen || !parsedData) return null;

  const previewUrls = parsedData.previewImageUrls || [];

  const handleRerunOcr = async () => {
    if (previewUrls.length === 0) return;
    setIsReRunningOcr(true);
    setOcrError(undefined);
    try {
      const refreshed = await runHandwritingOcrOnDataUrls(
        previewUrls,
        fileName,
        manufacturers,
        parsedData.sourceType || 'image'
      );
      applyParsedResult(refreshed);
    } finally {
      setIsReRunningOcr(false);
    }
  };

  const handleAddLine = (isFabric = false) => {
    setItems(prev => [
      ...prev,
      {
        id: `pdf-manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productName: '',
        bedSize: isFabric ? 'Especial' : '150',
        quantity: isFabric ? 0 : 1,
        unitCost: 0,
        isFabricPiece: isFabric,
      },
    ]);
    setFormError(null);
  };

  const handleUpdateLine = (id: string, patch: Partial<ParsedPdfLineItem>) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        if (patch.isFabricPiece === true) {
          next.quantity = 0;
          if (next.bedSize === '150') next.bedSize = 'Especial';
        } else if (patch.isFabricPiece === false && next.quantity <= 0) {
          next.quantity = 1;
        }
        return next;
      })
    );
    setFormError(null);
  };

  const handleRemoveLine = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = items.reduce(
    (sum, item) => sum + Math.max(0, item.quantity) * Math.max(0, item.unitCost),
    0
  );
  const vatAndRe = subtotal * 0.262;
  const totalWithRe = subtotal * 1.262;
  const totalUnits = items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0);
  const fabricPiecesCount = items.filter(i => i.isFabricPiece).length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedMfgId === '__NEW__' && !newManufacturerName.trim()) {
      setFormError('Indica el nombre del fabricante o selecciona uno existente.');
      return;
    }

    const validItems = items
      .map(item => ({
        productName: item.productName.trim(),
        bedSize: item.bedSize,
        quantity: Math.max(0, Math.round(Number(item.quantity) || 0)),
        unitCost: Number(item.unitCost) || 0,
        isFabricPiece: Boolean(item.isFabricPiece),
      }))
      .filter(
        item =>
          item.productName.length > 0 &&
          (item.isFabricPiece || item.quantity > 0) &&
          item.unitCost >= 0
      );

    if (validItems.length === 0) {
      setFormError(
        'Añade al menos un artículo válido con nombre y coste (y cantidad si no es pieza de tela).'
      );
      return;
    }

    onConfirm({
      orderDate: orderDate || new Date().toISOString().split('T')[0],
      manufacturerId: selectedMfgId === '__NEW__' ? null : selectedMfgId,
      newManufacturerName: selectedMfgId === '__NEW__' ? newManufacturerName.trim() : undefined,
      items: validItems,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              {parsedData.sourceType === 'image' ? (
                <ImageIcon className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-white truncate font-display">
                {usedOcr
                  ? 'Revisar Albarán / Hoja Escrita a Mano'
                  : 'Revisar Datos Extraídos del Documento'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Archivo:{' '}
                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                  {fileName}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {previewUrls.length > 0 && (
              <button
                type="button"
                onClick={handleRerunOcr}
                disabled={isReRunningOcr}
                className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-60"
                title="Volver a analizar la hoja o escritura a mano"
              >
                {isReRunningOcr ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">
                  {isReRunningOcr ? 'Leyendo escritura...' : 'Leer escritura'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* OCR Error or Status Banners */}
          {ocrError && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Aviso del reconocimiento de escritura</p>
                <p className="mt-0.5">{ocrError}</p>
              </div>
            </div>
          )}

          {!ocrError && items.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">No se detectaron líneas automáticamente</p>
                <p className="mt-0.5">
                  Puedes ver la hoja original abajo y añadir las líneas manualmente con «Añadir Prenda» o «Añadir Pieza de Tela».
                </p>
              </div>
            </div>
          ) : !ocrError && items.length > 0 ? (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {usedOcr ? 'Escritura reconocida: ' : 'Documento leído: '}
                <strong>{items.length}</strong> línea(s) extraída(s)
                {fabricPiecesCount > 0 ? ` (${fabricPiecesCount} de ellas pieza de tela)` : ''}. Revisa los datos antes de guardar.
              </span>
            </div>
          ) : null}

          {formError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-medium">
              {formError}
            </div>
          )}

          {/* Visual Preview of Scanned Sheet / Handwritten Photo */}
          {previewUrls.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowImagePreview(prev => !prev)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Ver imagen de la hoja / documento ({previewUrls.length} pág.)
                </span>
                {showImagePreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showImagePreview && (
                <div className="p-3 bg-slate-100 dark:bg-slate-950 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                  {previewUrls.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`Página ${idx + 1} de ${fileName}`}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 object-contain bg-white max-h-72"
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Header fields: Manufacturer & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Fabricante / Proveedor *
              </label>
              <select
                value={selectedMfgId}
                onChange={e => {
                  setSelectedMfgId(e.target.value);
                  setFormError(null);
                }}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
              >
                {manufacturers.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
                <option value="__NEW__">+ Crear nuevo fabricante...</option>
              </select>

              {selectedMfgId === '__NEW__' && (
                <input
                  type="text"
                  value={newManufacturerName}
                  onChange={e => {
                    setNewManufacturerName(e.target.value);
                    setFormError(null);
                  }}
                  placeholder="Nombre del nuevo fabricante"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
                />
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Fecha del Pedido / Albarán *
              </label>
              <input
                type="date"
                value={orderDate}
                onChange={e => setOrderDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                En piezas de tela la cantidad no es obligatoria (metros variables), pero sí el resto de datos.
              </p>
            </div>
          </div>

          {/* Extracted Lines Table */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Artículos Reconocidos ({items.length})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAddLine(true)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Añadir Pieza de Tela
                </button>
                <button
                  type="button"
                  onClick={() => handleAddLine(false)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Añadir Prenda
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Artículo / Tela</th>
                    <th className="py-2.5 px-2 font-semibold text-center w-20">Pieza tela</th>
                    <th className="py-2.5 px-2.5 font-semibold w-28">Medida</th>
                    <th className="py-2.5 px-2.5 font-semibold text-right w-28">Cantidad</th>
                    <th className="py-2.5 px-2.5 font-semibold text-right w-28">Coste (€)</th>
                    <th className="py-2.5 px-3 font-semibold text-right w-28">Total Línea</th>
                    <th className="py-2.5 px-2 font-semibold text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400 text-xs">
                        No hay líneas en la tabla. Usa los botones de arriba para añadir prendas o piezas de tela.
                      </td>
                    </tr>
                  ) : (
                    items.map(item => {
                      const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitCost) || 0);
                      const isVarPiece = Boolean(item.isFabricPiece && item.quantity === 0);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.productName}
                              onChange={e => handleUpdateLine(item.id, { productName: e.target.value })}
                              placeholder="Nombre del artículo o tela..."
                              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={Boolean(item.isFabricPiece)}
                              onChange={e => handleUpdateLine(item.id, { isFabricPiece: e.target.checked })}
                              title="Marcar si es pieza de tela (cantidad no obligatoria)"
                              className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={item.bedSize}
                              onChange={e => handleUpdateLine(item.id, { bedSize: e.target.value as BedSize })}
                              className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
                            >
                              {BED_SIZE_OPTIONS.map(size => (
                                <option key={size} value={size}>
                                  {size === 'Especial' ? 'Especial' : `${size} cm`}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            {item.isFabricPiece ? (
                              <input
                                type="number"
                                min="0"
                                value={item.quantity > 0 ? item.quantity : ''}
                                onChange={e =>
                                  handleUpdateLine(item.id, {
                                    quantity: Math.max(0, parseInt(e.target.value, 10) || 0),
                                  })
                                }
                                placeholder="Var. (opc.)"
                                className="w-full px-2 py-1.5 text-xs text-right font-mono font-medium bg-amber-50/50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
                              />
                            ) : (
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={e =>
                                  handleUpdateLine(item.id, {
                                    quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                                  })
                                }
                                className="w-full px-2 py-1.5 text-xs text-right font-mono font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
                              />
                            )}
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unitCost}
                              onChange={e =>
                                handleUpdateLine(item.id, {
                                  unitCost: Math.max(0, parseFloat(e.target.value) || 0),
                                })
                              }
                              className="w-full px-2 py-1.5 text-xs text-right font-mono font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
                            />
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                            {isVarPiece ? (
                              <span className="text-xs font-sans font-semibold text-amber-700 dark:text-amber-400">
                                Variable
                              </span>
                            ) : (
                              `${lineTotal.toFixed(2)} €`
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(item.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                              title="Eliminar línea"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Summary */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Total:{' '}
              <strong className="text-slate-900 dark:text-white">
                {totalUnits} uds{fabricPiecesCount > 0 ? ` + ${fabricPiecesCount} pieza(s) tela` : ''}
              </strong>
              <span className="mx-2">·</span>
              Régimen C.B.: IVA 21% + R.E. 5,2% (26,2%)
            </div>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-right">
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Base Imponible Neta</div>
                <div className="font-mono font-bold text-sm text-slate-900 dark:text-white tabular-nums">
                  {subtotal.toFixed(2)} €
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Impuestos (26,2%)</div>
                <div className="font-mono font-semibold text-sm text-slate-700 dark:text-slate-300 tabular-nums">
                  +{vatAndRe.toFixed(2)} €
                </div>
              </div>
              <div>
                <div className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">Total c/ R.E. (26,2%)</div>
                <div className="font-mono font-bold text-base text-blue-700 dark:text-blue-400 tabular-nums">
                  {totalWithRe.toFixed(2)} €
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible Raw Text / Handwriting Transcription */}
          {rawText && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowRawText(prev => !prev)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span>
                  {usedOcr
                    ? 'Ver transcripción de la escritura (para comprobar datos)'
                    : 'Ver texto extraído del PDF (para comprobar datos)'}
                </span>
                {showRawText ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showRawText && (
                <pre className="p-3 bg-slate-900 text-slate-200 text-[11px] font-mono overflow-x-auto max-h-52 whitespace-pre-wrap leading-relaxed">
                  {rawText}
                </pre>
              )}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirmar e Importar Albarán
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
