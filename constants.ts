
export const CANVA_CONFIG = {
  // Las credenciales ahora son dinámicas y las ingresa el usuario
  get REDIRECT_URI() {
    return window.location.origin.replace(/\/$/, '');
  },
  AUTH_URL: 'https://www.canva.com/api/oauth/authorize',
  TOKEN_URL: 'https://api.canva.com/v1/oauth/token',
  AUTOFILL_URL: 'https://api.canva.com/v1/autofill',
};

/**
 * Scopes obtenidos del modelo de la segunda aplicación de prueba del usuario.
 * Nota: Se utiliza la nomenclatura exacta de la URL proporcionada (ej: 'brandtemplate' en lugar de 'brand_template')
 */
export const SCOPES = [
  'folder:permission:write',
  'comment:read',
  'folder:write',
  'asset:write',
  'comment:write',
  'design:content:write',
  'design:permission:write',
  'asset:read',
  'app:write',
  'folder:permission:read',
  'brandtemplate:content:read',
  'brandtemplate:meta:read',
  'folder:read',
  'design:content:read',
  'design:permission:read',
  'profile:read',
  'app:read'
].join(' ');
