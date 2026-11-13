import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { BedSize, Manufacturer } from '../types';
import {
  normalizeText,
  parseBedSize,
  parseCost,
  parseCsvDate,
  parseQuantity,
  resolveManufacturerFromFilename,
} from './csvOrderImport';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface ParsedPdfLineItem {
  id: string;
  productName: string;
  bedSize: BedSize;
  quantity: number;
  unitCost: number;
  isFabricPiece?: boolean;
}

export interface ParsedPdfAlbaranResult {
  success: boolean;
  sourceType?: 'pdf' | 'image';
  isScannedImage?: boolean;
  usedOcr?: boolean;
  ocrError?: string;
  previewImageUrls?: string[];
  orderDate: string;
  matchedManufacturerId: string | null;
  suggestedManufacturerName: string;
  items: ParsedPdfLineItem[];
  rawText: string;
  error?: string;
}

interface PdfTextToken {
  str: string;
  x: number;
  y: number;
  width: number;
}

interface PdfVisualRow {
  y: number;
  tokens: PdfTextToken[];
  text: string;
}

const SPANISH_MONTHS: Record<string, string> = {
  enero: '01',
  febrero: '02',
  marzo: '03',
  abril: '04',
  mayo: '05',
  junio: '06',
  julio: '07',
  agosto: '08',
  septiembre: '09',
  setiembre: '09',
  octubre: '10',
  noviembre: '11',
  diciembre: '12',
};

function buildVisualRows(tokens: PdfTextToken[]): PdfVisualRow[] {
  if (tokens.length === 0) return [];

  // Sort top-to-bottom (higher y first in PDF coordinate space), then left-to-right
  const sorted = [...tokens].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 4) return b.y - a.y;
    return a.x - b.x;
  });

  const rows: PdfVisualRow[] = [];
  for (const token of sorted) {
    const existingRow = rows.find(r => Math.abs(r.y - token.y) <= 4.5);
    if (existingRow) {
      existingRow.tokens.push(token);
    } else {
      rows.push({ y: token.y, tokens: [token], text: '' });
    }
  }

  // Sort tokens inside each row by x ascending and group close adjacent tokens into cells
  for (const row of rows) {
    row.tokens.sort((a, b) => a.x - b.x);
    let text = '';
    for (let i = 0; i < row.tokens.length; i++) {
      const t = row.tokens[i];
      if (i > 0) {
        const prev = row.tokens[i - 1];
        const gap = t.x - (prev.x + prev.width);
        text += gap > 12 ? '   ' : ' ';
      }
      text += t.str;
    }
    row.text = text.trim();
  }

  return rows.filter(r => r.text.length > 0);
}

// Merge horizontally touching tokens (gap <= 8pt) into logical cells on a row
function groupRowIntoCells(tokens: PdfTextToken[]): Array<{ text: string; x: number; xEnd: number }> {
  if (tokens.length === 0) return [];
  const cells: Array<{ text: string; x: number; xEnd: number }> = [];

  for (const t of tokens) {
    const prev = cells[cells.length - 1];
    if (prev && t.x - prev.xEnd <= 9) {
      prev.text = `${prev.text} ${t.str}`.replace(/\s+/g, ' ').trim();
      prev.xEnd = Math.max(prev.xEnd, t.x + t.width);
    } else {
      cells.push({
        text: t.str.trim(),
        x: t.x,
        xEnd: t.x + t.width,
      });
    }
  }

  return cells;
}

