import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { 
  Folder, 
  FolderCheck, 
  FolderPlus, 
  HardDrive, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  X, 
  FileSpreadsheet, 
  FileCode, 
  Info,
  Unplug
} from 'lucide-react';

interface LocalFolderConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LocalFolderConfigModal: React.FC<LocalFolderConfigModalProps> = ({ isOpen, onClose }) => {
  const { 
    localFolder, 
    selectDesktopFolder, 
    disconnectDesktopFolder, 
    syncToDesktopFolder, 
    toggleAutoSaveToFolder 
  } = useStore();

  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; isError?: boolean } | null>(null);

  if (!isOpen) return null;

  const handleSelectFolder = async () => {
    setFeedback(null);
    const success = await selectDesktopFolder();
    if (success) {
      setFeedback({ message: 'Carpeta vinculada correctamente. Los archivos se han guardado con éxito.' });
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setFeedback(null);
    const result = await syncToDesktopFolder();
    setIsSyncing(false);
    if (result.success) {
      setFeedback({ message: result.message || 'Archivos sincronizados en tu carpeta local.' });
    } else {
      setFeedback({ message: result.message || 'Error al guardar en la carpeta.', isError: true });
    }
  };

  const handleDisconnect = async () => {
    if (window.confirm('¿Desconectar la carpeta local predefinida? La aplicación continuará funcionando guardando en el navegador.')) {
      await disconnectDesktopFolder();
      setFeedback({ message: 'Carpeta desconectada.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-xl p-6 space-y-5 animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white font-display">
                Carpeta Predefinida de Guardado Local
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Guarda tus albaranes y base de datos directamente en una carpeta de tu Escritorio.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback message */}
        {feedback && (
          <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
            feedback.isError 
              ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900' 
              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
          }`}>
            {feedback.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Current status block */}
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Estado de la Carpeta:
            </span>
            {localFolder.isConnected ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-900">
                <FolderCheck className="w-3.5 h-3.5" />
                Conectada: "{localFolder.folderName}"
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-700 px-2.5 py-1 rounded-full">
                <Folder className="w-3.5 h-3.5" />
                Ninguna carpeta seleccionada
              </span>
            )}
          </div>

          {localFolder.isConnected && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700 flex justify-between">
              <span>Último guardado en disco:</span>
              <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                {localFolder.lastSyncTime || 'Al conectar'}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {!localFolder.isConnected ? (
            <button
              onClick={handleSelectFolder}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 text-xs"
            >
              <FolderPlus className="w-4 h-4" />
              Seleccionar Carpeta en el Escritorio
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Guardando...' : 'Guardar Cambios Ahora'}
              </button>

              <button
                onClick={handleSelectFolder}
                className="py-2.5 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 text-xs"
              >
                <Folder className="w-3.5 h-3.5" />
                Cambiar de Carpeta
              </button>
            </div>
          )}

          {/* Auto-save toggle */}
          {localFolder.isConnected && (
            <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  Guardado automático continuo
                </div>
                <div className="text-[11px] text-slate-500">
                  Sobrescribe los archivos en el escritorio al registrar nuevos pedidos o modificar stock.
                </div>
              </div>
              <input
                type="checkbox"
                checked={localFolder.autoSave}
                onChange={e => toggleAutoSaveToFolder(e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {/* Information on files saved */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 space-y-2 text-xs">
          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            ¿Qué archivos se crean en la carpeta de tu Escritorio?
          </div>
          <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
            <div className="flex items-start gap-2">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>registro_compras_recargo_equivalencia.csv</strong>: Archivo directo de hoja de cálculo para Microsoft Excel con todas las compras, precios con el 26,2% y existencias.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FileCode className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>tramahogar_datos_tienda.json</strong>: Copia de seguridad exacta y completa con tu catálogo de ropa de hogar, proveedores y pedidos.
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
          {localFolder.isConnected ? (
            <button
              onClick={handleDisconnect}
              className="text-red-600 hover:text-red-700 dark:text-red-400 text-xs flex items-center gap-1 font-medium"
            >
              <Unplug className="w-3.5 h-3.5" />
              Desconectar carpeta
            </button>
          ) : (
            <span className="text-[11px] text-slate-400">
              Compatible con Google Chrome, Edge y navegadores Chromium.
            </span>
          )}

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
