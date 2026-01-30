
import { CANVA_CONFIG, SCOPES } from '../constants';
import { CanvaData, AutofillResult, CanvaCredentials } from '../types';

// Generador de verifier compatible con n8n/Standard PKCE
const generateRandomString = (length: number) => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

// Codificación Base64URL segura para PKCE
const base64UrlEncode = (arrayBuffer: ArrayBuffer) => {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const sha256 = async (plain: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
};

export const initiateAuth = async (credentials: CanvaCredentials) => {
  if (!credentials.clientId) throw new Error('Client ID es requerido');
  
  const codeVerifier = generateRandomString(128);
  localStorage.setItem('canva_code_verifier', codeVerifier);

  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64UrlEncode(hashed);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: credentials.clientId.trim(),
    redirect_uri: CANVA_CONFIG.REDIRECT_URI,
    scope: SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: Math.random().toString(36).substring(7),
  });

  // El usuario va a WWW para autenticarse
  window.location.href = `${CANVA_CONFIG.AUTH_URL}?${params.toString()}`;
};

export const exchangeToken = async (code: string, credentials: CanvaCredentials): Promise<string> => {
  const codeVerifier = localStorage.getItem('canva_code_verifier');
  if (!codeVerifier) throw new Error('No se encontró el PKCE (code_verifier).');

  // El intercambio se hace a través de nuestro proxy para usar el Secret de forma segura
  const targetUrl = `${window.location.origin}/api/canva-token`;

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        clientId: credentials.clientId.trim(),
        clientSecret: credentials.clientSecret.trim(),
        redirectUri: CANVA_CONFIG.REDIRECT_URI,
        codeVerifier: codeVerifier
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || `Error ${response.status}`);
    }

    localStorage.removeItem('canva_code_verifier');
    return data.access_token;
  } catch (err: any) {
    console.error("Error en intercambio de token:", err);
    throw err;
  }
};

export const runAutofill = async (token: string, data: CanvaData): Promise<AutofillResult> => {
  // Las llamadas a la API usan el dominio API.
  const response = await fetch(CANVA_CONFIG.AUTOFILL_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      brand_template_id: data.templateId,
      data: {
        "nombre": { type: "text", text: data.name },
        "monto": { type: "text", text: data.amount },
        "direccion": { type: "text", text: data.address }
      }
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Error en Autofill');
  }

  const result = await response.json();
  return {
    jobId: result.job.id,
    status: result.job.status,
    resultUrl: result.job.result?.design?.url
  };
};

export const checkJobStatus = async (token: string, jobId: string): Promise<AutofillResult> => {
  const response = await fetch(`${CANVA_CONFIG.AUTOFILL_URL}/${jobId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) throw new Error('Fallo al consultar estado');

  const result = await response.json();
  return {
    jobId: result.job.id,
    status: result.job.status,
    resultUrl: result.job.result?.design?.url
  };
};
