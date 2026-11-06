import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { 
  X, 
  Plus, 
  Trash2, 
  Tag, 
  Layers, 
  AlertCircle, 
  CheckCircle2, 
  Info 
} from 'lucide-react';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoryCreated?: (categoryId: string) => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  onCategoryCreated,
}) => {
  const { categories, addCategory, deleteCategory, products } = useStore();

  const [newLabel, setNewLabel] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmed = newLabel.trim();
    if (!trimmed) {
      setErrorMsg('Introduce el nombre de la nueva categoría.');
      return;
    }

    // Check if category name already exists
    if (categories.some(c => c.label.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg('Ya existe una categoría con ese nombre.');
      return;
    }

    const created = addCategory({
      label: trimmed,
      description: newDescription.trim(),
    });

    setNewLabel('');
    setNewDescription('');
    setSuccessMsg(`Categoría "${created.label}" añadida con éxito.`);

    if (onCategoryCreated) {
      onCategoryCreated(created.id);
    }
  };

  const handleDelete = (id: string, label: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = deleteCategory(id);
    if (!res.success) {
      setErrorMsg(res.message || 'No se puede eliminar la categoría.');
    } else {
      setSuccessMsg(`Categoría "${label}" eliminada correctamente.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white font-display">
                Categorías de Ropa de Hogar
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Añade o personaliza las familias de artículos para clasificar tus compras y stock.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-lg flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form to add a new category */}
          <form onSubmit={handleAdd} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 rounded-xl space-y-3">
            <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Crear Nueva Categoría Textil
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre de la categoría *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Cortinas y Visillos, Toallas, Cuna..."
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Descripción (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Juegos de toallas de baño, albornoces..."
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Añadir Categoría
              </button>
            </div>
          </form>

          {/* List of existing categories */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Categorías disponibles ({categories.length})</span>
              <span>Prendas asignadas</span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-800/80">
              {categories.map(cat => {
                const count = products.filter(p => p.category === cat.id).length;

                return (
                  <div key={cat.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{cat.label}</span>
                        {cat.isCustom && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                            Personalizada
                          </span>
                        )}
                      </div>
                      {cat.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {cat.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <span className="font-mono text-slate-600 dark:text-slate-400 font-medium">
                        {count} {count === 1 ? 'prenda' : 'prendas'}
                      </span>

                      {cat.isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDelete(cat.id, cat.label)}
                          disabled={count > 0}
                          title={count > 0 ? 'No se puede eliminar porque tiene prendas asignadas' : 'Eliminar categoría'}
                          className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end shrink-0">
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
