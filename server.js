
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

// Endpoint Proxy para intercambiar el token de Canva
app.post('/api/canva-token', async (req, res) => {
  try {
    const { code, clientId, clientSecret, redirectUri, codeVerifier } = req.body;
    
    // Intentamos enviar como JSON que es lo que el error sugiere que prefiere
    const response = await fetch('https://api.canva.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Canva API Error:', data);
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// Servir archivos estáticos de la carpeta dist (Vite build)
app.use(express.static(path.join(__dirname, 'dist')));

// Cualquier otra ruta sirve el index.html para que React maneje el routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