function extractDateFromRows(rows: PdfVisualRow[]): string {
  const fullText = rows.map(r => r.text).join('\n');

  // 1. Labelled date (Fecha, Fecha pedido, Fecha albarán, Fecha emisión, etc.)
  const labelledNumeric = fullText.match(
    /(?:fecha(?:\s+(?:de\s+)?(?:pedido|albar[aá]n|factura|emisi[oó]n|documento))?)\s*[:.]?\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2})/i
  );
  if (labelledNumeric) {
    const parsed = parseCsvDate(labelledNumeric[1].replace(/\./g, '/'));
    if (parsed) return parsed;
  }

  // 2. Spanish textual date ("13 de noviembre de 2026")
  const textDate = fullText.match(
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(?:de\s+|del\s+)?(\d{4})/i
  );
  if (textDate) {
    const day = textDate[1].padStart(2, '0');
    const month = SPANISH_MONTHS[textDate[2].toLowerCase()];
    const year = textDate[3];
    if (month) return `${year}-${month}-${day}`;
  }

  // 3. Any numeric date anywhere in the upper half (first 25 rows)
  const topText = rows.slice(0, 25).map(r => r.text).join(' ');
  const anyDateMatch = topText.match(/\b(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2})\b/);
  if (anyDateMatch) {
    const parsed = parseCsvDate(anyDateMatch[1].replace(/\./g, '/'));
    if (parsed) return parsed;
  }

  return new Date().toISOString().split('T')[0];
}

function detectManufacturerFromPdf(
  fileName: string,
  rows: PdfVisualRow[],
  manufacturers: Manufacturer[]
): { matchedManufacturerId: string | null; suggestedManufacturerName: string } {
  // 1. Check filename first (user explicitly indicated manufacturer may be in filename)
  const fromFilename = resolveManufacturerFromFilename(fileName, manufacturers);
  if (fromFilename.matched) {
    return {
      matchedManufacturerId: fromFilename.matched.id,
      suggestedManufacturerName: fromFilename.matched.name,
    };
  }

  // 2. Check PDF header text (top 30 rows) against existing manufacturers (name, CIF, phone, email)
  const headerText = rows.slice(0, 30).map(r => r.text).join(' ');
  const normHeader = normalizeText(headerText);

  const sortedMfgs = [...manufacturers].sort((a, b) => b.name.length - a.name.length);
  for (const mfg of sortedMfgs) {
    const normName = normalizeText(mfg.name);
    if (normName && normHeader.includes(normName)) {
      return { matchedManufacturerId: mfg.id, suggestedManufacturerName: mfg.name };
    }
    if (mfg.cif && mfg.cif.trim().length >= 6) {
      const cleanCif = mfg.cif.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const cleanHeader = headerText.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (cleanHeader.includes(cleanCif)) {
        return { matchedManufacturerId: mfg.id, suggestedManufacturerName: mfg.name };
      }
    }
  }

  // 3. Check if filename suggests a real manufacturer name (not generic words like "albaran", "factura", "documento")
  const normSuggested = normalizeText(fromFilename.suggestedName);
  const genericNames = new Set(['albaran', 'factura', 'pedido', 'documento', 'scan', 'escaneo', 'pdf', 'fabricante importado']);
  if (normSuggested && !genericNames.has(normSuggested) && !/^\d+$/.test(normSuggested)) {
    return {
      matchedManufacturerId: null,
      suggestedManufacturerName: fromFilename.suggestedName,
    };
  }

  // 4. Try spotting a company name in the top 10 rows of PDF (e.g. containing S.L., S.A., Textil, Hogar)
  for (const row of rows.slice(0, 10)) {
    if (/\b(s\.?l\.?u?\.?|s\.?a\.?|textil|hogar|confecciones|industrias)\b/i.test(row.text) && row.text.length <= 60) {
      return {
        matchedManufacturerId: null,
        suggestedManufacturerName: row.text.replace(/\s{2,}.*$/, '').trim(),
      };
    }
  }

  return {
    matchedManufacturerId: null,
    suggestedManufacturerName: fromFilename.suggestedName,
  };
}

function isFooterRow(normText: string): boolean {
  return (
    normText.includes('base imponible') ||
    normText.includes('total factura') ||
    normText.includes('total albaran') ||
    normText.includes('total a pagar') ||
    normText.includes('total liquido') ||
    normText.includes('recargo de equivalencia') ||
    normText.includes('recargo equiv') ||
    normText.includes('importe total') ||
    normText.startsWith('total ') ||
    normText.includes('forma de pago') ||
    normText.includes('vencimiento')
  );
}

function isNoiseRow(normText: string): boolean {
  return (
    isFooterRow(normText) ||
    normText.includes('cif ') ||
    normText.includes('nif ') ||
    normText.includes('iban') ||
    normText.includes('pagina ') ||
    normText.includes('registro mercantil') ||
    normText.includes('telefono') ||
    normText.includes('correo') ||
    normText.includes('domicilio') ||
    normText.includes('cliente:')
  );
}

