
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

// Logs para diagnóstico en Render
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/api/canva-token', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] Iniciando intercambio de token...`);

  try {
    const { code, clientId, clientSecret, redirectUri, codeVerifier } = req.body;

    // Usaremos URLSearchParams para enviar los datos como x-www-form-urlencoded
    // Incluiremos client_id y client_secret EN EL CUERPO para máxima compatibilidad
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    params.append('code_verifier', codeVerifier);
    params.append('client_id', clientId.trim());
    params.append('client_secret', clientSecret.trim());

    const CANVA_URL = 'https://api.canva.com/v1/oauth/token';
    
    console.log(`[${requestId}] Enviando petición a: ${CANVA_URL}`);
    
    const response = await fetch(CANVA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'LPP-Integra-Automator/1.0' // Ayuda a evitar el 403
      },
      body: params.toString(),
    });

    const responseText = await response.text();
    console.log(`[${requestId}] Status: ${response.status}`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error(`[${requestId}] La respuesta no es JSON válido:`, responseText.substring(0, 100));
      return res.status(502).json({ 
        error: 'invalid_server_response', 
        message: 'Canva no respondió con JSON. Revisa tus credenciales.' 
      });
    }

    if (!response.ok) {
      console.error(`[${requestId}] Error de Canva:`, data);
      return res.status(response.status).json(data);
    }

    console.log(`[${requestId}] Éxito: Token generado.`);
    res.json(data);

  } catch (error) {
    console.error(`[${requestId}] Error interno del Proxy:`, error);
    res.status(500).json({ error: 'proxy_error', message: error.message });
  }
});

const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor LPP Integra activo en puerto ${PORT}`);
});
