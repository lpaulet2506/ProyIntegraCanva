
export const CANVA_CONFIG = {
  CLIENT_ID: 'OC-AZsy0B0m78uv',
  CLIENT_SECRET: 'cnvca10SsI2IOX_7cccUfr8KQHnAPC0R2OltO0QkQZHp18Lk139407d4',
  // Usamos un getter para que siempre devuelva el origin actual del navegador
  get REDIRECT_URI() {
    return window.location.origin.replace(/\/$/, '');
  },
  AUTH_URL: 'https://www.canva.com/api/oauth/authorize',
  TOKEN_URL: 'https://api.canva.com/v1/oauth/token',
  AUTOFILL_URL: 'https://api.canva.com/v1/autofill',
};

// Scopes necesarios para leer plantillas y escribir nuevos diseños
export const SCOPES = [
  'design:content:read',
  'design:content:write',
  'design:meta:read'
].join(' ');
