import { useEffect, useMemo, useState } from 'react';
import { environment } from '../../environments/environment';
import { http, mensajeError } from '../../core/http/http';
import { EmptyState } from '../../shared/components/EmptyState';
import { PageHeader } from '../../shared/components/PageHeader';
import { StatusBadge } from '../../shared/components/StatusBadge';
import { Modal } from '../../shared/components/Modal';
import { useNotificar } from '../../shared/components/Notificaciones';
import { useAuth } from '../../core/auth/auth.service';
import { formatoFecha } from '../../shared/utils/format';

interface FilaHistorial {
  id: number;
  personaId: number;
  etapaId: number;
  grupoId: number | null;
  persona: string;
  documento?: string;
  etapa: string;
  etapaCodigo?: string;
  grupo: string;
  grupoCodigo?: string;
  fechaInicio: string;
  fechaFin: string | null;
  estado: string;
  observacion: string | null;
  fechaCreacion?: string;
}

interface Catalogos {
  personas: { id: number; nombre: string; documento: string; estado: string }[];
  etapas: { id: number; codigo: string; nombre: string; orden: number }[];
  grupos: { id: number; nombre: string; codigo: string; etapaId: number; etapaNombre: string; estado: string }[];
}

interface FormState {
  personaId: number | '';
  etapaId: number | '';
  grupoId: number | '' | null;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  observacion: string;
}

const FORM_VACIO: FormState = {
  personaId: '',
  etapaId: '',
  grupoId: '',
  fechaInicio: new Date().toISOString().slice(0, 10),
  fechaFin: '',
  estado: 'ACTIVO',
  observacion: '',
};

const ESTADOS_OPCIONES = [
  { valor: 'ACTIVO', label: 'Activo' },
  { valor: 'FINALIZADO', label: 'Finalizado' },
  { valor: 'RETIRADO', label: 'Retirado' },
  { valor: 'SUSPENDIDO', label: 'Suspendido' },
];

const normalizar = (s: string) =>
  s ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';

