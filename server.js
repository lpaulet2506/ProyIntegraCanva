
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

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] Incoming: ${req.method} ${req.url}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString()
  });
});

app.post('/api/canva-token', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] Starting token exchange proxy (JSON mode)...`);

  try {
    const { code, clientId, clientSecret, redirectUri, codeVerifier } = req.body;

    if (!code || !clientId || !clientSecret || !redirectUri || !codeVerifier) {
      return res.status(400).json({ error: 'invalid_request', message: 'Missing parameters.' });
    }

    // Canva Connect API V1 /v1/oauth/token REQUIRES application/json
    const payload = {
      grant_type: 'authorization_code',
      code: code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    };

    const CANVA_TOKEN_URL = 'https://api.canva.com/v1/oauth/token';
    
    console.log(`[${requestId}] POST to Canva with JSON payload`);

    const canvaResponse = await fetch(CANVA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'LPP-Integra-App/1.0'
      },
      body: JSON.stringify(payload),
    });

    const status = canvaResponse.status;
    const responseBody = await canvaResponse.text();
    
    console.log(`[${requestId}] Canva Response Status: ${status}`);
    
    let data;
    try {
      data = JSON.parse(responseBody);
    } catch (e) {
      console.error(`[${requestId}] Raw body from Canva:`, responseBody);
      return res.status(502).json({ error: 'bad_gateway', message: 'Canva sent non-JSON response.' });
    }

    if (!canvaResponse.ok) {
      console.error(`[${requestId}] Error detail:`, data);
      return res.status(status).json(data);
    }

    console.log(`[${requestId}] Success: Token received.`);
    res.json(data);

  } catch (error) {
    console.error(`[${requestId}] Internal error:`, error);
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
