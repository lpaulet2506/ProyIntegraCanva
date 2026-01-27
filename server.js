
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

// Logging para depuración en Render
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'LPP Integra Proxy' });
});

app.post('/api/canva-token', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] Iniciando intercambio de token (Modo Connect API V1 JSON)`);

  try {
    const { code, clientId, clientSecret, redirectUri, codeVerifier } = req.body;

    if (!code || !clientId || !clientSecret || !redirectUri || !codeVerifier) {
      return res.status(400).json({ error: 'missing_params', message: 'Faltan parámetros.' });
    }

    // 1. Autenticación Basic (clientId:clientSecret) - REQUERIDO por V1
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    // 2. El cuerpo DEBE ser JSON para /v1/oauth/token según el error previo
    const jsonBody = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    };

    const CANVA_TOKEN_URL = 'https://api.canva.com/v1/oauth/token';
    
    console.log(`[${requestId}] POST a Canva (Header: Basic, Body: JSON)`);
    
    const canvaResponse = await fetch(CANVA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(jsonBody),
    });

    const status = canvaResponse.status;
    const responseText = await canvaResponse.text();
    
    console.log(`[${requestId}] Respuesta de Canva Status: ${status}`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error(`[${requestId}] Cuerpo no-JSON de Canva:`, responseText);
      return res.status(502).json({ error: 'invalid_json', raw: responseText });
    }

    if (!canvaResponse.ok) {
      console.error(`[${requestId}] Error detallado:`, data);
      return res.status(status).json(data);
    }

    console.log(`[${requestId}] ¡Éxito! Token generado.`);
    res.json(data);

  } catch (error) {
    console.error(`[${requestId}] Error Proxy:`, error);
    res.status(500).json({ error: 'proxy_error', message: error.message });
  }
});

const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Proxy LPP Integra corriendo en puerto ${PORT}`);
});
