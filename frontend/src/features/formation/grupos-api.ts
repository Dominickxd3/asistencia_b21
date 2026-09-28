import { environment } from '../../environments/environment';
import { http } from '../../core/http/http';
import type {
  CandidatoEncargado,
  CandidatoIntegrante,
  CatalogosGrupo,
  Grupo,
  GrupoDetalle,
  GrupoForm,
} from './grupos.models';

const base = `${environment.apiUrl}/groups`;

/** Convierte el formulario al cuerpo que espera la API (vacíos → null) */
export function cuerpoGrupo(form: GrupoForm) {
  return {
    etapaId: Number(form.etapaId),
    codigo: form.codigo.trim().toUpperCase(),
    nombre: form.nombre.trim(),
    periodo: form.periodo.trim(),
    fechaInicio: form.fechaInicio,
    fechaFin: form.fechaFin || null,
    programacionObligatoria: form.programacionObligatoria.map((h) => ({
      diaSemana: h.diaSemana,
      horaInicio: h.horaInicio.slice(0, 5),
    })),
  };
}

export const gruposApi = {
  listar: (estado = 'TODOS') => http.get<Grupo[]>(`${base}?estado=${estado}`),
  detalle: (id: number) => http.get<GrupoDetalle>(`${base}/${id}`),
  catalogos: () => http.get<CatalogosGrupo>(`${base}/catalogos`),

  crear: (form: GrupoForm) => http.post<GrupoDetalle>(base, cuerpoGrupo(form)),
  actualizar: (id: number, cambios: Partial<ReturnType<typeof cuerpoGrupo>>) =>
    http.patch<GrupoDetalle>(`${base}/${id}`, cambios),
  cambiarEstado: (id: number, estado: 'CERRADO' | 'CANCELADO', motivo: string) =>
    http.post<{ integrantesFinalizados: number; jornadasCanceladas: number }>(`${base}/${id}/estado`, {
      estado,
      motivo,
    }),
  reactivar: (id: number, motivo: string, restaurarIntegrantes: boolean) =>
    http.post<{
      integrantesRestaurados: number;
      omitidos: { nombre: string; motivo: string }[];
      jornadasRepuestas: number;
    }>(`${base}/${id}/reactivar`, { motivo, restaurarIntegrantes }),
  eliminar: (id: number) => http.delete(`${base}/${id}`),

  candidatosEncargado: (id: number) => http.get<CandidatoEncargado[]>(`${base}/${id}/candidatos-encargado`),
  asignarEncargado: (id: number, cuerpo: { personaId: number; reasignar: boolean; username?: string }) =>
    http.post<{ credenciales: { username: string; passwordTemporal: string } | null; rolOtorgado: boolean }>(
      `${base}/${id}/managers`,
      cuerpo,
    ),
  finalizarEncargado: (id: number, motivo: string) =>
    http.post(`${base}/${id}/managers/finalizar`, { motivo }),

  candidatosIntegrante: (id: number, q: string) =>
    http.get<CandidatoIntegrante[]>(`${base}/${id}/candidatos${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  agregarIntegrante: (id: number, personaId: number, transferir: boolean) =>
    http.post(`${base}/${id}/members`, { personaId, transferir }),
  retirarIntegrante: (id: number, personaId: number, tipo: 'QUITAR' | 'RETIRO', motivo: string) =>
    http.post<{ etapa: 'RETIRADA' | 'SIN_ETAPA' | 'CONSERVA' | null }>(`${base}/${id}/members/${personaId}/retirar`, {
      tipo,
      motivo,
    }),
};
