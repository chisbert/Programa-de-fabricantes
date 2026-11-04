import React, { useState, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { 
  X, 
  Download, 
  Upload, 
  RotateCcw, 
  FileSpreadsheet, 
  Database, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

interface DataBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataBackupModal: React.FC<DataBackupModalProps> = ({ isOpen, onClose }) => {
  const { 
    exportBackupJson, 
    importBackupJson, 
    exportOrdersToCsv, 
    resetToSampleData, 
    orders, 
    manufacturers, 
    products 
  } = useStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importBackupJson(content);
      if (success) {
        setStatusMessage({ text: 'Copia de seguridad restaurada correctamente con éxito.' });
      } else {
        setStatusMessage({ text: 'El archivo seleccionado no tiene el formato válido de TramaHogar.', isError: true });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetData = () => {
    if (window.confirm('¿Deseas restablecer los datos de demostración? Se recargarán los fabricantes y albaranes de ejemplo.')) {
      resetToSampleData();
      setStatusMessage({ text: 'Datos de muestra restablecidos correctamente.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-5 animate-in fade-in duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white font-display">
              Exportación y Copia de Seguridad
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {statusMessage && (
          <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
            statusMessage.isError 
              ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900' 
              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
          }`}>
            {statusMessage.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <div className="space-y-4 text-xs">
          {/* Option 1: Excel CSV */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Exportar Albaranes a Excel (.CSV)
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                Descarga todas las compras con desglose por prenda, medida, coste unitario y proveedor.
              </p>
            </div>
            <button
              onClick={exportOrdersToCsv}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md shadow-xs transition-colors shrink-0"
            >
              Descargar
            </button>
          </div>

          {/* Option 2: Full JSON backup */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Download className="w-4 h-4 text-blue-600" />
                Copia Completa en JSON
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                Guarda todos los fabricantes ({manufacturers.length}), catálogo ({products.length}) y pedidos ({orders.length}).
              </p>
            </div>
            <button
              onClick={exportBackupJson}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md shadow-xs transition-colors shrink-0"
            >
              Exportar
            </button>
          </div>

          {/* Option 3: Restore JSON backup */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-indigo-600" />
                Restaurar Copia de Seguridad
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                Carga un archivo .json previamente descargado para recuperar tus datos.
              </p>
            </div>
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 text-white font-semibold rounded-md shadow-xs transition-colors shrink-0"
              >
                Cargar Archivo
              </button>
            </div>
          </div>

          {/* Option 4: Reset Demo Data */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <span className="text-slate-500 text-[11px]">
              ¿Deseas volver a los datos de prueba iniciales de la tienda?
            </span>
            <button
              onClick={handleResetData}
              className="px-2.5 py-1 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restablecer Demo
            </button>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg text-xs transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
