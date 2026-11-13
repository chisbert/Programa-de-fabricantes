import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Server-side OCR & handwriting recognition endpoint for delivery notes / fabric sheets
  app.post('/api/albaran/ocr', async (req, res) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        return res.status(500).json({
          error:
            'No hay una clave GEMINI_API_KEY configurada en Settings > Secrets. Puedes añadir los datos manualmente en la tabla.',
        });
      }

      const { images, fileName, knownManufacturers } = req.body as {
        images?: Array<{ mimeType: string; data: string }>;
        fileName?: string;
        knownManufacturers?: string[];
      };

      if (!Array.isArray(images) || images.length === 0) {
        return res.status(400).json({
          error: 'No se recibió ninguna imagen del albarán u hoja para analizar.',
        });
      }

      const mfgListText =
        Array.isArray(knownManufacturers) && knownManufacturers.length > 0
          ? knownManufacturers.join(', ')
          : 'Sin lista previa';

      const promptText = `Analiza cuidadosamente esta hoja de pedido o albarán (puede estar escrito a mano, impreso o mixto) de una tienda española de ropa de hogar y telas llamada TramaHogar.

Nombre del archivo subido: "${fileName || 'desconocido'}"
Fabricantes ya conocidos en la tienda: ${mfgListText}

Necesito que reconozcas la escritura (incluida caligrafía manual, abreviaturas comerciales en español, tachaduras corregidas o anotaciones al margen) y extraigas ÚNICAMENTE estos datos:
1. orderDate: Fecha del pedido/albarán en formato YYYY-MM-DD (si no aparece, devuelve "").
2. manufacturerName: Nombre del fabricante/proveedor (si aparece en el encabezado, sello, letra escrita o coincide con el nombre del archivo o la lista de fabricantes conocidos; si no se distingue, devuelve "").
3. rawText: Transcripción fiel y legible línea por línea de todo lo que está escrito en la hoja para que el usuario pueda comprobarlo.
4. items: Lista de artículos/prendas/piezas detectadas. Por cada línea extrae:
   - productName: Nombre del artículo o tela SIN códigos SKU ni referencias numéricas delante. Incluye ancho o color si es relevante para telas (ej. "Loneta estampada flores 280 cm").
   - bedSize: Medida de cama si corresponde a ropa de cama ("90", "105", "135", "150", "160", "180", "200") o "Especial" (usa "Especial" para piezas de tela, anchos especiales, manteles o medidas no estándar, salvo que indique claramente cama 90/105/135/150/160/180/200).
   - isFabricPiece: true si el artículo es una PIEZA DE TELA / ROLLO / TEJIDO POR METROS (por ejemplo menciona "pieza", "pza", "tela", "tejido", "rollo", "loneta", "popelín", "batista", "visillo", "tergal", "metros variables", o si no trae cantidad fija porque cada pieza trae metros distintos); false si son unidades normales (juegos de sábanas, colchas, almohadas, etc.).
   - quantity: Cantidad numérica entera de unidades si se indica claramente. Si isFabricPiece es true y NO hay cantidad fija (o solo pone "pieza" / "variable" / vacío), pon 0.
   - unitCost: Precio de coste unitario (o precio por metro/pieza) sin IVA en euros (número decimal, ej. 14.5). Si no aparece o es ilegible, pon 0.`;

      const imageParts = images.slice(0, 4).map(img => ({
        inlineData: {
          mimeType: img.mimeType || 'image/png',
          data: img.data,
        },
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [...imageParts, { text: promptText }],
        },
        config: {
          systemInstruction:
            'Eres un asistente especializado en transcribir albaranes españoles escritos a mano y notas de compra de textiles de hogar y piezas de tela. Devuelve siempre JSON válido siguiendo exactamente el esquema solicitado.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              orderDate: {
                type: Type.STRING,
                description: 'Fecha en formato YYYY-MM-DD o cadena vacía si no aparece.',
              },
              manufacturerName: {
                type: Type.STRING,
                description: 'Nombre del fabricante o cadena vacía si no aparece.',
              },
              rawText: {
                type: Type.STRING,
                description: 'Transcripción literal del texto escrito a mano o impreso.',
              },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    productName: { type: Type.STRING },
                    bedSize: { type: Type.STRING },
                    isFabricPiece: { type: Type.BOOLEAN },
                    quantity: { type: Type.NUMBER },
                    unitCost: { type: Type.NUMBER },
                  },
                },
              },
            },
          },
        },
      });

      const jsonStr = (response.text ?? '{}').trim();
      const parsed = JSON.parse(jsonStr);
      return res.json(parsed);
    } catch (err: any) {
      console.error('Error en /api/albaran/ocr:', err);
      const msg = String(err?.message || '');
      if (msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID') || err?.status === 400 || err?.status === 403) {
        return res.status(403).json({
          error:
            'Error de autenticación con el servicio de reconocimiento de escritura. Verifica la clave en Settings > Secrets.',
        });
      }
      if (msg.includes('RESOURCE_EXHAUSTED') || err?.status === 429) {
        return res.status(429).json({
          error: 'Se ha superado temporalmente la cuota de reconocimiento. Inténtalo de nuevo en unos segundos.',
        });
      }
      return res.status(500).json({
        error: `No se pudo reconocer la escritura de la hoja: ${msg || 'error interno'}`,
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TramaHogar servidor listo en http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Error iniciando servidor TramaHogar:', err);
  process.exit(1);
});
