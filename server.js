
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

// Logs para Render
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/api/canva-token', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] Intercambiando código por token...`);

  try {
    const { code, clientId, clientSecret, redirectUri, codeVerifier } = req.body;

    // Credenciales en Base64 para Basic Auth
    const credentials = Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString('base64');
    
    // Cuerpo de la petición
    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    });

    // Intentamos primero con el endpoint universal (el que menos falla)
    const PRIMARY_URL = 'https://www.canva.com/api/oauth/token';
    const CONNECT_URL = 'https://api.canva.com/v1/oauth/token';

    const tryFetch = async (url) => {
      console.log(`[${requestId}] Probando endpoint: ${url}`);
      return await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: bodyParams.toString()
      });
    };

    let response = await tryFetch(PRIMARY_URL);
    
    // Si el primero da 404, intentamos con el de Connect API por si acaso
    if (response.status === 404) {
      console.log(`[${requestId}] 404 en el primero, intentando Connect API...`);
      response = await tryFetch(CONNECT_URL);
    }

    const status = response.status;
    const responseText = await response.text();
    console.log(`[${requestId}] Status final: ${status}`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return res.status(502).json({ error: 'invalid_json', raw: responseText });
    }

    if (!response.ok) {
      console.error(`[${requestId}] Error de Canva:`, data);
      return res.status(status).json(data);
    }

    console.log(`[${requestId}] ¡Token obtenido!`);
    res.json(data);

  } catch (error) {
    console.error(`[${requestId}] Error Proxy:`, error);
    res.status(500).json({ error: 'proxy_error', message: error.message });
  }
});

const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));

app.listen(PORT, '0.0.0.0', () => console.log(`Proxy listo en puerto ${PORT}`));
