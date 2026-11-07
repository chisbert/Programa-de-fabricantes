import React from 'react';
import { useStore } from '../context/StoreContext';
import { ActiveTab, BedSize } from '../types';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Package, 
  Truck, 
  Layers, 
  PlusCircle, 
  Calendar, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

interface DashboardOverviewProps {
  setActiveTab: (tab: ActiveTab) => void;
  onOpenNewOrder: () => void;
  onSelectOrderDetails?: (orderId: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  setActiveTab,
  onOpenNewOrder,
  onSelectOrderDetails,
}) => {
  const { orders, manufacturers, products, getManufacturerById } = useStore();

  // Current year & month calculation
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Monthly spend
  const monthlyOrders = orders.filter(o => {
    const d = new Date(o.orderDate);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });

  const totalMonthlySpend = monthlyOrders.reduce((sum, o) => sum + o.total, 0);
  const totalMonthlyUnits = monthlyOrders.reduce((sum, o) => {
    return sum + o.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
  }, 0);

  // Latest weekly order
  const latestOrder = orders[0];

  // Group spend by manufacturer to identify top supplier
  const spendByMfg: Record<string, { totalSpend: number; totalUnits: number; orderCount: number }> = {};
  orders.forEach(order => {
    if (!spendByMfg[order.manufacturerId]) {
      spendByMfg[order.manufacturerId] = { totalSpend: 0, totalUnits: 0, orderCount: 0 };
    }
    spendByMfg[order.manufacturerId].totalSpend += order.total;
    spendByMfg[order.manufacturerId].orderCount += 1;
    spendByMfg[order.manufacturerId].totalUnits += order.items.reduce((s, i) => s + i.quantity, 0);
  });

  let topMfgId = '';
  let maxSpend = 0;
  Object.entries(spendByMfg).forEach(([mfgId, data]) => {
    if (data.totalSpend > maxSpend) {
      maxSpend = data.totalSpend;
      topMfgId = mfgId;
    }
  });

  const topMfg = getManufacturerById(topMfgId);
  const totalAllTimeSpend = orders.reduce((sum, o) => sum + o.total, 0);
  const topMfgPercentage = totalAllTimeSpend > 0 ? ((maxSpend / totalAllTimeSpend) * 100).toFixed(0) : '0';

  // Cost increase alerts (items where unitCost > previousUnitCost)
  const itemsWithPriceIncrease: Array<{
    orderId: string;
    orderDate: string;
    mfgName: string;
    productName: string;
    ref: string;
    bedSize: BedSize;
    unitCost: number;
    previousUnitCost: number;
    diff: number;
    pct: number;
  }> = [];

  orders.slice(0, 8).forEach(order => {
    const mfg = getManufacturerById(order.manufacturerId);
    order.items.forEach(item => {
      if (item.previousUnitCost && item.unitCost > item.previousUnitCost) {
        const diff = item.unitCost - item.previousUnitCost;
        const pct = (diff / item.previousUnitCost) * 100;
        itemsWithPriceIncrease.push({
          orderId: order.id,
          orderDate: order.orderDate,
          mfgName: mfg?.name || 'Desconocido',
          productName: item.productName,
          ref: item.ref,
          bedSize: item.bedSize,
          unitCost: item.unitCost,
          previousUnitCost: item.previousUnitCost,
          diff,
          pct,
        });
      }
    });
  });

  // Count pending / in transit orders and missing units
  const pendingOrdersCount = orders.filter(o => o.status !== 'recibido').length;
  const totalMissingUnits = orders.reduce((sum, o) => {
    return sum + o.items.reduce((itemSum, item) => {
      const rec = item.receivedQuantity !== undefined
        ? item.receivedQuantity
        : (item.isReceived ? item.quantity : 0);
      return itemSum + Math.max(0, item.quantity - rec);
    }, 0);
  }, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Top Banner / Welcome with Contextual Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-display">
            Control de Pedidos y Costes por Fabricante
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Gestión semanal para tienda de ropa de hogar: compras por albarán, optimización de stock y control de precios unitarios.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setActiveTab('comparador')}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-lg transition-colors whitespace-nowrap shadow-xs"
          >
            Ver Comparador de Precios
          </button>
          <button
            onClick={onOpenNewOrder}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg shadow-sm transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4" />
            Registrar Pedido Semanal
          </button>
        </div>
      </div>

      {/* KPI 4-Card Strip (Tabular numerals, no candy pills, WCAG AA) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Gasto Mensual */}
        <div className="p-5 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Gasto Compras Mes Actual
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
              {totalMonthlySpend.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
              {totalMonthlyUnits} prendas
            </span>
            <span>en {monthlyOrders.length} pedidos semanales</span>
          </div>
        </div>

        {/* Card 2: Fabricante Principal */}
        <div className="p-5 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Fabricante con Mayor Volumen
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
              {topMfg ? topMfg.name : 'Sin datos'}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="font-semibold font-mono text-blue-600 dark:text-blue-400 tabular-nums">
              {maxSpend.toFixed(0)} €
            </span>
            <span>({topMfgPercentage}% del gasto total acumulado)</span>
          </div>
        </div>

        {/* Card 3: Variaciones y Subidas de Precio */}
        <div className="p-5 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Subidas Recientes de Coste
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono tracking-tight tabular-nums ${
              itemsWithPriceIncrease.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {itemsWithPriceIncrease.length}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">prendas con alza</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {itemsWithPriceIncrease.length > 0 
              ? 'Detectadas en los últimos albaranes recibidos'
              : 'Precios estables en pedidos recientes'}
          </div>
        </div>

        {/* Card 4: Pedidos y Albaranes */}
        <div className="p-5 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Albaranes Registrados
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
              {orders.length}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">pedidos en total</span>
          </div>
          {totalMissingUnits > 0 ? (
            <button
              onClick={() => setActiveTab('faltas')}
              className="mt-1 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 font-semibold hover:underline flex items-center gap-1"
            >
              ⚠️ Ver {totalMissingUnits} prendas que faltan
              <ArrowRight className="w-3 h-3" />
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('pedidos')}
              className="mt-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              Ver historial de pedidos
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Price Evolution Alerts & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Price Increase Warnings & Spending by Supplier */}
        <div className="lg:col-span-2 space-y-6">
          {/* Price Increase Warning Box */}
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                  Control de Subidas de Precio por Fabricante
                </h3>
              </div>
              <button
                onClick={() => setActiveTab('comparador')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Comparar todas las prendas
              </button>
            </div>

            {itemsWithPriceIncrease.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                No hay incrementos de precio detectados en los últimos pedidos.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60 mt-2">
                {itemsWithPriceIncrease.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {item.productName}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{item.mfgName}</span>
                        <span>·</span>
                        <span>Medida Cama {item.bedSize}</span>
                        <span>·</span>
                        <span>{item.orderDate}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold tabular-nums">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>+{item.diff.toFixed(2)} € (+{item.pct.toFixed(1)}%)</span>
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] tabular-nums mt-0.5">
                        De {item.previousUnitCost.toFixed(2)}€ a <span className="font-semibold text-slate-800 dark:text-slate-200">{item.unitCost.toFixed(2)}€</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Supplier Volume Breakdown */}
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                Volumen y Gasto Acumulado por Fabricante
              </h3>
              <button
                onClick={() => setActiveTab('proveedores')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Ver fichas de contacto
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              {manufacturers.map(mfg => {
                const data = spendByMfg[mfg.id] || { totalSpend: 0, totalUnits: 0, orderCount: 0 };
                const pctOfTotal = totalAllTimeSpend > 0 ? (data.totalSpend / totalAllTimeSpend) * 100 : 0;

                return (
                  <div key={mfg.id} className="text-xs">
                    <div className="flex justify-between items-baseline mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">{mfg.name}</span>
                        <span className="text-slate-400">({mfg.city})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                          {data.totalUnits} prendas ({data.orderCount} pedidos)
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                          {data.totalSpend.toFixed(2)} €
                        </span>
                      </div>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-blue-600 dark:bg-blue-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, Math.max(3, pctOfTotal))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Recent Weekly Orders */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
                Pedidos Recientes
              </h3>
              <button
                onClick={() => setActiveTab('pedidos')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Ver todos
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 mt-2">
              {orders.slice(0, 5).map(order => {
                const mfg = getManufacturerById(order.manufacturerId);
                const totalUnits = order.items.reduce((s, i) => s + i.quantity, 0);

                return (
                  <div
                    key={order.id}
                    onClick={() => {
                      if (onSelectOrderDetails) {
                        onSelectOrderDetails(order.id);
                      } else {
                        setActiveTab('pedidos');
                      }
                    }}
                    className="py-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 cursor-pointer rounded-lg px-2 -mx-2 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-xs text-slate-900 dark:text-white">
                          {mfg?.name || 'Fabricante'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          {order.orderNumber}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-xs text-slate-900 dark:text-white tabular-nums">
                          {order.total.toFixed(2)} €
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                          {totalUnits} prendas
                        </div>
                      </div>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Semana {order.weekNumber} · {order.orderDate}</span>
                      <span className="capitalize text-slate-600 dark:text-slate-300">
                        {order.status === 'recibido' ? '✓ Recibido' : order.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={onOpenNewOrder}
                className="w-full py-2 px-3 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Registrar Albarán de Esta Semana
              </button>
            </div>
          </div>

          {/* Quick Info Box: Régimen Comunidad de Bienes / Recargo de Equivalencia */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Comunidad de Bienes · Recargo de Equivalencia (26,2%)
            </div>
            <p>
              Tus compras aplican el <strong>26,2% (21% IVA + 5,2% R.E.)</strong>. Como este impuesto se integra en tu coste directo de adquisición, el sistema calcula tu coste real unitario para asegurar tus márgenes comerciales en cada prenda.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
