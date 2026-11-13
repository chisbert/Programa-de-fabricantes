import { BedSize, CategoryInfo, Manufacturer, TextileCategory } from '../types';

export interface ParsedCsvAlbaranRow {
  orderDate: string;
  productName: string;
  bedSize: BedSize;
  quantity: number;
  unitCost: number;
  isFabricPiece?: boolean;
}

export function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveManufacturerFromFilename(
  fileName: string,
  manufacturers: Manufacturer[]
): { matched: Manufacturer | null; suggestedName: string } {
  const withoutExt = fileName.replace(/\.(csv|txt|json|pdf|jpg|jpeg|png|webp|heic|bmp)$/i, '');
  const normFile = normalizeText(withoutExt);

  if (normFile) {
    // 1. Exact or substring match against existing manufacturers (longest name first)
    const sortedMfgs = [...manufacturers].sort((a, b) => b.name.length - a.name.length);
    for (const mfg of sortedMfgs) {
      const normMfg = normalizeText(mfg.name);
      if (normMfg && (normFile.includes(normMfg) || (normFile.length >= 4 && normMfg.includes(normFile)))) {
        return { matched: mfg, suggestedName: mfg.name };
      }
      if (mfg.code) {
        const normCode = normalizeText(mfg.code);
        if (normCode.length >= 2) {
          const codeRegex = new RegExp(`\\b${normCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
          if (codeRegex.test(normFile)) {
            return { matched: mfg, suggestedName: mfg.name };
          }
        }
      }
    }

    // 2. Token match: all significant words (>= 3 chars) of manufacturer name present in filename
    for (const mfg of sortedMfgs) {
      const tokens = normalizeText(mfg.name)
        .split(' ')
        .filter(t => t.length >= 3);
      if (tokens.length > 0 && tokens.every(t => normFile.includes(t))) {
        return { matched: mfg, suggestedName: mfg.name };
      }
    }
  }

  // 3. Clean suggested name for new manufacturer
  let cleaned = withoutExt
    .replace(/[_]+/g, ' ')
    .replace(/\b\d{4}[-_/ ]\d{1,2}[-_/ ]\d{1,2}\b/g, ' ')
    .replace(/\b\d{1,2}[-_/ ]\d{1,2}[-_/ ]\d{2,4}\b/g, ' ')
    .replace(/\b\d{6,8}\b/g, ' ')
    .replace(/\b(albaran|albaranes|pedido|pedidos|factura|facturas|compra|compras|csv|pdf|jpg|jpeg|png|hoja|foto|scan|escaneo)\b/gi, ' ')
    .replace(/\b[SW]\d{1,2}\b/gi, ' ')
    .replace(/[-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    cleaned = withoutExt.replace(/[_\-]+/g, ' ').trim() || 'Fabricante Importado';
  }

  // Title-case if all lowercase or all uppercase
  if (cleaned === cleaned.toLowerCase() || cleaned === cleaned.toUpperCase()) {
    cleaned = cleaned
      .split(' ')
      .map(w => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
      .join(' ');
  }

  return { matched: null, suggestedName: cleaned };
}

function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 10);
  const candidates = [';', '\t', ','];
  let bestDelimiter = ';';
  let bestScore = -1;

  for (const delim of candidates) {
    let counts: number[] = [];
    for (const line of sample) {
      let inQuotes = false;
      let c = 0;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') inQuotes = !inQuotes;
        else if (!inQuotes && ch === delim) c++;
      }
      counts.push(c);
    }
    const nonZero = counts.filter(x => x > 0);
    if (nonZero.length === 0) continue;
    const avg = nonZero.reduce((a, b) => a + b, 0) / counts.length;
    const consistent = counts.every(x => x === counts[0]);
    const score = avg + (consistent ? 5 : 0) + (delim === ';' ? 0.5 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delim;
    }
  }

  return bestDelimiter;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseCsvDate(raw: string): string | null {
  const trimmed = raw.replace(/['"]/g, '').trim();
  if (!trimmed) return null;

  // YYYY-MM-DD or YYYY/MM/DD
  let m = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  m = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM/YY or DD-MM-YY
  m = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `20${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return null;
}

export function parseBedSize(raw: string): BedSize {
  const s = raw.trim();
  const match = s.match(/(?:^|\D)(90|105|135|150|160|180|200)(?=\D|$)/);
  if (match) {
    return match[1] as BedSize;
  }
  return 'Especial';
}

export function parseQuantity(raw: string): number {
  const cleaned = raw
    .replace(/[^\d.,\-]/g, '')
    .replace(',', '.')
    .trim();
  const num = parseFloat(cleaned);
  if (isNaN(num) || num <= 0) return 0;
  return Math.round(num);
}

export function parseCost(raw: string): number {
  let cleaned = raw.replace(/[€\s]/g, '').replace(/[^\d.,\-]/g, '').trim();
  if (!cleaned) return NaN;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      // European: 1.234,56
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US: 1,234.56
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    cleaned = cleaned.replace(',', '.');
  }

  const num = parseFloat(cleaned);
  return isNaN(num) || num < 0 ? NaN : num;
}

export function inferCategoryFromName(name: string, categories: CategoryInfo[]): TextileCategory {
  const norm = normalizeText(name);
  const exists = (id: string) => categories.some(c => c.id === id);

  if (norm.includes('funda nordica') || norm.includes('duvet')) {
    if (exists('fundas_nordicas')) return 'fundas_nordicas';
  }
  if (norm.includes('relleno') || norm.includes('plumon')) {
    if (exists('rellenos_nordicos')) return 'rellenos_nordicos';
  }
  if (norm.includes('colcha') || norm.includes('edredon') || norm.includes('bouti') || norm.includes('conforter')) {
    if (exists('colchas_edredones')) return 'colchas_edredones';
  }
  if (norm.includes('almohada') || norm.includes('cuadrante')) {
    if (exists('almohadas_fundas')) return 'almohadas_fundas';
  }
  if (norm.includes('protector') || norm.includes('cubrecolchon') || norm.includes('impermeable')) {
    if (exists('protectores_cubrecolchones')) return 'protectores_cubrecolchones';
  }
  if (norm.includes('toalla') || norm.includes('albornoz') || norm.includes('bano')) {
    if (exists('bano_toallas')) return 'bano_toallas';
  }
  if (norm.includes('manta') || norm.includes('plaid')) {
    if (exists('mantas_plaids')) return 'mantas_plaids';
  }
  if (
    norm.includes('pieza') ||
    norm.includes('tela') ||
    norm.includes('tejido') ||
    norm.includes('rollo') ||
    norm.includes('retal') ||
    norm.includes('loneta') ||
    norm.includes('popelin') ||
    norm.includes('batista') ||
    norm.includes('tergal') ||
    norm.includes('visillo') ||
    norm.includes('lino') ||
    norm.includes('metro')
  ) {
    if (exists('piezas_tela')) return 'piezas_tela';
  }
  if (norm.includes('sabana') || norm.includes('bajera') || norm.includes('encimera')) {
    if (exists('sabanas')) return 'sabanas';
  }

  return categories[0]?.id || 'sabanas';
}

export function parseCsvAlbaran(csvContent: string): {
  success: boolean;
  rows: ParsedCsvAlbaranRow[];
  error?: string;
} {
  const cleanContent = csvContent.replace(/^\uFEFF/, '');
  const rawLines = cleanContent
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (rawLines.length === 0) {
    return { success: false, rows: [], error: 'El archivo CSV está vacío.' };
  }

  const delimiter = detectDelimiter(rawLines);
  const parsedLines = rawLines.map(line => splitCsvLine(line, delimiter));

  // Detect header row by matching known Spanish/English header names
  const headerCells = parsedLines[0].map(c => normalizeText(c.replace(/[€()%]/g, '')));

  const findHeaderIndex = (patterns: string[], excludePatterns: string[] = []): number => {
    // 1. Exact match priority
    for (const pat of patterns) {
      const idx = headerCells.findIndex(
        h => h === pat && !excludePatterns.some(ex => h.includes(ex))
      );
      if (idx !== -1) return idx;
    }
    // 2. Partial match priority
    for (const pat of patterns) {
      const idx = headerCells.findIndex(
        h => h.includes(pat) && !excludePatterns.some(ex => h.includes(ex))
      );
      if (idx !== -1) return idx;
    }
    return -1;
  };

  let fechaIdx = findHeaderIndex(['fecha pedido', 'fecha albaran', 'fecha', 'date', 'dia', 'f pedido']);
  let articuloIdx = findHeaderIndex(
    ['articulo', 'prenda / modelo', 'prenda', 'producto', 'modelo', 'nombre', 'descripcion', 'concepto', 'item'],
    ['referencia', 'codigo', 'sku', 'categoria']
  );
  let medidaIdx = findHeaderIndex(['medida cama', 'medida', 'cama', 'talla', 'tamano', 'size', 'dimension']);
  let cantidadIdx = findHeaderIndex(['cantidad pedida', 'uds compradas', 'cantidad', 'unidades', 'uds', 'cant', 'qty', 'ud']);
  let costeIdx = findHeaderIndex(
    ['precio coste', 'coste unitario neto', 'coste unitario', 'coste ud', 'coste', 'precio unitario', 'precio', 'importe unitario', 'pu'],
    ['total', 'subtotal', 'r e', 're 26', 'iva', 'con r']
  );

  const hasHeader =
    articuloIdx !== -1 ||
    (fechaIdx !== -1 && (cantidadIdx !== -1 || costeIdx !== -1));

  let startRow = 1;
  if (!hasHeader) {
    startRow = 0;
    const colCount = parsedLines[0].length;
    if (colCount >= 5) {
      fechaIdx = 0;
      articuloIdx = 1;
      medidaIdx = 2;
      cantidadIdx = 3;
      costeIdx = 4;
    } else if (colCount === 4) {
      fechaIdx = -1;
      articuloIdx = 0;
      medidaIdx = 1;
      cantidadIdx = 2;
      costeIdx = 3;
    } else {
      return {
        success: false,
        rows: [],
        error: 'No se reconocieron las columnas del CSV. Asegúrate de incluir: Fecha, Artículo, Medida, Cantidad y Coste.',
      };
    }
  } else {
    if (articuloIdx === -1 || cantidadIdx === -1 || costeIdx === -1) {
      return {
        success: false,
        rows: [],
        error: 'Faltan columnas obligatorias en el CSV (Artículo, Cantidad o Coste).',
      };
    }
  }

  const todayIso = new Date().toISOString().split('T')[0];
  let lastValidDate = todayIso;
  const rows: ParsedCsvAlbaranRow[] = [];

  for (let i = startRow; i < parsedLines.length; i++) {
    const cells = parsedLines[i];
    if (cells.every(c => !c.trim())) continue;

    const productName = (cells[articuloIdx] || '').trim();
    if (!productName) continue;

    let rowDate = lastValidDate;
    if (fechaIdx !== -1 && cells[fechaIdx]) {
      const parsedDate = parseCsvDate(cells[fechaIdx]);
      if (parsedDate) {
        rowDate = parsedDate;
        lastValidDate = parsedDate;
      }
    }

    const bedSize: BedSize = medidaIdx !== -1 && cells[medidaIdx]
      ? parseBedSize(cells[medidaIdx])
      : 'Especial';

    const rawQtyCell = (cells[cantidadIdx] || '').trim();
    const normQty = normalizeText(rawQtyCell);
    const normProd = normalizeText(productName);
    const looksLikeFabricText =
      normProd.includes('pieza') ||
      normProd.includes('tela') ||
      normProd.includes('tejido') ||
      normProd.includes('rollo') ||
      normProd.includes('loneta') ||
      normProd.includes('visillo');
    const qtyExplicitlyVariable =
      !rawQtyCell ||
      normQty === 'pieza' ||
      normQty === 'piezas' ||
      normQty === 'variable' ||
      normQty === 'var' ||
      normQty === 's/c' ||
      rawQtyCell === '-';

    const quantity = parseQuantity(rawQtyCell);
    const isFabricPiece = looksLikeFabricText || (qtyExplicitlyVariable && quantity === 0);
    const unitCost = parseCost(cells[costeIdx] || '');

    if ((!isFabricPiece && quantity <= 0) || isNaN(unitCost)) {
      continue;
    }

    rows.push({
      orderDate: rowDate,
      productName,
      bedSize,
      quantity,
      unitCost,
      isFabricPiece,
    });
  }

  if (rows.length === 0) {
    return {
      success: false,
      rows: [],
      error: 'No se encontraron líneas válidas con artículo, cantidad y coste en el archivo CSV.',
    };
  }

  return { success: true, rows };
}
