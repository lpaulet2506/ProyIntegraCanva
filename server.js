
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

// Monitor de peticiones para Render
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/api/canva-token', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] Intercambiando código por token (Siguiendo Starter Kit)...`);

  try {
    const { code, clientId, clientSecret, redirectUri, codeVerifier } = req.body;

    if (!code || !clientId || !clientSecret || !redirectUri || !codeVerifier) {
      console.error(`[${requestId}] Error: Faltan parámetros en la petición.`);
      return res.status(400).json({ error: 'missing_parameters', message: 'Faltan datos obligatorios.' });
    }

    // 1. Generar Basic Auth Header según especificación Connect API
    const authHeader = `Basic ${Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString('base64')}`;
    
    // 2. Preparar el cuerpo x-www-form-urlencoded
    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    const CANVA_TOKEN_URL = 'https://api.canva.com/v1/oauth/token';
    
    console.log(`[${requestId}] POST ${CANVA_TOKEN_URL}`);
    
    const response = await fetch(CANVA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'CanvaConnectAPI-StarterKit/1.0', // Importante para evitar bloqueos
      },
      body: bodyParams.toString(),
    });

    const responseStatus = response.status;
    const responseText = await response.text();
    
    console.log(`[${requestId}] Respuesta de Canva (Status ${responseStatus})`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error(`[${requestId}] Canva no devolvió JSON. Respuesta bruta:`, responseText.substring(0, 250));
      return res.status(responseStatus || 502).json({ 
        error: 'invalid_canva_response', 
        message: `Canva devolvió un error (Status ${responseStatus}). Verifica tus credenciales y el Redirect URI en el portal de Canva.`,
        details: responseText.substring(0, 100)
      });
    }

    if (!response.ok) {
      console.error(`[${requestId}] Error detallado de Canva:`, data);
      return res.status(responseStatus).json({
        ...data,
        message: data.error_description || data.message || `Error de Canva: ${data.error || responseStatus}`
      });
    }

    console.log(`[${requestId}] Éxito: Token obtenido.`);
    res.json(data);

  } catch (error) {
    console.error(`[${requestId}] Error crítico en el Proxy:`, error);
    res.status(500).json({ error: 'proxy_internal_error', message: error.message });
  }
});

const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
