export const REFRESH_COOKIE = 'r21_refresh';

export const AUTH_ERRORS = {
  CREDENCIALES_INVALIDAS: 'Usuario o contraseña incorrectos',
  CUENTA_NO_ACTIVA: 'La cuenta no está activa',
  SESION_INVALIDA: 'Sesión inválida o expirada',
} as const;

export const PERMISSIONS_CACHE_TTL_MS = 30_000;
