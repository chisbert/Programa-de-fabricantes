# TramaHogar: Gestión de Pedidos, Proveedores y Costes para Ropa de Hogar

Sistema integral y ágil de compras, control de costes por fabricante e inventario especializado para tiendas de ropa de hogar (sábanas, colchas, nórdicos, edredones, fundas y protectores).

## Decisiones Críticas y Preferencias Confirmadas

> [!IMPORTANT]
> Decisiones confirmadas a partir de tus respuestas directas:
> - **Registro Ágil de Pedidos Semanales**: Flujo optimizado para introducir albaranes/pedidos de forma rápida, con selector de proveedor, líneas dinámicas de artículos y cálculo automático de totales.
> - **Ficha Técnica Especializada en Ropa de Hogar**: Campos específicos para **medidas de cama estándar** (90, 105, 135, 150, 160, 180, 200 cm), categoría textil, fabricante/marca y coste unitario de compra.
> - **Analítica de Precios y Evolución de Costes**: Monitor comparativo entre fabricantes para detectar subidas de precios de compra, diferencias entre proveedores para un mismo tipo de artículo y márgenes comerciales recomendados.

---

## 1. Visión General y Concepto Central

- **Qué hace la aplicación**: Permite registrar semanalmente las compras realizadas a cada fabricante textil, consultar en segundos a qué precio se compró cada prenda anteriormente, comparar tarifas entre marcas para las mismas medidas de cama y controlar el gasto total acumulado por proveedor.
- **Público objetivo**: Propietarios y encargados de tiendas minoristas de ropa de hogar y descanso que realizan pedidos periódicos a múltiples fabricantes y necesitan evitar sobrecostes y desabastecimiento.
- **Valor diferencial**: Especialización en el sector textil hogar (atributos de medida de cama, tejido, gramaje y variantes de set) combinada con una vista analítica clara que avisa si un proveedor ha subido el coste unitario respecto al pedido anterior.

---

## 2. Experiencia de Usuario y Diseño Visual

### Flujos Clave de Usuario
1. **Registro Rápido de Pedido Semanal (Nuevo Albarán)**:
   - Selección del fabricante (con autocompletado y acceso a proveedores habituales como Bassols, Burrito Blanco, Reig Martí, Naturals, Pikolin Home, etc.).
   - Fecha del pedido/albarán y número de referencia.
   - Añadido ágil de líneas de pedido: selección del artículo existente o creación al vuelo, medida de cama (ej. 150 cm), cantidad de unidades y coste unitario neto.
   - El sistema muestra al instante el último precio pagado a ese fabricante y alerta si el precio ha variado (▲ incremento o ▼ descuento).
   - Guardado inmediato con actualización automática del inventario y del histórico de precios.

2. **Histórico y Comparador de Precios por Proveedor**:
   - Búsqueda por tipo de prenda (ej. "Juego de Sábanas 150 cm", "Relleno Nórdico 300g 240x220").
   - Matriz comparativa entre distintos fabricantes: muestra el coste más reciente de cada uno, el coste medio histórico y la fecha de la última compra.
   - Gráfico/línea temporal de evolución del coste unitario para anticipar márgenes antes de fijar el PVP en tienda.

3. **Panel de Control de Costes por Fabricante**:
   - Desglose del volumen de compra semanal y mensual por proveedor (€ y unidades).
   - Detección de los fabricantes con mayor peso en el presupuesto de compras.
   - Métricas clave: Gasto mensual total, coste medio por prenda, artículos con subidas recientes de precio y volumen por categoría textil.

4. **Catálogo e Inventario de Ropa de Hogar**:
   - Vista filtrable por categoría (Sábanas, Fundas Nórdicas, Colchas/Edredones, Rellenos, Almohadas/Cojines, Protectores).
   - Filtro rápido por medida de cama estándar (Cama 90, 105, 135, 150, 160, 180/200).
   - Indicador de stock actual, unidades pedidas en tránsito y precio de coste medio ponderado (PMP).

### Identidad Visual y Estilo
- **Dirección Estética**: Diseño limpio, profesional y utilitario para el comercio minorista, inspirado en interfaces de gestión modernas pero con calidez textil y neutralidad visual.
- **Paleta de Color y Ambiente**:
  - *Lienzo Neutral (60%)*: Blanco puro (`#FFFFFF`) y pizarra suave (`#F8FAFC`) con soporte para modo oscuro relajado (`#0F172A`).
  - *Superficies Estructurales (30%)*: Bordes finos de 1px (`#E2E8F0` / `#1E293B`) y fondos sutiles de tarjeta (`#FFFFFF` / `#1E293B`).
  - *Acentos Funcionales (10%)*: Azul índigo textil (`#2563EB`) para acciones primarias, verde esmeralda (`#16A34A`) para precios estables o bajadas y ámbar (`#D97706`) para avisos de subida de coste.
