import React, { useState, useEffect } from 'react';
import { StoreProvider } from './context/StoreContext';
import { Header } from './components/Header';
import { DashboardOverview } from './components/DashboardOverview';
import { OrderHistoryView } from './components/OrderHistoryView';
import { PriceComparatorView } from './components/PriceComparatorView';
import { ManufacturerDirectoryView } from './components/ManufacturerDirectoryView';
import { InventoryView } from './components/InventoryView';
import { NewOrderModal } from './components/NewOrderModal';
import { DataBackupModal } from './components/DataBackupModal';
import { ActiveTab } from './types';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('resumen');
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
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
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
      />

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

        {activeTab === 'comparador' && (
          <PriceComparatorView />
        )}

        {activeTab === 'proveedores' && (
          <ManufacturerDirectoryView
            onOpenNewOrder={() => setIsNewOrderOpen(true)}
          />
        )}

        {activeTab === 'inventario' && (
          <InventoryView
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

      <DataBackupModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
      />

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div>
            TramaHogar · Sistema de Control de Compras Textil y Gestión de Inventario
          </div>
          <div className="flex items-center gap-4">
            <span>Sábanas · Colchas · Edredones · Nórdicos</span>
            <span>·</span>
            <span>Copia local segura</span>
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