function isNumericToken(str: string): boolean {
  const cleaned = str.replace(/[€%()\s]/g, '').trim();
  if (!cleaned) return false;
  return /^-?\d{1,3}([.,]\d{3})*([.,]\d+)?$|^-?\d+([.,]\d+)?$/.test(cleaned);
}

function parseTableByHeaderCoordinates(rows: PdfVisualRow[]): ParsedPdfLineItem[] {
  // Find a header row containing Article + (Qty or Price)
  let headerRowIdx = -1;
  let colMap: {
    articuloX: number | null;
    medidaX: number | null;
    cantidadX: number | null;
    costeX: number | null;
    importeX: number | null;
  } = {
    articuloX: null,
    medidaX: null,
    cantidadX: null,
    costeX: null,
    importeX: null,
  };

  for (let i = 0; i < rows.length; i++) {
    const cells = groupRowIntoCells(rows[i].tokens);
    let artX: number | null = null;
    let medX: number | null = null;
    let cantX: number | null = null;
    let costX: number | null = null;
    let impX: number | null = null;

    for (const cell of cells) {
      const n = normalizeText(cell.text.replace(/[€()%]/g, ''));
      const centerX = (cell.x + cell.xEnd) / 2;

      if (
        artX === null &&
        (n.includes('articulo') ||
          n.includes('descripcion') ||
          n.includes('concepto') ||
          n.includes('producto') ||
          n.includes('prenda') ||
          n.includes('detalle') ||
          n.includes('mercancia')) &&
        !n.includes('codigo') &&
        !n.includes('ref')
      ) {
        artX = centerX;
      } else if (
        medX === null &&
        (n.includes('medida') || n.includes('talla') || n.includes('tamano') || n === 'cama' || n.includes('size'))
      ) {
        medX = centerX;
      } else if (
        cantX === null &&
        (n.includes('cantidad') || n === 'cant' || n.includes('uds') || n.includes('unidades') || n === 'unid' || n === 'qty')
      ) {
        cantX = centerX;
      } else if (
        costX === null &&
        (n.includes('precio coste') ||
          n.includes('coste unitario') ||
          n === 'coste' ||
          n.includes('precio unit') ||
          n === 'precio' ||
          n === 'p u' ||
          n === 'pu' ||
          n.includes('tarifa')) &&
        !n.includes('total') &&
        !n.includes('importe')
      ) {
        costX = centerX;
      } else if (impX === null && (n.includes('importe') || n.includes('total') || n.includes('subtotal'))) {
        impX = centerX;
      }
    }

    if (artX !== null && (cantX !== null || costX !== null)) {
      headerRowIdx = i;
      colMap = { articuloX: artX, medidaX: medX, cantidadX: cantX, costeX: costX, importeX: impX };
      break;
    }
  }

  if (headerRowIdx === -1) return [];

  const items: ParsedPdfLineItem[] = [];
  const activeCols = (
    [
      { key: 'articulo', x: colMap.articuloX },
      { key: 'medida', x: colMap.medidaX },
      { key: 'cantidad', x: colMap.cantidadX },
      { key: 'coste', x: colMap.costeX },
      { key: 'importe', x: colMap.importeX },
    ] as Array<{ key: string; x: number | null }>
  ).filter((c): c is { key: string; x: number } => c.x !== null);

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const normRow = normalizeText(row.text);
    if (isFooterRow(normRow)) break;
    if (isNoiseRow(normRow)) continue;

    const cells = groupRowIntoCells(row.tokens);
    const buckets: Record<string, string[]> = {
      articulo: [],
      medida: [],
      cantidad: [],
      coste: [],
      importe: [],
    };

    for (const cell of cells) {
      const centerX = (cell.x + cell.xEnd) / 2;
      // Ignore cells way to the left of the article column (usually SKU/Ref column)
      if (colMap.articuloX !== null && centerX < colMap.articuloX - 55 && cell.xEnd < colMap.articuloX - 25) {
        continue;
      }

      let bestCol = activeCols[0].key;
      let bestDist = Infinity;
      for (const col of activeCols) {
        const dist = Math.abs(centerX - col.x);
        if (dist < bestDist) {
          bestDist = dist;
          bestCol = col.key;
        }
      }
      buckets[bestCol].push(cell.text);
    }

    const productName = buckets.articulo.join(' ').trim();
    const qtyText = buckets.cantidad.join(' ').trim();
    const costText = buckets.coste.join(' ').trim();
    const sizeText = buckets.medida.join(' ').trim();
    const totalText = buckets.importe.join(' ').trim();

    if (!productName || isNumericToken(productName)) continue;

    const quantity = qtyText ? parseQuantity(qtyText) : 1;
    let unitCost = costText ? parseCost(costText) : NaN;

    if (isNaN(unitCost) && totalText && quantity > 0) {
      const lineTot = parseCost(totalText);
      if (!isNaN(lineTot)) {
        unitCost = Number((lineTot / quantity).toFixed(2));
      }
    }

    if (quantity <= 0 || isNaN(unitCost) || unitCost <= 0) continue;

    const bedSize: BedSize = sizeText
      ? parseBedSize(sizeText)
      : parseBedSize(productName);
    const normProd = normalizeText(productName);
    const isFabricPiece =
      normProd.includes('pieza') ||
      normProd.includes('tela') ||
      normProd.includes('tejido') ||
      normProd.includes('rollo');

    items.push({
      id: `pdf-item-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      productName,
      bedSize,
      quantity,
      unitCost,
      isFabricPiece,
    });
  }

  return items;
}

function parseLinesHeuristically(rows: PdfVisualRow[]): ParsedPdfLineItem[] {
  const items: ParsedPdfLineItem[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const normRow = normalizeText(row.text);
    if (isFooterRow(normRow)) break;
    if (isNoiseRow(normRow)) continue;

    const cells = groupRowIntoCells(row.tokens);
    if (cells.length < 3) continue;

    // Collect numeric cells from the right side of the row
    const numericIndices: number[] = [];
    for (let c = cells.length - 1; c >= 0; c--) {
      if (isNumericToken(cells[c].text)) {
        numericIndices.unshift(c);
      } else if (numericIndices.length >= 2) {
        break;
      }
    }

    if (numericIndices.length < 2) continue;

    const firstNumIdx = numericIndices[0];
    const numValues = numericIndices.map(idx => parseCost(cells[idx].text));
    if (numValues.some(v => isNaN(v))) continue;

    // Determine quantity and unitCost using arithmetic check when >= 3 numbers (qty * unitCost ~= total)
    let quantity = 0;
    let unitCost = NaN;

    if (numValues.length >= 3) {
      const qCandidate = numValues[0];
      const costCandidate = numValues[1];
      const totalCandidate = numValues[numValues.length - 1];

      if (qCandidate > 0 && Math.abs(qCandidate * costCandidate - totalCandidate) <= Math.max(0.5, totalCandidate * 0.15)) {
        quantity = Math.round(qCandidate);
        unitCost = costCandidate;
      } else {
        quantity = Math.round(qCandidate);
        unitCost = costCandidate;
      }
    } else {
      // 2 numbers: [qty, unitCost]
      quantity = Math.round(numValues[0]);
      unitCost = numValues[1];
    }

    if (quantity <= 0 || isNaN(unitCost) || unitCost <= 0) continue;

    // Text cells before first numeric column
    let textCells = cells.slice(0, firstNumIdx).map(c => c.text.trim()).filter(Boolean);
    if (textCells.length === 0) continue;

    // Skip leading pure SKU/reference code if followed by description (e.g., "BB-102" or "00124")
    if (
      textCells.length > 1 &&
      /^[A-Z0-9\-\/\.]{2,15}$/i.test(textCells[0]) &&
      /\d/.test(textCells[0])
    ) {
      textCells = textCells.slice(1);
    }

    // Check if last text cell before numbers is a standalone bed size like "150" or "Cama 150"
    let bedSize: BedSize = 'Especial';
    const lastText = textCells[textCells.length - 1];
    if (textCells.length > 1 && /^(?:cama\s*)?(90|105|135|150|160|180|200)(?:\s*cm)?$/i.test(lastText)) {
      bedSize = parseBedSize(lastText);
      textCells = textCells.slice(0, -1);
    }

    const productName = textCells.join(' ').trim();
    if (!productName || productName.length < 3) continue;

    if (bedSize === 'Especial') {
      bedSize = parseBedSize(productName);
    }

    const normProd = normalizeText(productName);
    const isFabricPiece =
      normProd.includes('pieza') ||
      normProd.includes('tela') ||
      normProd.includes('tejido') ||
      normProd.includes('rollo');

    items.push({
      id: `pdf-item-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      productName,
      bedSize,
      quantity,
      unitCost,
      isFabricPiece,
    });
  }

  return items;
}

