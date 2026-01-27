
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
    
    console.log('Iniciando intercambio de token (JSON) para:', clientId);

    // Si x-www-form-urlencoded falló con "invalid_header_value", usamos JSON puro
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
      console.error('Error detallado de Canva:', data);
      return res.status(response.status).json({
        error: data.code || data.error || 'canva_error',
        message: data.message || data.error_description || 'Error desconocido'
      });
    }

    console.log('¡Token obtenido con éxito!');
    res.json(data);
  } catch (error) {
    console.error('Error crítico en Proxy:', error);
    res.status(500).json({ 
      error: 'internal_error', 
      message: error.message 
    });
  }
});

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
