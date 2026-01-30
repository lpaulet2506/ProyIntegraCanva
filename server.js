
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

// Logger profesional para depuración en Render
app.use((req, res, next) => {
  if (req.url !== '/api/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Proxy de Token optimizado para Canva Connect API v1 (Modo n8n)
app.post('/api/canva-token', async (req, res) => {
  const tid = Math.random().toString(36).substring(7);
  console.log(`[TX-${tid}] Iniciando intercambio OAuth2...`);

  try {
    const { code, clientId, clientSecret, redirectUri, codeVerifier } = req.body;

    if (!code || !clientId || !clientSecret || !redirectUri || !codeVerifier) {
      console.warn(`[TX-${tid}] Parámetros faltantes en la petición.`);
      return res.status(400).json({ error: 'missing_params' });
    }

    // 1. Cabecera de Autorización Basic (Igual que n8n)
    const authHeader = `Basic ${Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString('base64')}`;
    
    // 2. Parámetros en formato URLSearchParams (Estándar OAuth2 estricto)
    const body = new URLSearchParams();
    body.append('grant_type', 'authorization_code');
    body.append('code', code);
    body.append('redirect_uri', redirectUri);
    body.append('code_verifier', codeVerifier);

    console.log(`[TX-${tid}] Enviando POST a api.canva.com/v1/oauth/token`);

    const response = await fetch('https://api.canva.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'LPP-Integra-Automator/1.0'
      },
      body: body.toString(),
    });

    const status = response.status;
    const responseText = await response.text();
    
    console.log(`[TX-${tid}] Respuesta de Canva: ${status}`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error(`[TX-${tid}] Error parseando JSON de Canva:`, responseText.substring(0, 150));
      return res.status(status || 502).json({ 
        error: 'invalid_canva_response', 
        message: 'Canva devolvió un formato no reconocido.' 
      });
    }

    if (!response.ok) {
      console.error(`[TX-${tid}] Error de Canva:`, data);
      return res.status(status).json(data);
    }

    console.log(`[TX-${tid}] Token obtenido exitosamente.`);
    res.json(data);

  } catch (error) {
    console.error(`[TX-${tid}] Error crítico en proxy:`, error);
    res.status(500).json({ error: 'proxy_error', message: error.message });
  }
});

const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`-------------------------------------------`);
  console.log(` LPP INTEGRA - PROXY ACTIVO`);
  console.log(` Puerto: ${PORT}`);
  console.log(` Modo: n8n Compatibility`);
  console.log(`-------------------------------------------`);
});
