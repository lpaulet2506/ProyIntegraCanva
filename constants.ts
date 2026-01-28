
export const CANVA_CONFIG = {
  // Las credenciales ahora son dinámicas y las ingresa el usuario
  get REDIRECT_URI() {
    return window.location.origin.replace(/\/$/, '');
  },
  AUTH_URL: 'https://www.canva.com/api/oauth/authorize',
  TOKEN_URL: 'https://api.canva.com/v1/oauth/token',
  AUTOFILL_URL: 'https://api.canva.com/v1/autofill',
};

// Se agregaron los scopes necesarios para Autofill según la documentación oficial
// 'brand_template:content:read' es vital para acceder a las plantillas de marca.
export const SCOPES = [
  'design:content:read',
  'design:content:write',
  'design:meta:read',
  'brand_template:content:read'
].join(' ');
