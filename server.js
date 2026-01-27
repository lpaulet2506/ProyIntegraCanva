
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

// Log detallado de peticiones para depurar el 404
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] RECIBIDO: ${req.method} ${req.url}`);
  next();
});

// Endpoint de salud
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// Proxy de Token mejorado
app.post('/api/canva-token', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] Solicitud de intercambio recibida en el Proxy`);

  try {
    const { code, clientId, clientSecret, redirectUri, codeVerifier } = req.body;

    // Validación de entrada
    if (!code || !clientId || !clientSecret) {
      return res.status(400).json({ error: 'missing_data', message: 'Datos incompletos para el intercambio' });
    }

    // Canva es extremadamente sensible al formato. 
    // Usamos URLSearchParams para asegurar un formato x-www-form-urlencoded perfecto.
    const bodyParams = new URLSearchParams();
    bodyParams.append('grant_type', 'authorization_code');
    bodyParams.append('code', code);
    bodyParams.append('client_id', clientId);
    bodyParams.append('client_secret', clientSecret);
    bodyParams.append('redirect_uri', redirectUri);
    bodyParams.append('code_verifier', codeVerifier);

    // Probamos con el dominio base que suele ser más estable para OAuth2
    const CANVA_TOKEN_ENDPOINT = 'https://www.canva.com/api/oauth/token';
    
    console.log(`[${requestId}] Llamando a Canva: ${CANVA_TOKEN_ENDPOINT}`);

    const response = await fetch(CANVA_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: bodyParams.toString()
    });

    const responseData = await response.text();
    console.log(`[${requestId}] Canva respondió con Status ${response.status}`);

    if (!response.ok) {
      console.error(`[${requestId}] Error de Canva: ${responseData}`);
      try {
        const errorJson = JSON.parse(responseData);
        return res.status(response.status).json(errorJson);
      } catch (e) {
        return res.status(response.status).json({ error: 'canva_raw_error', message: responseData });
      }
    }

    const data = JSON.parse(responseData);
    res.json(data);

  } catch (error) {
    console.error(`[${requestId}] Error interno en el Proxy:`, error);
    res.status(500).json({ error: 'proxy_internal_error', message: error.message });
  }
});

// Importante: Servir estáticos DESPUÉS de las rutas de API
app.use(express.static(path.join(__dirname, 'dist')));

// SPA Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Escuchar en 0.0.0.0 es vital para que Render detecte el servicio
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 SERVIDOR LPP INTEGRA ACTIVO
  ----------------------------------
  Puerto: ${PORT}
  Health: http://0.0.0.0:${PORT}/api/health
  ----------------------------------
  `);
});