export async function parsePdfAlbaranFile(
  file: File,
  manufacturers: Manufacturer[]
): Promise<ParsedPdfAlbaranResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const allRows: PdfVisualRow[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const tokens: PdfTextToken[] = [];

      for (const item of textContent.items) {
        if ('str' in item && item.str.trim().length > 0) {
          tokens.push({
            str: item.str,
            x: item.transform[4] ?? 0,
            y: item.transform[5] ?? 0,
            width: item.width ?? 0,
          });
        }
      }

      const pageRows = buildVisualRows(tokens);
      allRows.push(...pageRows);
    }

    const rawText = allRows.map(r => r.text).join('\n');

    const previewImages = await renderPdfPagesToPng(pdf, 3);

    if (allRows.length === 0 || rawText.trim().length < 10) {
      const mfgInfo = detectManufacturerFromPdf(file.name, [], manufacturers);
      const ocrResult = await runHandwritingOcrOnImages(
        previewImages.map(p => ({ mimeType: p.mimeType, data: p.base64 })),
        file.name,
        manufacturers,
        previewImages.map(p => p.dataUrl),
        'pdf'
      );
      if (ocrResult.success && ocrResult.items.length > 0) {
        return ocrResult;
      }
      return {
        success: true,
        sourceType: 'pdf',
        isScannedImage: true,
        usedOcr: ocrResult.usedOcr,
        ocrError: ocrResult.ocrError,
        previewImageUrls: previewImages.map(p => p.dataUrl),
        orderDate: ocrResult.orderDate || new Date().toISOString().split('T')[0],
        matchedManufacturerId: ocrResult.matchedManufacturerId || mfgInfo.matchedManufacturerId,
        suggestedManufacturerName: ocrResult.suggestedManufacturerName || mfgInfo.suggestedManufacturerName,
        items: ocrResult.items || [],
        rawText: ocrResult.rawText || '',
      };
    }

    const orderDate = extractDateFromRows(allRows);
    const mfgInfo = detectManufacturerFromPdf(file.name, allRows, manufacturers);

    let items = parseTableByHeaderCoordinates(allRows);
    if (items.length === 0) {
      items = parseLinesHeuristically(allRows);
    }

    if (items.length === 0 && previewImages.length > 0) {
      const ocrResult = await runHandwritingOcrOnImages(
        previewImages.map(p => ({ mimeType: p.mimeType, data: p.base64 })),
        file.name,
        manufacturers,
        previewImages.map(p => p.dataUrl),
        'pdf'
      );
      if (ocrResult.success && ocrResult.items.length > 0) {
        return {
          ...ocrResult,
          orderDate: ocrResult.orderDate || orderDate,
          matchedManufacturerId: ocrResult.matchedManufacturerId || mfgInfo.matchedManufacturerId,
          suggestedManufacturerName: ocrResult.suggestedManufacturerName || mfgInfo.suggestedManufacturerName,
          rawText: ocrResult.rawText || rawText,
        };
      }
      return {
        success: true,
        sourceType: 'pdf',
        isScannedImage: false,
        usedOcr: ocrResult.usedOcr,
        ocrError: ocrResult.ocrError,
        previewImageUrls: previewImages.map(p => p.dataUrl),
        orderDate,
        matchedManufacturerId: mfgInfo.matchedManufacturerId,
        suggestedManufacturerName: mfgInfo.suggestedManufacturerName,
        items: [],
        rawText: ocrResult.rawText || rawText,
      };
    }

    return {
      success: true,
      sourceType: 'pdf',
      isScannedImage: false,
      previewImageUrls: previewImages.map(p => p.dataUrl),
      orderDate,
      matchedManufacturerId: mfgInfo.matchedManufacturerId,
      suggestedManufacturerName: mfgInfo.suggestedManufacturerName,
      items,
      rawText,
    };
  } catch (err: any) {
    return {
      success: false,
      orderDate: new Date().toISOString().split('T')[0],
      matchedManufacturerId: null,
      suggestedManufacturerName: '',
      items: [],
      rawText: '',
      error: `No se pudo leer el PDF: ${err?.message || 'archivo dañado o protegido'}`,
    };
  }
}

