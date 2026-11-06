# TramaHogar · Gestión de Pedidos, Proveedores y Costes (Ropa de Hogar)

Aplicación web diseñada específicamente para tiendas minoristas de ropa de hogar (sábanas, colchas, rellenos nórdicos, almohadas y protectores). 

- **Control de compras semanales**: Registro ágil de albaranes por medidas de cama estándar (90, 105, 135, 150, 160, 180, 200 cm).
- **Régimen Fiscal**: Comunidad de Bienes con **Recargo de Equivalencia (26,20% = 21% IVA + 5,2% R.E.)**.
- **Comparador de Costes por Fabricante**: Consulta a qué precio compraste cada prenda y detecta subidas de precio en tiempo real.
- **Guardado en el Escritorio**: Conexión nativa con una carpeta local predefinida en el Escritorio donde se guardan automáticamente los datos y el archivo Excel (`.csv`).

---

## 🚀 Guía Rápida para Usar en tu Ordenador (Paso a Paso)

### 1. Requisito previo (solo una vez)
Tener instalado **Node.js** en tu ordenador:
- Descárgalo gratis desde su página oficial: [https://nodejs.org](https://nodejs.org) (elige la versión recomendada **LTS**).
- Instálalo dejando todas las opciones predeterminadas (pulsando Siguiente / Next).

---

### 2. Descargar el proyecto desde GitHub
Puedes hacerlo de dos formas:

- **Opción A (La más fácil sin saber Git)**:
  1. Entra en tu repositorio de GitHub.
  2. Haz clic en el botón verde **`<> Code`**.
  3. Haz clic en **`Download ZIP`**.
  4. Descomprime la carpeta ZIP en tu ordenador (por ejemplo en tu Escritorio o en Documentos).

- **Opción B (Con Git)**:
  Abre una terminal o consola y escribe:
  ```bash
  git clone https://github.com/TU_USUARIO/TU_REPOSITORIO.git
  cd TU_REPOSITORIO
  ```

---

### 3. Poner en marcha la aplicación

#### En Windows:
- Simplemente haz **doble clic en el archivo `iniciar_tienda.bat`**.
- La primera vez instalará automáticamente los archivos necesarios y abrirá tu navegador en `http://localhost:3000`.

#### Desde la consola o terminal (Windows, Mac o Linux):
Abre la terminal en la carpeta del proyecto y escribe estos dos comandos:

1. Instalar dependencias (solo la primera vez):
   ```bash
   npm install --legacy-peer-deps
   ```

2. Arrancar la aplicación:
   ```bash
   npm run dev
   ```

3. Abre tu navegador web favorito (Google Chrome o Microsoft Edge recomendado) y entra en:
   ```
   http://localhost:3000
   ```

---

### 4. Configurar tu carpeta del Escritorio
1. En la parte superior de la aplicación, haz clic en **"📁 Seleccionar carpeta ahora"** o **"Carpeta Escritorio"**.
2. Selecciona una carpeta de tu Escritorio (por ejemplo crea una carpeta llamada `Tienda_Ropa_Hogar`).
3. El navegador te pedirá permiso de lectura y escritura: pulsa **"Permitir"**.
4. ¡Listo! A partir de ese momento, cada pedido que introduzcas creará y actualizará automáticamente:
   - `registro_compras_recargo_equivalencia.csv` (para abrir directamente con Excel).
   - `tramahogar_datos_tienda.json` (base de datos con catálogo, stock y pedidos).
