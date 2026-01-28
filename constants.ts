
export const CANVA_CONFIG = {
  // Las credenciales ahora son dinámicas y las ingresa el usuario
  get REDIRECT_URI() {
    return window.location.origin.replace(/\/$/, '');
  },
  AUTH_URL: 'https://www.canva.com/api/oauth/authorize',
  TOKEN_URL: 'https://api.canva.com/v1/oauth/token',
  AUTOFILL_URL: 'https://api.canva.com/v1/autofill',
};

// Se redujeron los scopes al mínimo indispensable que suele estar permitido sin aprobaciones especiales.
// El error 'invalid_scope' indica que uno de los scopes solicitados no está permitido para este Client ID.
// Una vez que la app sea aprobada o si se habilitan más permisos, se pueden reincorporar.
export const SCOPES = [
  'design:content:read',
  'design:content:write'
].join(' ');
