import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Manufacturer, BedSize } from '../types';
import { 
  Truck, 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  CreditCard, 
  Plus, 
  ChevronRight, 
  Package, 
  TrendingUp, 
  Edit3, 
  X, 
  Check,
  Building2
} from 'lucide-react';

interface ManufacturerDirectoryViewProps {
  onOpenNewOrder: () => void;
}

export const ManufacturerDirectoryView: React.FC<ManufacturerDirectoryViewProps> = ({
  onOpenNewOrder,
}) => {
  const { manufacturers, orders, products, addManufacturer, updateManufacturer } = useStore();

  const [selectedMfgId, setSelectedMfgId] = useState<string>(manufacturers[0]?.id || '');
  const [isAddingMfg, setIsAddingMfg] = useState(false);
  const [editingMfgId, setEditingMfgId] = useState<string | null>(null);

  // Form state for adding/editing manufacturer
  const [formData, setFormData] = useState<Partial<Manufacturer>>({
    name: '',
    code: '',
    city: '',
    contactPerson: '',
    phone: '',
    email: '',
    paymentTerms: 'Giro a 30 días',
    deliveryDays: 3,
    notes: '',
  });

  const selectedMfg = manufacturers.find(m => m.id === selectedMfgId);

  // Calculate stats for each manufacturer
  const mfgStats = React.useMemo(() => {
    const stats: Record<string, {
      totalSpend: number;
      totalUnits: number;
      orderCount: number;
      itemsMap: Map<string, {
        productId: string;
        productName: string;
        ref: string;
        bedSize: BedSize;
        totalUnits: number;
        latestUnitCost: number;
        totalCost: number;
        lastPurchaseDate: string;
      }>;
    }> = {};

    manufacturers.forEach(m => {
      stats[m.id] = {
        totalSpend: 0,
        totalUnits: 0,
        orderCount: 0,
        itemsMap: new Map(),
      };
    });

    orders.forEach(order => {
      const s = stats[order.manufacturerId];
      if (!s) return;
      s.totalSpend += order.total;
      s.orderCount += 1;

      order.items.forEach(item => {
        s.totalUnits += item.quantity;
        const key = `${item.productId}-${item.bedSize}`;
        const existing = s.itemsMap.get(key);
        if (existing) {
          existing.totalUnits += item.quantity;
          existing.totalCost += item.quantity * item.unitCost;
          if (new Date(order.orderDate).getTime() > new Date(existing.lastPurchaseDate).getTime()) {
            existing.latestUnitCost = item.unitCost;
            existing.lastPurchaseDate = order.orderDate;
          }
        } else {
          s.itemsMap.set(key, {
            productId: item.productId,
            productName: item.productName,
            ref: item.ref,
            bedSize: item.bedSize,
            totalUnits: item.quantity,
            latestUnitCost: item.unitCost,
            totalCost: item.quantity * item.unitCost,
            lastPurchaseDate: order.orderDate,
          });
        }
      });
    });

    return stats;
  }, [manufacturers, orders]);

  const handleOpenEdit = (mfg: Manufacturer) => {
    setEditingMfgId(mfg.id);
    setFormData(mfg);
  };

  const handleSaveMfg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    if (editingMfgId) {
      updateManufacturer(editingMfgId, formData);
      setEditingMfgId(null);
    } else {
      const created = addManufacturer({
        name: formData.name.trim(),
        code: formData.code?.toUpperCase().trim() || formData.name.slice(0, 3).toUpperCase(),
        city: formData.city?.trim() || 'España',
        contactPerson: formData.contactPerson?.trim() || '',
        phone: formData.phone?.trim() || '',
        email: formData.email?.trim() || '',
        paymentTerms: formData.paymentTerms || 'Giro 30 días',
        deliveryDays: Number(formData.deliveryDays) || 3,
        notes: formData.notes?.trim() || '',
      });
      setSelectedMfgId(created.id);
      setIsAddingMfg(false);
    }
  };

  const currentStats = selectedMfgId ? mfgStats[selectedMfgId] : null;
  const purchasedArticles = currentStats ? Array.from(currentStats.itemsMap.values()) : [];
  const mfgOrders = orders.filter(o => o.manufacturerId === selectedMfgId);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-display">
            Directorio y Control de Costes por Fabricante
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Conoce con exactitud qué artículos has comprado a cada marca, en qué cantidades y a qué precio unitario.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({
              name: '',
              code: '',
              city: '',
              contactPerson: '',
              phone: '',
              email: '',
              paymentTerms: 'Giro a 30 días',
              deliveryDays: 3,
            });
            setIsAddingMfg(true);
          }}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap self-start md:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Añadir Nuevo Fabricante
        </button>
      </div>

      {/* Add / Edit Manufacturer Modal */}
      {(isAddingMfg || editingMfgId) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {editingMfgId ? 'Editar Fabricante' : 'Nuevo Fabricante Textil'}
              </h3>
              <button
                onClick={() => {
                  setIsAddingMfg(false);
                  setEditingMfgId(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMfg} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre Comercial *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Textils Morera"
                  value={formData.name || ''}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Código / Sigla</label>
                  <input
                    type="text"
                    placeholder="Ej. MOR"
                    value={formData.code || ''}
                    onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Ciudad / Sede</label>
                  <input
                    type="text"
                    placeholder="Ej. Ontinyent"
                    value={formData.city || ''}
                    onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
                  <input
                    type="text"
                    placeholder="+34 96..."
                    value={formData.phone || ''}
                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Pedidos</label>
                  <input
                    type="email"
                    placeholder="pedidos@..."
                    value={formData.email || ''}
                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Condición de Pago</label>
                  <input
                    type="text"
                    placeholder="Ej. Giro 60 días"
                    value={formData.paymentTerms || ''}
                    onChange={e => setFormData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Plazo Entrega (Días)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.deliveryDays || 3}
                    onChange={e => setFormData(prev => ({ ...prev, deliveryDays: parseInt(e.target.value) || 3 }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  placeholder="Gama de producto, comerciales, descuento comercial acordado..."
                  value={formData.notes || ''}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingMfg(false);
                    setEditingMfgId(null);
                  }}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded"
                >
                  Guardar Fabricante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Layout: Master-Detail List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 Cols): List of Manufacturers */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
            Fabricantes Activos ({manufacturers.length})
          </div>

          <div className="space-y-2">
            {manufacturers.map(mfg => {
              const stats = mfgStats[mfg.id] || { totalSpend: 0, totalUnits: 0, orderCount: 0 };
              const isSelected = selectedMfgId === mfg.id;

              return (
                <div
                  key={mfg.id}
                  onClick={() => setSelectedMfgId(mfg.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500/50 shadow-xs'
                      : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">
                        {mfg.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{mfg.city}</span>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300'}`} />
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-500">Gasto total:</span>
                      <span className="ml-1 font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                        {stats.totalSpend.toFixed(2)} €
                      </span>
                    </div>
                    <div className="text-slate-500 tabular-nums">
                      {stats.totalUnits} prendas
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (8 Cols): Detail of Selected Manufacturer */}
        <div className="lg:col-span-8 space-y-6">
          {selectedMfg ? (
            <>
              {/* Manufacturer Card Info */}
              <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
                      {selectedMfg.name}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {selectedMfg.notes || 'Proveedor de ropa de hogar.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(selectedMfg)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Editar Ficha
                    </button>
                    <button
                      onClick={onOpenNewOrder}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Hacer Pedido a {selectedMfg.name}
                    </button>
                  </div>
                </div>

                {/* Contact & Terms Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 flex items-center gap-1">
                      <CreditCard className="w-3 h-3" /> Condición Pago
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 mt-1 block">
                      {selectedMfg.paymentTerms}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Tiempo Entrega
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 mt-1 block">
                      ~{selectedMfg.deliveryDays} días laborables
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Teléfono
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 mt-1 block">
                      {selectedMfg.phone || 'No registrado'}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email Pedidos
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 mt-1 block truncate">
                      {selectedMfg.email || 'No registrado'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Purchased Articles Breakdown: The exact answer to "que articulos he comprado a que fabricante y que cantidad" */}
              <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                      Artículos Comprados a {selectedMfg.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Desglose por modelo, medidas de cama, unidades acumuladas y coste unitario más reciente.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">
                    {purchasedArticles.length} referencias compradas
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Referencia</th>
                        <th className="py-2.5 px-3 font-semibold">Prenda Textil</th>
                        <th className="py-2.5 px-3 font-semibold text-center">Medida</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Uds. Compradas</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Último Coste (€)</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Inversión Total</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Última Compra</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {purchasedArticles.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">
                            Aún no has registrado pedidos para este fabricante.
                          </td>
                        </tr>
                      ) : (
                        purchasedArticles.map((art, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-mono font-medium text-slate-600 dark:text-slate-300">
                              {art.ref}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                              {art.productName}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono font-semibold">
                                Cama {art.bedSize}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                              {art.totalUnits} uds
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                              {art.latestUnitCost.toFixed(2)} €
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                              {art.totalCost.toFixed(2)} €
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-500 tabular-nums">
                              {art.lastPurchaseDate}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-8 text-center text-slate-500">
              Selecciona un fabricante para ver su histórico.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
