import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, throwError } from 'rxjs';
import { catchError, finalize, switchMap, tap } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../environments/environment';

let refrescando = false;

/**
 * Adjunta el access token; ante un 401 de la API hace un único refresh
 * (cookie HttpOnly) y reintenta la petición una sola vez.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  if (!req.url.startsWith(environment.apiUrl)) return next(req);

  const enriquecer = (token: string | null) =>
    token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` }, withCredentials: true })
      : req.clone({ withCredentials: true });

  const esAuthFlow = req.url.includes('/auth/login') || req.url.includes('/auth/refresh');

  return next(enriquecer(auth.token)).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || esAuthFlow) {
        return throwError(() => err);
      }
      if (refrescando) return throwError(() => err);
      refrescando = true;
      return from(auth.intentarRestaurar()).pipe(
        finalize(() => (refrescando = false)),
        switchMap(() => {
          if (!auth.token) return throwError(() => err);
          return next(enriquecer(auth.token));
        }),
      );
    }),
  );
};