interface RenderedPageImage {
  mimeType: string;
  base64: string;
  dataUrl: string;
}

async function renderPdfPagesToPng(pdf: pdfjsLib.PDFDocumentProxy, maxPages = 3): Promise<RenderedPageImage[]> {
  const results: RenderedPageImage[] = [];
  const pageLimit = Math.min(pdf.numPages, maxPages);

  for (let pageNum = 1; pageNum <= pageLimit; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.8 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1] || '';
      if (base64) {
        results.push({ mimeType: 'image/png', base64, dataUrl });
      }
    } catch {
      // Skip page if canvas rendering fails
    }
  }

  return results;
}

function readImageFileAsDataUrl(file: File): Promise<{ mimeType: string; base64: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const commaIdx = dataUrl.indexOf(',');
      const header = commaIdx > -1 ? dataUrl.slice(0, commaIdx) : '';
      const mimeMatch = header.match(/data:([^;]+);base64/);
      const mimeType = mimeMatch?.[1] || file.type || 'image/jpeg';
      const base64 = commaIdx > -1 ? dataUrl.slice(commaIdx + 1) : '';
      resolve({ mimeType, base64, dataUrl });
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'));
    reader.readAsDataURL(file);
  });
}

function matchManufacturerName(
  detectedName: string,
  fileName: string,
  manufacturers: Manufacturer[]
): { matchedManufacturerId: string | null; suggestedManufacturerName: string } {
  if (detectedName.trim()) {
    const normDetected = normalizeText(detectedName);
    const sorted = [...manufacturers].sort((a, b) => b.name.length - a.name.length);
    for (const mfg of sorted) {
      const normMfg = normalizeText(mfg.name);
      if (normMfg && (normDetected.includes(normMfg) || normMfg.includes(normDetected))) {
        return { matchedManufacturerId: mfg.id, suggestedManufacturerName: mfg.name };
      }
    }
  }

  const fromFile = resolveManufacturerFromFilename(fileName, manufacturers);
  if (fromFile.matched) {
    return { matchedManufacturerId: fromFile.matched.id, suggestedManufacturerName: fromFile.matched.name };
  }

  return {
    matchedManufacturerId: null,
    suggestedManufacturerName: detectedName.trim() || fromFile.suggestedName,
  };
}

