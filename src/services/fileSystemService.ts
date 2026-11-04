// Service for Local File System Access API (Desktop / Local Folder sync)

const DB_NAME = 'TramaHogar_FS_DB';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const HANDLE_KEY = 'desktop_directory_handle';

export interface LocalFolderStatus {
  isSupported: boolean;
  isConnected: boolean;
  folderName: string | null;
  lastSyncTime: string | null;
  error: string | null;
}

// Open IndexedDB to persist FileSystemDirectoryHandle
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Store directory handle in IndexedDB
export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(handle, HANDLE_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Retrieve stored directory handle from IndexedDB
export async function getSavedDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// Clear stored directory handle
export async function clearSavedDirectoryHandle(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(HANDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Ignore error
  }
}

export const fileSystemService = {
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  },

  async pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
    if (!this.isSupported()) {
      throw new Error('Tu navegador actual no soporta selección directa de carpetas del sistema. Te recomendamos usar Google Chrome o Microsoft Edge.');
    }

    try {
      // Prompt user to select directory, optionally hinting desktop
      const handle = await (window as any).showDirectoryPicker({
        id: 'tramahogar_desktop_dir',
        mode: 'readwrite',
        startIn: 'desktop',
      });

      await saveDirectoryHandle(handle);
      return handle;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return null; // User cancelled the picker dialog
      }
      throw err;
    }
  },

  async verifyPermission(handle: FileSystemDirectoryHandle, readWrite = true): Promise<boolean> {
    const options: any = {};
    if (readWrite) {
      options.mode = 'readwrite';
    }

    if ((await (handle as any).queryPermission(options)) === 'granted') {
      return true;
    }

    if ((await (handle as any).requestPermission(options)) === 'granted') {
      return true;
    }

    return false;
  },

  async writeFilesToDirectory(
    dirHandle: FileSystemDirectoryHandle, 
    jsonData: any, 
    csvContent: string
  ): Promise<{ filesWritten: string[] }> {
    const filesWritten: string[] = [];

    // 1. Write the main JSON backup file
    const jsonFileName = 'tramahogar_datos_tienda.json';
    const jsonFileHandle = await dirHandle.getFileHandle(jsonFileName, { create: true });
    const jsonWritable = await (jsonFileHandle as any).createWritable();
    await jsonWritable.write(JSON.stringify(jsonData, null, 2));
    await jsonWritable.close();
    filesWritten.push(jsonFileName);

    // 2. Write the Excel-ready CSV with UTF-8 BOM
    const csvFileName = 'registro_compras_recargo_equivalencia.csv';
    const csvFileHandle = await dirHandle.getFileHandle(csvFileName, { create: true });
    const csvWritable = await (csvFileHandle as any).createWritable();
    await csvWritable.write(csvContent);
    await csvWritable.close();
    filesWritten.push(csvFileName);

    // 3. Write a friendly README in that desktop folder
    const readmeFileName = 'LEEME_INFORMACION_CARPETA.txt';
    const readmeHandle = await dirHandle.getFileHandle(readmeFileName, { create: true });
    const readmeWritable = await (readmeHandle as any).createWritable();
    const readmeText = `TRAMAHOGAR - REGISTRO DE COMPRAS Y GESTIÓN DE COSTES (ROPA DE HOGAR)
========================================================================
Carpeta de guardado local en el Escritorio.
Régimen: Comunidad de Bienes (Recargo de Equivalencia 26,20% = 21% IVA + 5,2% R.E.)

Archivos contenidos:
1. "registro_compras_recargo_equivalencia.csv":
   - Hoja de cálculo directa para abrir con Microsoft Excel.
   - Contiene todas las compras por fabricante, prendas, medidas de cama y costes.

2. "tramahogar_datos_tienda.json":
   - Base de datos completa con tu catálogo, stock y pedidos.
   - Se actualiza cada vez que guardas un pedido o cambias el inventario.

Última sincronización: ${new Date().toLocaleString('es-ES')}
`;
    await readmeWritable.write(readmeText);
    await readmeWritable.close();
    filesWritten.push(readmeFileName);

    return { filesWritten };
  },

  async readDataFromDirectory(dirHandle: FileSystemDirectoryHandle): Promise<any | null> {
    try {
      const fileHandle = await dirHandle.getFileHandle('tramahogar_datos_tienda.json');
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
};
