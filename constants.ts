
export const CANVA_CONFIG = {
  get REDIRECT_URI() {
    // Aseguramos que no haya barra diagonal al final
    return window.location.origin.replace(/\/$/, '');
  },
  AUTH_URL: 'https://www.canva.com/api/oauth/authorize',
  TOKEN_URL: 'https://api.canva.com/v1/oauth/token',
  AUTOFILL_URL: 'https://api.canva.com/v1/autofill',
};

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
