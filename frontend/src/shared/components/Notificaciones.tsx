import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import { Toast } from 'primereact/toast';

interface Notificar {
  exito: (resumen: string, detalle?: string) => void;
  error: (resumen: string, detalle?: string) => void;
  aviso: (resumen: string, detalle?: string) => void;
}

const Contexto = createContext<Notificar | null>(null);

/** Notificaciones breves (toasts) para confirmar acciones o informar errores. */
export function NotificacionesProvider({ children }: { children: ReactNode }) {
  const toast = useRef<Toast>(null);

  const mostrar = useCallback(
    (severity: 'success' | 'error' | 'warn', summary: string, detail?: string) =>
      toast.current?.show({ severity, summary, detail, life: severity === 'error' ? 6000 : 3500 }),
    [],
  );

  const api = useMemo<Notificar>(
    () => ({
      exito: (r, d) => mostrar('success', r, d),
      error: (r, d) => mostrar('error', r, d),
      aviso: (r, d) => mostrar('warn', r, d),
    }),
    [mostrar],
  );

  return (
    <Contexto.Provider value={api}>
      <Toast ref={toast} position="bottom-right" />
      {children}
    </Contexto.Provider>
  );
}

export function useNotificar(): Notificar {
  const api = useContext(Contexto);
  if (!api) throw new Error('useNotificar debe usarse dentro de NotificacionesProvider');
  return api;
}
