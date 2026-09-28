import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { environment } from '../../environments/environment';
import { http, mensajeError } from '../../core/http/http';
import { EmptyState } from '../../shared/components/EmptyState';
import { PageHeader } from '../../shared/components/PageHeader';
import { StatusBadge } from '../../shared/components/StatusBadge';
import { iniciales } from '../../shared/utils/format';

interface Miembro {
  id: number;
  personaId: number;
  nombreCompleto: string;
  dni: string | null;
  fechaIngreso: string;
  estado: string;
}

interface Grupo {
  id: number;
  nombre: string;
  etapa?: { nombre: string } | null;
}

export function MiGrupoPage() {
  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargar(): Promise<void> {
      try {
        const g = await http.get<Grupo | null>(`${environment.apiUrl}/groups/mi-grupo`);
        setGrupo(g);
        if (g?.id) setMiembros(await http.get<Miembro[]>(`${environment.apiUrl}/groups/${g.id}/members`));
      } catch (err) {
        setError(mensajeError(err, 'No se pudo cargar tu grupo'));
      } finally {
        setCargando(false);
      }
    }
    void cargar();
  }, []);

  return (
    <>
      <PageHeader
        titulo="Mi grupo"
        subtitulo={grupo ? `${grupo.nombre}${grupo.etapa?.nombre ? ` — ${grupo.etapa.nombre}` : ''}` : ''}
      >
        {grupo && (
          <Link to="/asistencia" className="btn btn-sm btn-r21">
            <i className="pi pi-check-square"></i> Ir a la pizarra de hoy
          </Link>
        )}
      </PageHeader>

      {cargando ? (
        <div className="r21-card r21-card-body p-4 text-center text-muted">Cargando…</div>
      ) : error ? (
        <div className="r21-card r21-card-body">
          <EmptyState mensaje="No se pudo cargar tu grupo" descripcion={error} icono="pi pi-exclamation-circle" />
        </div>
      ) : grupo ? (
        <div className="r21-card">
          <div className="r21-card-header">
            <h2>Integrantes ({miembros.length})</h2>
          </div>
          {miembros.length === 0 ? (
            <div className="r21-card-body">
              <EmptyState mensaje="Este grupo aún no tiene integrantes" icono="pi pi-users" />
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Integrante</th>
                    <th>DNI</th>
                    <th>Ingreso al grupo</th>
                    <th className="text-end">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {miembros.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <span
                            className="d-inline-flex align-items-center justify-content-center rounded-circle border"
                            style={{ width: 30, height: 30, fontSize: 10.5, fontWeight: 700, background: '#F2F4F7' }}
                            aria-hidden="true"
                          >
                            {iniciales(m.nombreCompleto)}
                          </span>
                          <span className="fw-semibold">{m.nombreCompleto}</span>
                        </div>
                      </td>
                      <td className="text-muted">{m.dni ?? 'Sin DNI'}</td>
                      <td className="text-nowrap">{String(m.fechaIngreso).slice(0, 10)}</td>
                      <td className="text-end">
                        <StatusBadge estado={m.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="r21-card">
          <div className="r21-card-body">
            <EmptyState
              mensaje="No eres encargado activo de ningún grupo en este momento"
              descripcion="Si crees que es un error, solicita tu asignación a la Jefatura de Instrucción."
              icono="pi pi-user-minus"
            />
          </div>
        </div>
      )}
    </>
  );
}
