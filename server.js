
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

// Monitor de logs para Render
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/api/canva-token', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] Iniciando intercambio en api.canva.com (Connect API v1)...`);

  try {
    const { code, clientId, clientSecret, redirectUri, codeVerifier } = req.body;

    if (!code || !clientId || !clientSecret || !redirectUri || !codeVerifier) {
      return res.status(400).json({ error: 'missing_parameters' });
    }

    // 1. Preparar Autenticación Basic (Requisito de Canva v1)
    const credentials = `${clientId.trim()}:${clientSecret.trim()}`;
    const authHeader = `Basic ${Buffer.from(credentials).toString('base64')}`;
    
    // 2. Endpoint oficial de la Connect API
    const CANVA_API_TOKEN_URL = 'https://api.canva.com/v1/oauth/token';
    
    console.log(`[${requestId}] POST ${CANVA_API_TOKEN_URL} con JSON body y Basic Auth`);

    const response = await fetch(CANVA_API_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'CanvaConnect/1.0 (LPP Integra Automator)'
      },
      // Canva v1 requiere JSON para este endpoint específico
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      }),
    });

    const responseStatus = response.status;
    const responseText = await response.text();
    
    console.log(`[${requestId}] Status: ${responseStatus}`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error(`[${requestId}] La respuesta no es JSON:`, responseText.substring(0, 200));
      return res.status(responseStatus || 502).json({ 
        error: 'server_error', 
        message: 'Canva no devolvió un JSON válido. Revisa los logs de Render.',
        status: responseStatus
      });
    }

    if (!response.ok) {
      console.error(`[${requestId}] Error detallado:`, data);
      return res.status(responseStatus).json(data);
    }

    console.log(`[${requestId}] ¡Éxito! Token obtenido.`);
    res.json(data);

  } catch (error) {
    console.error(`[${requestId}] Error crítico:`, error);
    res.status(500).json({ error: 'internal_error', message: error.message });
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