export function HistorialPage() {
  const { tienePermiso } = useAuth();
  const notificar = useNotificar();
  const puedeGestionar =
    tienePermiso('formation.manage_people') || tienePermiso('formation.promote') || tienePermiso('users.manage');

  const [filas, setFilas] = useState<FilaHistorial[] | null>(null);
  const [catalogos, setCatalogos] = useState<Catalogos>({ personas: [], etapas: [], grupos: [] });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroEtapa, setFiltroEtapa] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  // Modales
  const [modalFormAbierto, setModalFormAbierto] = useState(false);
  const [filaEditando, setFilaEditando] = useState<FilaHistorial | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  // Modal eliminar
  const [filaAEliminar, setFilaAEliminar] = useState<FilaHistorial | null>(null);
  const [eliminando, setEliminando] = useState(false);

  // Cargar datos
  const cargarHistorial = () => {
    setCargando(true);
    setError(null);
    http
      .get<FilaHistorial[]>(`${environment.apiUrl}/formation/historial`)
      .then((data) => setFilas(data))
      .catch((err) => {
        setFilas([]);
        setError(mensajeError(err, 'No se pudo cargar el historial de formación'));
      })
      .finally(() => setCargando(false));
  };

  const cargarCatalogos = () => {
    http
      .get<Catalogos>(`${environment.apiUrl}/formation/catalogos`)
      .then((data) => setCatalogos(data))
      .catch((err) => console.error('Error cargando catálogos de formación:', err));
  };

  useEffect(() => {
    cargarHistorial();
    cargarCatalogos();
  }, []);

  // Abrir modal de creación
  const abrirCrear = () => {
    setFilaEditando(null);
    setForm({
      personaId: catalogos.personas[0]?.id ?? '',
      etapaId: catalogos.etapas[0]?.id ?? '',
      grupoId: '',
      fechaInicio: new Date().toISOString().slice(0, 10),
      fechaFin: '',
      estado: 'ACTIVO',
      observacion: '',
    });
    setErrorForm(null);
    setModalFormAbierto(true);
  };

  // Abrir modal de edición
  const abrirEditar = (fila: FilaHistorial) => {
    setFilaEditando(fila);
    setForm({
      personaId: fila.personaId,
      etapaId: fila.etapaId,
      grupoId: fila.grupoId ?? '',
      fechaInicio: fila.fechaInicio ? String(fila.fechaInicio).slice(0, 10) : '',
      fechaFin: fila.fechaFin ? String(fila.fechaFin).slice(0, 10) : '',
      estado: fila.estado,
      observacion: fila.observacion ?? '',
    });
    setErrorForm(null);
    setModalFormAbierto(true);
  };

  // Guardar (Crear o Actualizar)
  const guardarForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.personaId) {
      setErrorForm('Debe seleccionar a la persona.');
      return;
    }
    if (!form.etapaId) {
      setErrorForm('Debe seleccionar la etapa de formación.');
      return;
    }
    if (!form.fechaInicio) {
      setErrorForm('Debe indicar la fecha de inicio.');
      return;
    }

    setGuardando(true);
    setErrorForm(null);

    const payload = {
      personaId: Number(form.personaId),
      etapaId: Number(form.etapaId),
      grupoId: form.grupoId ? Number(form.grupoId) : null,
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin ? form.fechaFin : null,
      estado: form.estado,
      observacion: form.observacion.trim() || null,
    };

    try {
      if (filaEditando) {
        await http.put(`${environment.apiUrl}/formation/historial/${filaEditando.id}`, payload);
        notificar.exito('Trayectoria actualizada', 'El registro de formación se actualizó con éxito.');
      } else {
        await http.post(`${environment.apiUrl}/formation/historial`, payload);
        notificar.exito('Trayectoria registrada', 'El nuevo registro de formación se guardó con éxito.');
      }
      setModalFormAbierto(false);
      cargarHistorial();
    } catch (err) {
      setErrorForm(mensajeError(err, 'No se pudo guardar la trayectoria.'));
    } finally {
      setGuardando(false);
    }
  };

  // Confirmar eliminación
  const ejecutarEliminar = async () => {
    if (!filaAEliminar) return;
    setEliminando(true);
    try {
      await http.delete(`${environment.apiUrl}/formation/historial/${filaAEliminar.id}`);
      notificar.exito('Registro eliminado', 'La trayectoria fue eliminada del historial.');
      setFilaAEliminar(null);
      cargarHistorial();
    } catch (err) {
      notificar.error('Error al eliminar', mensajeError(err, 'No se pudo eliminar el registro de trayectoria.'));
    } finally {
      setEliminando(false);
    }
  };

  // Filtrado de filas
  const hayFiltros = Boolean(busqueda || filtroEtapa || filtroGrupo || filtroEstado);

  const visibles = useMemo(() => {
    if (!filas) return [];
    const q = normalizar(busqueda.trim());
    return filas.filter((h) => {
      if (q) {
        const doc = normalizar(h.documento ?? '');
        const per = normalizar(h.persona);
        const eta = normalizar(h.etapa);
        const gru = normalizar(h.grupo);
        if (!per.includes(q) && !doc.includes(q) && !eta.includes(q) && !gru.includes(q)) {
          return false;
        }
      }
      if (filtroEtapa && String(h.etapaId) !== filtroEtapa && h.etapa !== filtroEtapa) {
        return false;
      }
      if (filtroGrupo && String(h.grupoId ?? '') !== filtroGrupo && h.grupo !== filtroGrupo) {
        return false;
      }
      if (filtroEstado && h.estado !== filtroEstado) {
        return false;
      }
      return true;
    });
  }, [filas, busqueda, filtroEtapa, filtroGrupo, filtroEstado]);

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroEtapa('');
    setFiltroGrupo('');
    setFiltroEstado('');
  };

  return (
    <>
      <PageHeader
        titulo="Historial y Trayectoria de Formación"
        subtitulo="Gestión de etapas, grupos asignados y transiciones de integrantes sin duplicidad"
      >
        {puedeGestionar && (
          <button type="button" className="btn btn-sm btn-r21-primary" onClick={abrirCrear}>
            <i className="pi pi-plus me-1"></i> Nueva trayectoria
          </button>
        )}
      </PageHeader>

      {/* Tarjeta de Filtros */}
      <div className="r21-card mb-3">
        <div className="r21-card-body">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-4">
              <label className="form-label small fw-semibold text-secondary" htmlFor="hist-busqueda">
                <i className="pi pi-search me-1"></i> Buscar integrante o documento
              </label>
              <input
                id="hist-busqueda"
                type="search"
                className="form-control form-control-sm"
                placeholder="Nombre, apellido, DNI…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            <div className="col-6 col-md-3">
              <label className="form-label small fw-semibold text-secondary" htmlFor="hist-etapa">
                <i className="pi pi-compass me-1"></i> Etapa
              </label>
              <select
                id="hist-etapa"
                className="form-select form-select-sm"
                value={filtroEtapa}
                onChange={(e) => setFiltroEtapa(e.target.value)}
              >
                <option value="">Todas las etapas</option>
                {catalogos.etapas.map((et) => (
                  <option key={et.id} value={String(et.id)}>
                    {et.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold text-secondary" htmlFor="hist-grupo">
                <i className="pi pi-users me-1"></i> Grupo
              </label>
              <select
                id="hist-grupo"
                className="form-select form-select-sm"
                value={filtroGrupo}
                onChange={(e) => setFiltroGrupo(e.target.value)}
              >
                <option value="">Todos los grupos</option>
                {catalogos.grupos.map((g) => (
                  <option key={g.id} value={String(g.id)}>
                    {g.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold text-secondary" htmlFor="hist-estado">
                <i className="pi pi-tag me-1"></i> Estado
              </label>
              <select
                id="hist-estado"
                className="form-select form-select-sm"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="">Todos los estados</option>
                {ESTADOS_OPCIONES.map((opt) => (
                  <option key={opt.valor} value={opt.valor}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-6 col-md-1 d-flex justify-content-end">
              {hayFiltros && (
                <button
                  type="button"
                  className="btn btn-sm btn-r21-outline w-100"
                  onClick={limpiarFiltros}
                  title="Restablecer filtros"
                >
                  <i className="pi pi-filter-slash"></i>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tarjeta de Lista CRUD */}
      <div className="r21-card">
        <div className="r21-card-header d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <h2 className="m-0 fs-6 fw-bold">Registros de Trayectoria</h2>
            <span className="badge bg-light text-dark border font-monospace">
              {visibles.length} de {filas?.length ?? 0} registros
            </span>
          </div>
        </div>

        <div className="p-0 table-responsive">
          {cargando && filas === null ? (
            <div className="p-4 text-center text-muted">
              <i className="pi pi-spin pi-spinner me-2"></i> Cargando historial de trayectorias…
            </div>
          ) : error ? (
            <div className="r21-card-body">
              <EmptyState
                mensaje="No se pudo cargar el historial"
                descripcion={error}
                icono="pi pi-exclamation-circle"
              />
            </div>
          ) : visibles.length === 0 ? (
            <div className="r21-card-body">
              <EmptyState
                mensaje={hayFiltros ? 'Sin registros que coincidan con la búsqueda' : 'Sin historial registrado'}
                descripcion={hayFiltros ? 'Prueba ajustando los filtros superiores' : 'Usa el botón "+ Nueva trayectoria" para registrar la primera etapa'}
                icono={hayFiltros ? 'pi pi-filter-slash' : 'pi pi-history'}
              />
            </div>
          ) : (
            <table className="table table-hover align-middle mb-0" style={{ fontSize: '13px' }}>
              <thead className="table-light">
                <tr>
                  <th style={{ minWidth: '170px' }}>Integrante</th>
                  <th style={{ minWidth: '140px' }}>Etapa formativa</th>
                  <th style={{ minWidth: '130px' }}>Grupo asignado</th>
                  <th style={{ width: '95px' }}>Inicio</th>
                  <th style={{ width: '95px' }}>Fin</th>
                  <th style={{ width: '95px' }}>Estado</th>
                  <th style={{ minWidth: '130px' }}>Observación / Motivo</th>
                  {puedeGestionar && <th style={{ width: '90px', textAlign: 'center' }}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {visibles.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <div className="d-flex flex-column">
                        <span className="fw-semibold text-dark">{h.persona}</span>
                        {h.documento && (
                          <span className="text-muted font-monospace small" style={{ fontSize: '11px' }}>
                            DNI: {h.documento}
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className="fw-semibold text-secondary d-flex align-items-center gap-1">
                        <i className="pi pi-compass text-primary" style={{ fontSize: '11px' }}></i>
                        {h.etapa}
                      </span>
                    </td>

                    <td>
                      {h.grupo && h.grupo !== '—' ? (
                        <span className="badge bg-light text-dark border d-inline-flex align-items-center gap-1">
                          <i className="pi pi-users text-secondary" style={{ fontSize: '10px' }}></i>
                          {h.grupo}
                        </span>
                      ) : (
                        <span className="text-muted small">Sin grupo</span>
                      )}
                    </td>

                    <td className="text-nowrap font-monospace text-secondary">
                      <i className="pi pi-calendar me-1" style={{ fontSize: '10px' }}></i>
                      {formatoFecha(h.fechaInicio, 'dd/MM/yyyy')}
                    </td>

                    <td className="text-nowrap font-monospace">
                      {h.fechaFin ? (
                        <span className="text-secondary">
                          <i className="pi pi-calendar me-1" style={{ fontSize: '10px' }}></i>
                          {formatoFecha(h.fechaFin, 'dd/MM/yyyy')}
                        </span>
                      ) : (
                        <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '10.5px' }}>
                          En curso
                        </span>
                      )}
                    </td>

                    <td>
                      <StatusBadge estado={h.estado} />
                    </td>

                    <td className="text-truncate" style={{ maxWidth: 220 }} title={h.observacion ?? ''}>
                      {h.observacion ? (
                        <span className="text-secondary small">{h.observacion}</span>
                      ) : (
                        <span className="text-muted small">—</span>
                      )}
                    </td>

                    {puedeGestionar && (
                      <td className="text-nowrap" style={{ width: '85px', textAlign: 'center' }}>
                        <div className="btn-group btn-group-sm">
                          <button
                            type="button"
                            className="btn btn-light border py-1 px-2"
                            title="Editar trayectoria"
                            onClick={() => abrirEditar(h)}
                          >
                            <i className="pi pi-pencil text-primary"></i>
                          </button>
                          <button
                            type="button"
                            className="btn btn-light border py-1 px-2 text-danger"
                            title="Eliminar registro de trayectoria"
                            onClick={() => setFilaAEliminar(h)}
                          >
                            <i className="pi pi-trash"></i>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal CRUD: Crear o Editar */}
      {modalFormAbierto && (
        <Modal
          titulo={filaEditando ? 'Editar Trayectoria Formativa' : 'Registrar Nueva Trayectoria'}
          visible={true}
          bloqueado={guardando}
          ancho="md"
          onCerrar={() => setModalFormAbierto(false)}
          acciones={
            <div className="d-flex justify-content-end gap-2 w-100">
              <button
                type="button"
                className="btn btn-sm btn-r21-outline"
                disabled={guardando}
                onClick={() => setModalFormAbierto(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-sm btn-r21-primary"
                disabled={guardando}
                onClick={guardarForm}
              >
                {guardando ? (
                  <>
                    <i className="pi pi-spin pi-spinner me-1"></i> Guardando…
                  </>
                ) : (
                  <>
                    <i className="pi pi-check me-1"></i> {filaEditando ? 'Guardar cambios' : 'Registrar trayectoria'}
                  </>
                )}
              </button>
            </div>
          }
        >
          <form onSubmit={guardarForm} className="d-flex flex-column gap-3">
            {errorForm && (
              <div className="alert alert-danger py-2 small mb-0 d-flex align-items-center gap-2">
                <i className="pi pi-exclamation-triangle"></i>
                <span>{errorForm}</span>
              </div>
            )}

            <div>
              <label className="form-label small fw-semibold" htmlFor="modal-persona">
                Integrante / Bombero <span className="text-danger">*</span>
              </label>
              <select
                id="modal-persona"
                className="form-select form-select-sm"
                value={form.personaId}
                onChange={(e) => setForm((prev) => ({ ...prev, personaId: Number(e.target.value) || '' }))}
                required
              >
                <option value="">Seleccione un integrante…</option>
                {catalogos.personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} {p.documento ? `(DNI: ${p.documento})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="row g-2">
              <div className="col-12 col-md-6">
                <label className="form-label small fw-semibold" htmlFor="modal-etapa">
                  Etapa de formación <span className="text-danger">*</span>
                </label>
                <select
                  id="modal-etapa"
                  className="form-select form-select-sm"
                  value={form.etapaId}
                  onChange={(e) => setForm((prev) => ({ ...prev, etapaId: Number(e.target.value) || '' }))}
                  required
                >
                  <option value="">Seleccione una etapa…</option>
                  {catalogos.etapas.map((et) => (
                    <option key={et.id} value={et.id}>
                      {et.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label small fw-semibold" htmlFor="modal-grupo">
                  Grupo asignado (opcional)
                </label>
                <select
                  id="modal-grupo"
                  className="form-select form-select-sm"
                  value={form.grupoId ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      grupoId: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                >
                  <option value="">— Sin grupo —</option>
                  {catalogos.grupos.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="row g-2">
              <div className="col-6">
                <label className="form-label small fw-semibold" htmlFor="modal-finicio">
                  Fecha de inicio <span className="text-danger">*</span>
                </label>
                <input
                  id="modal-finicio"
                  type="date"
                  className="form-control form-control-sm"
                  value={form.fechaInicio}
                  onChange={(e) => setForm((prev) => ({ ...prev, fechaInicio: e.target.value }))}
                  required
                />
              </div>

              <div className="col-6">
                <label className="form-label small fw-semibold" htmlFor="modal-ffin">
                  Fecha de fin (opcional)
                </label>
                <input
                  id="modal-ffin"
                  type="date"
                  className="form-control form-control-sm"
                  value={form.fechaFin}
                  onChange={(e) => setForm((prev) => ({ ...prev, fechaFin: e.target.value }))}
                />
                <span className="form-text text-muted" style={{ fontSize: '11px' }}>
                  Dejar vacío si la etapa continúa activa.
                </span>
              </div>
            </div>

            <div>
              <label className="form-label small fw-semibold" htmlFor="modal-estado">
                Estado de la etapa <span className="text-danger">*</span>
              </label>
              <select
                id="modal-estado"
                className="form-select form-select-sm"
                value={form.estado}
                onChange={(e) => setForm((prev) => ({ ...prev, estado: e.target.value }))}
                required
              >
                {ESTADOS_OPCIONES.map((opt) => (
                  <option key={opt.valor} value={opt.valor}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label small fw-semibold" htmlFor="modal-obs">
                Observación o justificación
              </label>
              <textarea
                id="modal-obs"
                rows={2}
                className="form-control form-control-sm"
                placeholder="Motivo del registro, número de resolución o nota institucional…"
                value={form.observacion}
                onChange={(e) => setForm((prev) => ({ ...prev, observacion: e.target.value }))}
                maxLength={500}
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Confirmar Eliminación */}
      {filaAEliminar && (
        <Modal
          titulo="Confirmar eliminación de trayectoria"
          visible={true}
          bloqueado={eliminando}
          ancho="md"
          onCerrar={() => setFilaAEliminar(null)}
          acciones={
            <div className="d-flex justify-content-end gap-2 w-100">
              <button
                type="button"
                className="btn btn-sm btn-r21-outline"
                disabled={eliminando}
                onClick={() => setFilaAEliminar(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                disabled={eliminando}
                onClick={ejecutarEliminar}
              >
                {eliminando ? (
                  <>
                    <i className="pi pi-spin pi-spinner me-1"></i> Eliminando…
                  </>
                ) : (
                  <>
                    <i className="pi pi-trash me-1"></i> Confirmar eliminación
                  </>
                )}
              </button>
            </div>
          }
        >
          <div className="d-flex flex-column gap-2">
            <p className="m-0 text-dark">
              ¿Está seguro de que desea eliminar el registro de trayectoria para{' '}
              <strong>{filaAEliminar.persona}</strong> en la etapa{' '}
              <strong>{filaAEliminar.etapa}</strong>?
            </p>
            <div className="alert alert-warning py-2 px-3 small m-0 d-flex align-items-center gap-2">
              <i className="pi pi-exclamation-triangle fs-5"></i>
              <span>
                Esta acción eliminará el registro del historial de la persona y quedará
                registrada con su usuario e IP en la bitácora de auditoría.
              </span>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