- **Tipografía y Jerarquía**:
  - Títulos y marca: `Plus Jakarta Sans` para una estructura clara y moderna.
  - Textos y tablas: `DM Sans` para alta legibilidad en interfaces de datos densas.
  - Importes monetarios, cantidades y referencias: Cifras tabulares `tabular-nums` monoespaciadas para alineación decimal perfecta.
- **Microinteracciones y Feedback**:
  - Alerta visual inmediata al introducir un coste unitario superior al último registrado para esa prenda.
  - Mensajes de confirmación tipo toast al guardar pedidos o actualizar inventario.
  - Búsqueda en tiempo real sin latencia al filtrar por código, fabricante o medida de cama.

---

## 3. Decisiones de Producto y Soluciones Técnicas

- **Gestión y Persistencia de Datos**:
  - *Enfoque*: Almacenamiento local persistente (`localStorage`) con precarga de catálogo realista de proveedores y artículos textiles de hogar españoles/europeos.
  - *Respaldo y Seguridad*: Exportación e importación completa en formato JSON y descarga de resúmenes en CSV para que el comerciante pueda llevarse sus datos a Excel siempre que quiera.
- **Estructura Especializada de Variantes Textiles**:
  - En lugar de tratar un juego de cama de 90 cm y uno de 150 cm como artículos independientes desconectados, se agrupan bajo el mismo modelo con variantes de medida y su coste específico por tamaño.
- **Cálculo de Precios y Variación Porcentual**:
  - Comparativa directa entre el nuevo coste introducido y el coste del pedido anterior del mismo fabricante: `((nuevo - anterior) / anterior) * 100` con indicador cromático y de tendencia.

---

## 4. Arquitectura del Sistema y Flujo de Datos

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TRAMAHOGAR WORKSPACE                            │
├────────────────────────────────────────────────────────────────────────┤
│ Top Bar: Marca + Navegación (Pedidos, Proveedores, Comparador, Stock)  │
├─────────────────┬──────────────────────────────────────────────────────┤
│ Resumen Semanal │ Vista Activa                                         │
│ • Gasto semana  │ ┌──────────────────────────────────────────────────┐ │
│ • Pedidos hoy   │ │ [Nuevo Pedido] / [Histórico de Pedidos]          │ │
│ • Variación €   │ │ • Selector de Fabricante (Reig Martí, Bassols...)│ │
│ • Top Proveedor │ │ • Fecha y Nº Albarán                             │ │
│                 │ │ • Tabla dinámica de líneas de compra:            │ │
│                 │ │   [Artículo] [Medida Cama] [Uds] [Coste Unit €]  │ │
│                 │ │   -> Comparación en vivo con último coste        │ │
│                 │ └──────────────────────────────────────────────────┘ │
│                 │ ┌──────────────────────────────────────────────────┐ │
│                 │ │ [Comparador de Costes por Fabricante]            │ │
│                 │ │ • Filtro por medida (90, 105, 135, 150, 180 cm)  │ │
│                 │ │ • Comparativa de precio x proveedor y variación  │ │
│                 │ └──────────────────────────────────────────────────┘ │
└─────────────────┴──────────────────────────────────────────────────────┘
                                    │
                                    ▼
       ┌──────────────────────────────────────────────────────────┐
       │     Gestor de Estado Local (LocalStorage + Sync)        │
       │  • Colección de Proveedores (Fabricantes)                │
       │  • Catálogo Textil con Medidas y Categorías              │
       │  • Registro de Pedidos Semanales y Albaranes             │
       │  • Histórico y Registro de Costes Unitarios              │
       └──────────────────────────────────────────────────────────┘
```

### Modelo de Datos Principal
- **Fabricante / Proveedor**: `id`, `nombre`, `contacto`, `telefono`, `condicionesPago`, `tiempoEntregaDias`.
- **Artículo Textil**: `id`, `referencia`, `nombre`, `categoria` (Sábanas, Fundas Nórdicas, Colchas, Rellenos, etc.), `fabricanteId`, `composicion` (100% Algodón, Percal 200 Hilos, Microfibra, etc.), `medidasDisponibles` (90, 105, 135, 150, 160, 180, 200 cm).
- **Línea de Compra / Coste**: `id`, `pedidoId`, `articuloId`, `medidaCama`, `cantidad`, `costeUnitario`, `iva`, `fechaCompra`.
- **Pedido / Albarán Semanal**: `id`, `numeroAlbaran`, `fabricanteId`, `fecha`, `lineas`, `totalBase`, `totalIva`, `estado` (Recibido, En tránsito, Pagar).
