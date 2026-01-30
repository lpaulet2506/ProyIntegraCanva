
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

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * ENDPOINT DE CALLBACK
 * Esta es la URL que debes poner en Canva: https://tu-app.onrender.com/callback
 */
app.get('/callback', (req, res) => {
  const { code, state, error } = req.query;
  console.log(`[CALLBACK] Código recibido de Canva. Redirigiendo...`);
  
  if (error) {
    return res.redirect(`/?error=${error}`);
  }
  
  // Redirigimos a la raíz con el código como parámetro
  res.redirect(`/?code=${code}${state ? `&state=${state}` : ''}`);
});

// Proxy de Token - CONFIGURACIÓN ESTILO N8N (Form-URLEncoded + Credenciales en Body)
app.post('/api/canva-token', async (req, res) => {
  const tid = Math.random().toString(36).substring(7);
  console.log(`[TX-${tid}] Iniciando intercambio de token...`);

  try {
    const { code, clientId, clientSecret, redirectUri, codeVerifier } = req.body;

    if (!code || !clientId || !clientSecret) {
      return res.status(400).json({ error: 'Faltan parámetros críticos' });
    }

    // Preparamos el cuerpo como formulario (como lo hace n8n)
    // Nota: Enviamos client_id y client_secret en el BODY para evitar problemas de cabeceras
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    params.append('code_verifier', codeVerifier);
    params.append('client_id', clientId.trim());
    params.append('client_secret', clientSecret.trim());

    console.log(`[TX-${tid}] Enviando petición POST a api.canva.com/v1/oauth/token`);

    const response = await fetch('https://api.canva.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'LPP-Integra-Automator/1.1'
      },
      body: params.toString(),
    });

    const status = response.status;
    const responseText = await response.text();
    console.log(`[TX-${tid}] Respuesta de Canva (Status ${status})`);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error(`[TX-${tid}] Error parseando respuesta JSON`);
      return res.status(status || 502).json({ error: 'invalid_json', raw: responseText.substring(0, 100) });
    }

    if (!response.ok) {
      console.error(`[TX-${tid}] Error detalle de Canva:`, data);
      return res.status(status).json(data);
    }

    console.log(`[TX-${tid}] ¡Token obtenido con éxito!`);
    res.json(data);

  } catch (error) {
    console.error(`[TX-${tid}] Error crítico en servidor:`, error);
    res.status(500).json({ error: 'server_error', message: error.message });
  }
});

const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor LPP v1.1 listo en puerto ${PORT}`);
});
