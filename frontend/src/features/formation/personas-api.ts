import { environment } from '../../environments/environment';
import { http } from '../../core/http/http';
import type { FichaPersona, FiltrosPersonas, PaginaPersonas, PersonaForm, ResumenPersonas } from './personas.models';

const base = `${environment.apiUrl}/persons`;

/** Formulario → cuerpo de la API: los opcionales vacíos se envían como null (borran el valor) */
export function cuerpoPersona(form: PersonaForm) {
  const opcional = (v: string) => (v.trim() === '' ? null : v.trim());
  return {
    dni: opcional(form.dni),
    nombres: form.nombres.trim(),
    apellidoPaterno: form.apellidoPaterno.trim(),
    apellidoMaterno: opcional(form.apellidoMaterno),
    telefono: opcional(form.telefono),
    correo: opcional(form.correo),
    fechaNacimiento: opcional(form.fechaNacimiento),
  };
}

export const personasApi = {
  listar(f: FiltrosPersonas) {
    const qs = new URLSearchParams({ pagina: String(f.pagina), tamano: String(f.tamano), estado: f.estado });
    if (f.q.trim()) qs.set('q', f.q.trim());
    if (f.grupo !== '') qs.set('grupoId', f.grupo);
    if (f.etapa) qs.set('etapa', f.etapa);
    return http.get<PaginaPersonas>(`${base}?${qs}`);
  },
  resumen: (estado: FiltrosPersonas['estado']) => http.get<ResumenPersonas>(`${base}/resumen?estado=${estado}`),
  obtener: (id: number) => http.get<FichaPersona>(`${base}/${id}`),
  crear: (form: PersonaForm) => http.post<FichaPersona>(base, cuerpoPersona(form)),
  actualizar: (id: number, form: PersonaForm) => http.patch<FichaPersona>(`${base}/${id}`, cuerpoPersona(form)),
  cambiarEstado: (id: number, estado: 'ACTIVO' | 'INACTIVO', motivo: string) =>
    http.post<{ grupoFinalizado: string | null; cuentaInactivada: boolean; encargosFinalizados: number }>(
      `${base}/${id}/estado`,
      { estado, motivo },
    ),
  eliminar: (id: number) => http.delete(`${base}/${id}`),
};
