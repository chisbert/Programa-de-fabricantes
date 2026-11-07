import React, { useMemo } from 'react';
import { ActiveTab } from '../types';
import { useStore } from '../context/StoreContext';
import { 
  Package, 
  TrendingUp, 
  Truck, 
  BarChart3, 
  PlusCircle, 
  Database,
  Moon,
  Sun,
  Folder,
  FolderCheck,
  Tag,
  AlertTriangle
} from 'lucide-react';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenNewOrder: () => void;
  onOpenBackup: () => void;
  onOpenFolderConfig: () => void;
  onOpenCategories?: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenNewOrder,
  onOpenBackup,
  onOpenFolderConfig,
  onOpenCategories,
  darkMode,
  toggleDarkMode,
}) => {
  const { localFolder, orders } = useStore();

  // Count total missing items across all orders for badge
  const missingItemsCount = useMemo(() => {
    let count = 0;
    orders.forEach(order => {
      order.items.forEach(item => {
        const rec = item.receivedQuantity !== undefined
          ? item.receivedQuantity
          : (item.isReceived ? item.quantity : 0);
        if (item.quantity - rec > 0) {
          count += (item.quantity - rec);
        }
      });
    });
    return count;
  }, [orders]);
  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Wordmark / Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('resumen')}
              className="flex items-center gap-2.5 text-left focus:outline-none group"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-bold text-lg shadow-sm group-hover:bg-blue-700 transition-colors">
                TH
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-display whitespace-nowrap">
                  TramaHogar
                </span>
                <span className="hidden sm:inline-block ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">
                  Gestión Textil
                </span>
              </div>
            </button>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            <button
              onClick={() => setActiveTab('resumen')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === 'resumen'
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Resumen
            </button>

            <button
              onClick={() => setActiveTab('pedidos')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === 'pedidos'
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <Package className="w-4 h-4" />
              Pedidos Semanales
            </button>

            <button
              onClick={() => setActiveTab('faltas')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === 'faltas'
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <AlertTriangle className={`w-4 h-4 ${missingItemsCount > 0 ? 'text-amber-500' : ''}`} />
              <span>Faltas de Pedidos</span>
              {missingItemsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white leading-none">
                  {missingItemsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('comparador')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === 'comparador'
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Comparador de Costes
            </button>

            <button
              onClick={() => setActiveTab('proveedores')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === 'proveedores'
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <Truck className="w-4 h-4" />
              Fabricantes
            </button>
          </nav>

          {/* Zone 3: Primary Action + Utilities */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenFolderConfig}
              title={localFolder.isConnected ? `Carpeta vinculada: ${localFolder.folderName}` : 'Vincular carpeta del Escritorio para guardado directo'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                localFolder.isConnected
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              {localFolder.isConnected ? (
                <FolderCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              )}
              <span className="hidden sm:inline font-mono text-[11px] max-w-[130px] truncate">
                {localFolder.isConnected ? localFolder.folderName : 'Carpeta Escritorio'}
              </span>
            </button>

            <button
              onClick={onOpenBackup}
              title="Copia de seguridad y exportación a Excel / CSV"
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Copia de seguridad y exportar"
            >
              <Database className="w-4 h-4" />
            </button>

            {onOpenCategories && (
              <button
                onClick={onOpenCategories}
                title="Gestionar Categorías de Ropa de Hogar"
                className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                aria-label="Gestionar categorías"
              >
                <Tag className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={toggleDarkMode}
              title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Alternar tema"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={onOpenNewOrder}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg shadow-sm transition-all whitespace-nowrap shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nuevo Pedido</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav drawer / pills for narrow viewports */}
      <div className="md:hidden flex items-center gap-1 overflow-x-auto px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
        <button
          onClick={() => setActiveTab('resumen')}
          className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'resumen'
              ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Resumen
        </button>
        <button
          onClick={() => setActiveTab('pedidos')}
          className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'pedidos'
              ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Pedidos
        </button>
        <button
          onClick={() => setActiveTab('faltas')}
          className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap flex items-center gap-1 ${
            activeTab === 'faltas'
              ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <span>Faltas</span>
          {missingItemsCount > 0 && (
            <span className="px-1 py-0.2 text-[9px] font-bold rounded-full bg-amber-500 text-white">
              {missingItemsCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('comparador')}
          className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'comparador'
              ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Comparador
        </button>
        <button
          onClick={() => setActiveTab('proveedores')}
          className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'proveedores'
              ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 font-semibold shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Fabricantes
        </button>
      </div>
    </header>
  );
};
