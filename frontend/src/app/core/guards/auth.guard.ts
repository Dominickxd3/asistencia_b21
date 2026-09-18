import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

/** Protege rutas: redirige a /login si no hay sesión activa. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.cargando()) await auth.intentarRestaurar();
  if (auth.autenticado()) return true;
  return router.createUrlTree(['/login']);
};

/** Restringe una ruta por permiso funcional (el backend vuelve a validar). */
export const permisoGuard = (permiso: string): CanActivateFn => {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (auth.cargando()) await auth.intentarRestaurar();
    if (auth.tienePermiso(permiso)) return true;
    return router.createUrlTree(['/inicio']);
  };
};
