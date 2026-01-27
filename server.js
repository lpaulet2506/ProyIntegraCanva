
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

// Logging de peticiones para Render
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Endpoint de salud
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'LPP Integra Proxy' });
});

// Proxy de intercambio de tokens (Siguiendo el Starter Kit de Canva)
app.post('/api/canva-token', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] Iniciando intercambio de token (Modo Connect API)`);

  try {
    const { code, clientId, clientSecret, redirectUri, codeVerifier } = req.body;

    if (!code || !clientId || !clientSecret || !redirectUri || !codeVerifier) {
      return res.status(400).json({ error: 'missing_params', message: 'Faltan parámetros requeridos.' });
    }

    // 1. Preparar el encabezado de Basic Auth (clientId:clientSecret en base64)
    // Usamos btoa que es estándar en entornos modernos de Node o una conversión manual
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    // 2. Preparar el cuerpo en formato x-www-form-urlencoded
    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    const CANVA_TOKEN_URL = 'https://api.canva.com/v1/oauth/token';
    
    console.log(`[${requestId}] Llamando a: ${CANVA_TOKEN_URL}`);
    
    const canvaResponse = await fetch(CANVA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'LPP-Integra-App/1.0'
      },
      body: bodyParams.toString(),
    });

    const status = canvaResponse.status;
    const responseText = await canvaResponse.text();
    
    console.log(`[${requestId}] Status Canva: ${status}`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error(`[${requestId}] Error parseando JSON de Canva. Body:`, responseText);
      return res.status(502).json({ error: 'invalid_canva_response', details: responseText });
    }

    if (!canvaResponse.ok) {
      console.error(`[${requestId}] Error de Canva:`, data);
      return res.status(status).json(data);
    }

    console.log(`[${requestId}] ¡Token obtenido con éxito!`);
    res.json(data);

  } catch (error) {
    console.error(`[${requestId}] Error interno en el Proxy:`, error);
    res.status(500).json({ error: 'proxy_error', message: error.message });
  }
});

// Servir la aplicación frontend
const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
