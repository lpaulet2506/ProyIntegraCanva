
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logs detallados para Render
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'LPP Integra Proxy' });
});

app.post('/api/canva-token', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] Iniciando intercambio de token...`);

  try {
    const { code, clientId, clientSecret, redirectUri, codeVerifier } = req.body;

    if (!code || !clientId || !clientSecret || !redirectUri || !codeVerifier) {
      return res.status(400).json({ error: 'missing_params', message: 'Faltan parámetros en la petición.' });
    }

    // 1. Preparar credenciales (Trim para evitar espacios invisibles)
    const cleanClientId = clientId.trim();
    const cleanClientSecret = clientSecret.trim();
    const credentials = Buffer.from(`${cleanClientId}:${cleanClientSecret}`).toString('base64');
    
    // 2. Usar URLSearchParams (obligatorio para x-www-form-urlencoded)
    const bodyParams = new URLSearchParams();
    bodyParams.append('grant_type', 'authorization_code');
    bodyParams.append('code', code);
    bodyParams.append('redirect_uri', redirectUri);
    bodyParams.append('code_verifier', codeVerifier);

    // Endpoint oficial de Connect API v1
    const CANVA_TOKEN_URL = 'https://api.canva.com/v1/oauth/token';
    
    console.log(`[${requestId}] Enviando POST a ${CANVA_TOKEN_URL}`);
    
    // IMPORTANTE: Solo enviamos los headers estrictamente necesarios. 
    // Algunos gateways fallan si hay headers extra o mal formateados.
    const response = await fetch(CANVA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: bodyParams.toString()
    });

    const status = response.status;
    const responseText = await response.text();
    
    console.log(`[${requestId}] Canva Response Status: ${status}`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error(`[${requestId}] No se pudo parsear JSON. Body:`, responseText);
      return res.status(502).json({ error: 'invalid_response', raw: responseText });
    }

    if (!response.ok) {
      console.error(`[${requestId}] Error de Canva:`, data);
      
      // Fallback: Si el error es específicamente sobre el endpoint o headers en v1,
      // intentamos el endpoint de OAuth estándar (no Connect) por si la App no es Connect.
      if (status === 404 || (data.code === 'invalid_header_value')) {
        console.log(`[${requestId}] Reintentando con endpoint OAuth estándar...`);
        const fallbackUrl = 'https://www.canva.com/api/oauth/token';
        const fallbackRes = await fetch(fallbackUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: bodyParams.toString()
        });
        
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          console.log(`[${requestId}] Éxito con endpoint estándar.`);
          return res.json(fallbackData);
        }
      }

      return res.status(status).json(data);
    }

    console.log(`[${requestId}] Token obtenido exitosamente.`);
    res.json(data);

  } catch (error) {
    console.error(`[${requestId}] Error en Proxy:`, error);
    res.status(500).json({ error: 'proxy_error', message: error.message });
  }
});

const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor LPP Integra listo en puerto ${PORT}`);
});
