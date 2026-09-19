import { BadRequestException, CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

/** Regla global: ninguna fecha de negocio puede ser posterior al día actual en Lima. */
@Injectable()
export class NoFutureDatesInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const hoy = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    this.validar(request.query, hoy);
    this.validar(request.body, hoy);
    return next.handle();
  }

  private validar(valor: unknown, hoy: string, ruta = ''): void {
    if (!valor || typeof valor !== 'object') return;
    for (const [clave, contenido] of Object.entries(valor as Record<string, unknown>)) {
      const campo = ruta ? `${ruta}.${clave}` : clave;
      if (typeof contenido === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(contenido) && contenido > hoy) {
        throw new BadRequestException(`La fecha de ${campo} no puede ser posterior a hoy (${hoy})`);
      }
      if (contenido && typeof contenido === 'object') this.validar(contenido, hoy, campo);
    }
  }
}
