
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
    
    console.log('Iniciando intercambio de token para clientId:', clientId);

    // Canva Connect requiere x-www-form-urlencoded para el endpoint de OAuth
    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    const response = await fetch('https://api.canva.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: bodyParams.toString(),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Error desde Canva API:', data);
      // Enviamos el error detallado de Canva de vuelta al frontend
      return res.status(response.status).json({
        error: data.error || 'canva_error',
        message: data.error_description || data.message || 'Error desconocido en Canva'
      });
    }

    console.log('Token obtenido con éxito');
    res.json(data);
  } catch (error) {
    console.error('Error en el Proxy Server:', error);
    res.status(500).json({ 
      error: 'proxy_internal_error', 
      message: 'Error interno en el servidor proxy: ' + error.message 
    });
  }
});

// Servir archivos estáticos de la carpeta dist (Vite build)
app.use(express.static(path.join(__dirname, 'dist')));

// Cualquier otra ruta sirve el index.html para que React maneje el routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor de LPP Integra corriendo en puerto ${PORT}`);
});
