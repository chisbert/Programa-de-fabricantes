import React, { useState, useEffect } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Header } from './components/Header';
import { DashboardOverview } from './components/DashboardOverview';
import { OrderHistoryView } from './components/OrderHistoryView';
import { PendingItemsView } from './components/PendingItemsView';
import { PriceComparatorView } from './components/PriceComparatorView';
import { ManufacturerDirectoryView } from './components/ManufacturerDirectoryView';
import { NewOrderModal } from './components/NewOrderModal';
import { DataBackupModal } from './components/DataBackupModal';
import { LocalFolderConfigModal } from './components/LocalFolderConfigModal';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { ActiveTab } from './types';
import { FolderPlus, FolderCheck } from 'lucide-react';

const AppContent: React.FC = () => {
  const { localFolder } = useStore();
  const [activeTab, setActiveTab] = useState<ActiveTab>('resumen');
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Dark mode setup
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tramahogar_theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('tramahogar_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('tramahogar_theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  const handleSelectOrderDetails = (orderId: string) => {
    setSelectedOrderId(orderId);
    setActiveTab('pedidos');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors flex flex-col">
      {/* 1-Row Strict Top Bar Contract Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNewOrder={() => setIsNewOrderOpen(true)}
        onOpenBackup={() => setIsBackupOpen(true)}
        onOpenFolderConfig={() => setIsFolderModalOpen(true)}
        onOpenCategories={() => setIsCategoryModalOpen(true)}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
      />

      {/* Helpful Desktop Folder Banner */}
      {!localFolder.isConnected ? (
        <div className="bg-blue-50/80 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900/60 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
            <div className="flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>
                <strong>Guardado en Escritorio:</strong> Selecciona una carpeta de tu ordenador para guardar automáticamente los albaranes y el archivo Excel (.CSV).
              </span>
            </div>
            <button
              onClick={() => setIsFolderModalOpen(true)}
              className="font-semibold underline hover:text-blue-700 dark:hover:text-blue-300 ml-4 shrink-0 cursor-pointer"
            >
              Seleccionar carpeta ahora
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/50 px-4 py-1.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300">
            <div className="flex items-center gap-2">
              <FolderCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>
                Guardando en el Escritorio: <strong>"{localFolder.folderName}"</strong>
                {localFolder.lastSyncTime && ` · Último guardado: ${localFolder.lastSyncTime}`}
              </span>
            </div>
            <button
              onClick={() => setIsFolderModalOpen(true)}
              className="text-emerald-700 dark:text-emerald-400 underline hover:text-emerald-900 cursor-pointer"
            >
              Gestionar carpeta
            </button>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'resumen' && (
          <DashboardOverview
            setActiveTab={setActiveTab}
            onOpenNewOrder={() => setIsNewOrderOpen(true)}
            onSelectOrderDetails={handleSelectOrderDetails}
          />
        )}

        {activeTab === 'pedidos' && (
          <OrderHistoryView
            onOpenNewOrder={() => setIsNewOrderOpen(true)}
            selectedOrderId={selectedOrderId}
          />
        )}

        {activeTab === 'faltas' && (
          <PendingItemsView
            onSelectOrderDetails={handleSelectOrderDetails}
            onOpenNewOrder={() => setIsNewOrderOpen(true)}
          />
        )}

        {activeTab === 'comparador' && (
          <PriceComparatorView />
        )}

        {activeTab === 'proveedores' && (
          <ManufacturerDirectoryView
            onOpenNewOrder={() => setIsNewOrderOpen(true)}
          />
        )}
      </main>

      {/* Modals */}
      <NewOrderModal
        isOpen={isNewOrderOpen}
        onClose={() => setIsNewOrderOpen(false)}
        onOrderCreated={(newId) => {
          setSelectedOrderId(newId);
          setActiveTab('pedidos');
        }}
      />

      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
      />

      <DataBackupModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
      />

      <LocalFolderConfigModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
      />

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div>
            TramaHogar · Sistema de Control de Compras Textil y Comparador de Costes
          </div>
          <div className="flex items-center gap-4">
            <span>Sábanas · Colchas · Edredones · Nórdicos</span>
            <span>·</span>
            <span>Régimen Recargo de Equivalencia (26,2%)</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}
