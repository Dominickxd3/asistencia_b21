import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  /** Orígenes permitidos separados por coma. Si la web la sirve el backend, basta el propio dominio */
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  /** Proxy inverso de confianza para leer la IP real (p. ej. «loopback» o «1»); vacío = ninguno */
  trustProxy: process.env.TRUST_PROXY ?? '',
  /** Carpeta de la web compilada; por defecto ../frontend/dist */
  frontendDist: process.env.FRONTEND_DIST || undefined,
  /** Genera y cierra jornadas a medianoche y al arrancar, recuperando obligatorias pasadas */
  jornadasAutomaticas: process.env.JORNADAS_AUTOMATICAS === 'true',
  db: {
    connectionString: process.env.DB_CONNECTION_STRING ?? '',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '5m',
  },
  /**
   * Minutos sin actividad tras los que la sesión muere en el servidor. El
   * cliente la renueva mientras se usa; con la pestaña cerrada nadie la renueva.
   */
  sesionInactividadMin: Math.max(1, parseInt(process.env.SESSION_IDLE_MINUTES ?? '5', 10) || 5),
}));
