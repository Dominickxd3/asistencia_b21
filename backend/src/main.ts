import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { erroresDeValidacion } from './common/validation/mensajes-validacion';

const logger = new Logger('Arranque');

/** En producción, detenerse ante una configuración insegura en lugar de arrancar */
function validarConfiguracion(config: ConfigService, produccion: boolean): void {
  if (!produccion) return;
  const errores: string[] = [];
  for (const clave of ['app.jwt.accessSecret', 'app.jwt.refreshSecret']) {
    if ((config.get<string>(clave) ?? '').length < 32) errores.push(`${clave} debe tener al menos 32 caracteres`);
  }
  if (config.get('app.jwt.accessSecret') === config.get('app.jwt.refreshSecret')) {
    errores.push('JWT_ACCESS_SECRET y JWT_REFRESH_SECRET deben ser distintos');
  }
  if (!config.get<boolean>('app.cookieSecure')) errores.push('COOKIE_SECURE debe ser true (requiere HTTPS)');
  if (errores.length) throw new Error(`Configuración de producción inválida:\n - ${errores.join('\n - ')}`);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const produccion = config.get<string>('app.nodeEnv') === 'production';
  validarConfiguracion(config, produccion);

  const apiPrefix = config.get<string>('app.apiPrefix') ?? 'api';
  const port = config.get<number>('app.port') ?? 3000;
  const origenes = (config.get<string>('app.corsOrigin') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // Detrás de IIS/nginx/Caddy: la IP real llega en X-Forwarded-For. Solo se confía
  // en el proxy indicado (p. ej. «loopback»), nunca en lo que envíe cualquier cliente.
  const trustProxy = config.get<string>('app.trustProxy');
  if (trustProxy) app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

  app.setGlobalPrefix(apiPrefix);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          // PrimeReact y Leaflet aplican estilos en línea
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
          // Mapas de la geocerca: OpenStreetMap y satélite de ArcGIS
          imgSrc: ["'self'", 'data:', 'blob:', 'https://tile.openstreetmap.org', 'https://server.arcgisonline.com'],
          connectSrc: ["'self'"],
          mediaSrc: ["'self'", 'blob:'],
          workerSrc: ["'self'", 'blob:'],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  app.enableCors({ origin: origenes.length ? origenes : false, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: erroresDeValidacion,
    }),
  );

  // La web compilada (frontend/dist) la sirve el mismo backend: un solo dominio,
  // sin CORS, y cookies y WebSocket en el mismo origen.
  const distFrontend = resolve(config.get<string>('app.frontendDist') ?? join(__dirname, '..', '..', 'frontend', 'dist'));
  const indexHtml = join(distFrontend, 'index.html');
  if (existsSync(indexHtml)) {
    app.useStaticAssets(distFrontend, {
      index: false,
      setHeaders: (res, ruta) => {
        // Los archivos con hash en el nombre no cambian nunca: caché de un año
        if (/[\\/]assets[\\/].+-[A-Za-z0-9_-]{8}\.(js|css)$/.test(ruta)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    });
    // Rutas de la SPA (p. ej. /asistencia): cualquier GET que no sea API ni WebSocket
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith(`/${apiPrefix}`) || req.path.startsWith('/socket.io')) {
        return next();
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
    logger.log(`Sirviendo la web desde ${distFrontend}`);
  } else if (produccion) {
    logger.warn(`No se encontró la web compilada en ${distFrontend}; solo se sirve la API`);
  }

  if (!produccion) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Rímac 21 - API de Instrucción')
      .setDescription('API del sistema institucional del Área de Instrucción')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document);
    logger.log(`Swagger: http://localhost:${port}/${apiPrefix}/docs`);
  }

  app.enableShutdownHooks();
  await app.listen(port);
  logger.log(`API escuchando en el puerto ${port} (/${apiPrefix})${produccion ? ' — producción' : ''}`);
}

bootstrap().catch((err: Error) => {
  logger.error(err.message);
  process.exit(1);
});
