
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

// Log de todas las peticiones entrantes para diagnosticar el 404
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Endpoint de prueba para verificar que el API Proxy está vivo
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Proxy server is running' });
});

// Endpoint Proxy para intercambiar el token de Canva
app.post('/api/canva-token', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] Iniciando intercambio para: ${req.body.clientId}`);

  try {
    const { code, clientId, clientSecret, redirectUri, codeVerifier } = req.body;

    if (!code || !clientId || !clientSecret) {
      console.error(`[${requestId}] Faltan parámetros requeridos`);
      return res.status(400).json({ error: 'missing_params', message: 'Faltan datos para el intercambio' });
    }

    // Preparamos los parámetros en formato x-www-form-urlencoded
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    params.append('code_verifier', codeVerifier);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    console.log(`[${requestId}] Enviando POST a Canva URL: https://api.canva.com/v1/oauth/token`);
    
    const canvaResponse = await fetch('https://api.canva.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'LPP-Integra-App/1.0'
      },
      body: params.toString(),
    });

    const status = canvaResponse.status;
    const responseText = await canvaResponse.text();
    
    console.log(`[${requestId}] Respuesta de Canva (Status ${status}):`, responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error(`[${requestId}] Error al parsear JSON de Canva:`, responseText);
      return res.status(502).json({ error: 'bad_gateway', message: 'Respuesta no válida de Canva', raw: responseText });
    }

    if (!canvaResponse.ok) {
      return res.status(status).json(data);
    }

    console.log(`[${requestId}] ¡Éxito! Token generado.`);
    res.json(data);

  } catch (error) {
    console.error(`[${requestId}] Error crítico en Proxy:`, error);
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

// Servir archivos estáticos DESPUÉS de las rutas de API
app.use(express.static(path.join(__dirname, 'dist')));

// Ruta comodín para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`SERVIDOR LPP INTEGRA INICIADO EN PUERTO ${PORT}`);
  console.log(`API HEALTH: http://localhost:${PORT}/api/health`);
  console.log(`=========================================`);
});
