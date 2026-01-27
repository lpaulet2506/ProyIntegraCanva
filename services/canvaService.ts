
import { CANVA_CONFIG, SCOPES } from '../constants';
import { CanvaData, AutofillResult, CanvaCredentials } from '../types';

const generateRandomString = (length: number) => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const sha256 = async (plain: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
};

const base64urlencode = (a: ArrayBuffer) => {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(a) as any))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export const initiateAuth = async (credentials: CanvaCredentials) => {
  if (!credentials.clientId) throw new Error('Client ID es requerido');
  
  const codeVerifier = generateRandomString(128);
  localStorage.setItem('canva_code_verifier', codeVerifier);

  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64urlencode(hashed);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: credentials.clientId,
    redirect_uri: CANVA_CONFIG.REDIRECT_URI,
    scope: SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: Math.random().toString(36).substring(7),
  });

  window.location.href = `${CANVA_CONFIG.AUTH_URL}?${params.toString()}`;
};

export const exchangeToken = async (code: string, credentials: CanvaCredentials): Promise<string> => {
  const codeVerifier = localStorage.getItem('canva_code_verifier');
  if (!codeVerifier) throw new Error('No se encontró el verificador de código (PKCE)');

  // Llamamos a nuestro PROPIO servidor para evitar el error de CORS
  const response = await fetch('/api/canva-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      redirectUri: CANVA_CONFIG.REDIRECT_URI,
      codeVerifier: codeVerifier
    }),
  });

  localStorage.removeItem('canva_code_verifier');

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error_description || errorData.message || 'Error en el servidor proxy');
  }

  const data = await response.json();
  return data.access_token;
};

export const runAutofill = async (token: string, data: CanvaData): Promise<AutofillResult> => {
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
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new Error('Fallo al consultar estado');

  const result = await response.json();
  return {
    jobId: result.job.id,
    status: result.job.status,
    resultUrl: result.job.result?.design?.url
  };
};