export async function runHandwritingOcrOnDataUrls(
  dataUrls: string[],
  fileName: string,
  manufacturers: Manufacturer[],
  sourceType: 'pdf' | 'image' = 'image'
): Promise<ParsedPdfAlbaranResult> {
  const images = dataUrls
    .map(url => {
      const commaIdx = url.indexOf(',');
      const header = commaIdx > -1 ? url.slice(0, commaIdx) : '';
      const mimeMatch = header.match(/data:([^;]+);base64/);
      return {
        mimeType: mimeMatch?.[1] || 'image/png',
        data: commaIdx > -1 ? url.slice(commaIdx + 1) : '',
      };
    })
    .filter(img => img.data.length > 0);

  return runHandwritingOcrOnImages(images, fileName, manufacturers, dataUrls, sourceType);
}

async function runHandwritingOcrOnImages(
  images: Array<{ mimeType: string; data: string }>,
  fileName: string,
  manufacturers: Manufacturer[],
  previewImageUrls: string[],
  sourceType: 'pdf' | 'image'
): Promise<ParsedPdfAlbaranResult> {
  const fallbackMfg = resolveManufacturerFromFilename(fileName, manufacturers);
  const todayIso = new Date().toISOString().split('T')[0];

  try {
    const resp = await fetch('/api/albaran/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images,
        fileName,
        knownManufacturers: manufacturers.map(m => m.name),
      }),
    });

    const payload = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return {
        success: true,
        sourceType,
        isScannedImage: true,
        usedOcr: false,
        ocrError: payload?.error || 'No se pudo conectar con el servicio de reconocimiento de escritura.',
        previewImageUrls,
        orderDate: todayIso,
        matchedManufacturerId: fallbackMfg.matched?.id || null,
        suggestedManufacturerName: fallbackMfg.matched?.name || fallbackMfg.suggestedName,
        items: [],
        rawText: '',
      };
    }

    const parsedDate = payload.orderDate ? parseCsvDate(String(payload.orderDate)) || String(payload.orderDate) : todayIso;
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(parsedDate) ? parsedDate : todayIso;
    const mfgMatch = matchManufacturerName(String(payload.manufacturerName || ''), fileName, manufacturers);

    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const items: ParsedPdfLineItem[] = rawItems
      .map((item: any, idx: number): ParsedPdfLineItem | null => {
        const productName = String(item?.productName || '').trim();
        if (!productName) return null;

        const isFabricPiece = Boolean(item?.isFabricPiece);
        const rawQty = Number(item?.quantity);
        const quantity = isNaN(rawQty) || rawQty < 0 ? 0 : Math.round(rawQty);
        const rawCost = Number(item?.unitCost);
        const unitCost = isNaN(rawCost) || rawCost < 0 ? 0 : Number(rawCost.toFixed(2));
        const bedSize = parseBedSize(String(item?.bedSize || 'Especial'));

        return {
          id: `ocr-item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          productName,
          bedSize,
          quantity: isFabricPiece && quantity <= 0 ? 0 : quantity || (isFabricPiece ? 0 : 1),
          unitCost,
          isFabricPiece,
        };
      })
      .filter((x: ParsedPdfLineItem | null): x is ParsedPdfLineItem => x !== null);

    return {
      success: true,
      sourceType,
      isScannedImage: true,
      usedOcr: true,
      previewImageUrls,
      orderDate: validDate,
      matchedManufacturerId: mfgMatch.matchedManufacturerId,
      suggestedManufacturerName: mfgMatch.suggestedManufacturerName,
      items,
      rawText: String(payload.rawText || ''),
    };
  } catch (err: any) {
    return {
      success: true,
      sourceType,
      isScannedImage: true,
      usedOcr: false,
      ocrError: `No se pudo reconocer la escritura automáticamente (${err?.message || 'sin conexión al servidor'}). Puedes introducir las líneas manualmente viendo la imagen.`,
      previewImageUrls,
      orderDate: todayIso,
      matchedManufacturerId: fallbackMfg.matched?.id || null,
      suggestedManufacturerName: fallbackMfg.matched?.name || fallbackMfg.suggestedName,
      items: [],
      rawText: '',
    };
  }
}

export async function parseAlbaranDocumentFile(
  file: File,
  manufacturers: Manufacturer[]
): Promise<ParsedPdfAlbaranResult> {
  const lower = file.name.toLowerCase();
  const isImage =
    file.type.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|heic|bmp)$/i.test(lower);

  if (isImage) {
    try {
      const img = await readImageFileAsDataUrl(file);
      return await runHandwritingOcrOnImages(
        [{ mimeType: img.mimeType, data: img.base64 }],
        file.name,
        manufacturers,
        [img.dataUrl],
        'image'
      );
    } catch (err: any) {
      return {
        success: false,
        sourceType: 'image',
        orderDate: new Date().toISOString().split('T')[0],
        matchedManufacturerId: null,
        suggestedManufacturerName: '',
        items: [],
        rawText: '',
        error: err?.message || 'No se pudo cargar la imagen.',
      };
    }
  }

  return parsePdfAlbaranFile(file, manufacturers);
}

