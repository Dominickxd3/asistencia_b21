import { environment } from '../../environments/environment';
import { authService } from '../auth/auth.service';

/**
 * Error HTTP con la misma forma que usaba HttpErrorResponse:
 * `err.error` contiene el cuerpo de la respuesta (p. ej. `err.error.message`).
 */
export class HttpError extends Error {
  readonly status: number;
  readonly error: any;

  constructor(status: number, error: any) {
    super(`HTTP ${status}`);
    this.status = status;
    this.error = error;
  }
}

type Params = Record<string, string | number | boolean | null | undefined>;

interface Opciones {
  params?: Params;
  responseType?: 'json' | 'blob';
}

interface Solicitud extends Opciones {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

let refrescando = false;

function construirUrl(url: string, params?: Params): string {
  if (!params) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${url}${url.includes('?') ? '&' : '?'}${s}` : url;
}

function enviar(url: string, sol: Solicitud, token: string | null): Promise<Response> {
  const esApi = url.startsWith(environment.apiUrl);
  const headers: Record<string, string> = {};
  if (esApi && token) headers['Authorization'] = `Bearer ${token}`;
  let body: string | undefined;
  if (sol.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(sol.body);
  }
  return fetch(construirUrl(url, sol.params), {
    method: sol.method,
    headers,
    body,
    credentials: esApi ? 'include' : 'same-origin',
  });
}

async function leerCuerpo(res: Response): Promise<any> {
  const texto = await res.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

/**
 * Adjunta el access token; ante un 401 de la API hace un único refresh
 * (cookie HttpOnly) y reintenta la petición una sola vez.
 */
async function solicitar<T>(url: string, sol: Solicitud): Promise<T> {
  const esApi = url.startsWith(environment.apiUrl);
  const esAuthFlow = url.includes('/auth/login') || url.includes('/auth/refresh');

  let res = await enviar(url, sol, authService.token);

  if (res.status === 401 && esApi && !esAuthFlow && !refrescando) {
    refrescando = true;
    try {
      await authService.intentarRestaurar();
    } finally {
      refrescando = false;
    }
    if (authService.token) res = await enviar(url, sol, authService.token);
  }

  if (!res.ok) throw new HttpError(res.status, await leerCuerpo(res));
  if (sol.responseType === 'blob') return (await res.blob()) as T;
  return (await leerCuerpo(res)) as T;
}

export const http = {
  get<T>(url: string, opciones: Opciones = {}): Promise<T> {
    return solicitar<T>(url, { method: 'GET', ...opciones });
  },
  post<T = unknown>(url: string, body: unknown, opciones: Opciones = {}): Promise<T> {
    return solicitar<T>(url, { method: 'POST', body, ...opciones });
  },
  put<T = unknown>(url: string, body: unknown, opciones: Opciones = {}): Promise<T> {
    return solicitar<T>(url, { method: 'PUT', body, ...opciones });
  },
  patch<T = unknown>(url: string, body: unknown, opciones: Opciones = {}): Promise<T> {
    return solicitar<T>(url, { method: 'PATCH', body, ...opciones });
  },
  delete<T = unknown>(url: string, opciones: Opciones = {}): Promise<T> {
    return solicitar<T>(url, { method: 'DELETE', ...opciones });
  },
};

/**
 * Mensaje legible para el usuario a partir de cualquier error de la API.
 * Une los mensajes de validación (arreglos) y distingue la falta de conexión.
 */
export function mensajeError(
  err: unknown,
  porDefecto = 'No se pudo completar la operación',
): string {
  if (err instanceof HttpError) {
    const m = err.error?.message;
    if (Array.isArray(m)) return m.join('. ');
    if (typeof m === 'string' && m) return m;
    if (err.status === 403) return 'No tiene permiso para realizar esta acción';
    if (err.status === 404) return 'El recurso solicitado no existe';
    return porDefecto;
  }
  if (err instanceof TypeError)
    return 'No se pudo conectar con el servidor. Verifique su conexión.';
  if (err instanceof Error && err.message) return err.message;
  return porDefecto;
}
