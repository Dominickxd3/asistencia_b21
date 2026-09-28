import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from './auth.service';

/** Protege rutas: redirige a /login si no hay sesión activa. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { autenticado } = useAuth();
  return autenticado ? children : <Navigate to="/login" replace />;
}

/** Restringe una ruta por permiso funcional (el backend vuelve a validar). */
export function RequirePermiso({ permiso, children }: { permiso: string; children: ReactNode }) {
  const { tienePermiso } = useAuth();
  return tienePermiso(permiso) ? children : <Navigate to="/inicio" replace />;
}
