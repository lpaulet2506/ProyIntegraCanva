
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
  console.log(`[${requestId}] Iniciando intercambio de token en servidor de identidad...`);

  try {
    const { code, clientId, clientSecret, redirectUri, codeVerifier } = req.body;

    if (!code || !clientId || !clientSecret || !redirectUri || !codeVerifier) {
      console.error(`[${requestId}] Error: Faltan parámetros requeridos.`);
      return res.status(400).json({ error: 'missing_parameters', message: 'Faltan datos obligatorios para el intercambio.' });
    }

    // IMPORTANTE: Para OAuth2 en Canva, el host de identidad es www.canva.com
    // mientras que el host de API para datos es api.canva.com
    const CANVA_AUTH_TOKEN_URL = 'https://www.canva.com/api/oauth/token';
    
    // Preparar el cuerpo en formato x-www-form-urlencoded (Estándar OAuth2)
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    params.append('code_verifier', codeVerifier);
    params.append('client_id', clientId.trim());
    params.append('client_secret', clientSecret.trim());

    console.log(`[${requestId}] POST ${CANVA_AUTH_TOKEN_URL}`);

    const response = await fetch(CANVA_AUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'LPPIntegra-Automator/1.0'
      },
      body: params.toString(),
    });

    const responseStatus = response.status;
    const responseText = await response.text();
    
    console.log(`[${requestId}] Respuesta de Canva Auth (Status ${responseStatus})`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error(`[${requestId}] Error al parsear JSON de Canva:`, responseText.substring(0, 200));
      return res.status(responseStatus || 502).json({ 
        error: 'invalid_auth_response', 
        message: 'El servidor de autenticación de Canva no respondió correctamente.' 
      });
    }

    if (!response.ok) {
      console.error(`[${requestId}] Error devuelto por Canva:`, data);
      return res.status(responseStatus).json({
        ...data,
        message: data.error_description || data.message || `Error de autorización: ${data.error}`
      });
    }

    console.log(`[${requestId}] Éxito: Access Token recibido.`);
    res.json(data);

  } catch (error) {
    console.error(`[${requestId}] Error crítico en el Proxy de Identidad:`, error);
    res.status(500).json({ error: 'internal_server_error', message: error.message });
  }
});

const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de Integración listo en puerto ${PORT}`);
});
