
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

// Logger
app.use((req, res, next) => {
  if (req.url !== '/api/health') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * NUEVO: Endpoint de Callback dedicado.
 * Esta es la URL que debes registrar en Canva: https://tu-app.onrender.com/callback
 */
app.get('/callback', (req, res) => {
  const { code, state, error } = req.query;
  console.log(`[CALLBACK] Recibido código de Canva. Redirigiendo al frontend...`);
  
  if (error) {
    return res.redirect(`/?error=${error}`);
  }
  
  // Redirigimos al home con los parámetros para que el frontend los procese
  res.redirect(`/?code=${code}${state ? `&state=${state}` : ''}`);
});

// Proxy de Token - CORREGIDO A JSON
app.post('/api/canva-token', async (req, res) => {
  const tid = Math.random().toString(36).substring(7);
  console.log(`[TX-${tid}] Iniciando intercambio (Modo JSON estricto)...`);

  try {
    const { code, clientId, clientSecret, redirectUri, codeVerifier } = req.body;

    // Canva v1 exige Basic Auth
    const authHeader = `Basic ${Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString('base64')}`;
    
    // El error anterior confirmó que Canva v1 NO quiere x-www-form-urlencoded
    // Así que enviamos JSON puro.
    const payload = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    };

    console.log(`[TX-${tid}] Enviando POST JSON a api.canva.com/v1/oauth/token`);

    const response = await fetch('https://api.canva.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json', // CAMBIO CLAVE: Canva exige JSON aquí
        'Accept': 'application/json',
        'User-Agent': 'LPP-Integra-Automator/1.0'
      },
      body: JSON.stringify(payload),
    });

    const status = response.status;
    const responseText = await response.text();
    
    console.log(`[TX-${tid}] Respuesta de Canva: ${status}`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error(`[TX-${tid}] Error parseando respuesta:`, responseText.substring(0, 100));
      return res.status(status || 502).json({ error: 'invalid_json', raw: responseText.substring(0, 50) });
    }

    if (!response.ok) {
      console.error(`[TX-${tid}] Error detalle:`, data);
      return res.status(status).json(data);
    }

    res.json(data);

  } catch (error) {
    console.error(`[TX-${tid}] Error crítico:`, error);
    res.status(500).json({ error: 'proxy_error', message: error.message });
  }
});

const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor LPP con soporte /callback y JSON activo.`);
});
