import { useCallback, useEffect, useState } from 'react';
import { Dropdown } from 'primereact/dropdown';
import { environment } from '../../environments/environment';
import { useAuth } from '../../core/auth/auth.service';
import { http, mensajeError } from '../../core/http/http';
import { EmptyState } from '../../shared/components/EmptyState';
import { useNotificar } from '../../shared/components/Notificaciones';
import { PageHeader } from '../../shared/components/PageHeader';
import { cx, fechaLocalIso, formatoFecha, rangoMes } from '../../shared/utils/format';

type TipoReporte = 'ESTADO_GENERAL' | 'DETALLE_INDIVIDUAL' | 'JORNADA';
type FormatoReporte = 'PDF' | 'EXCEL';

interface Grupo {
  id: number;
  nombre: string;
  etapa: string;
  estado: string;
}

interface Miembro {
  personaId: number;
  nombreCompleto: string;
}

interface JornadaOpcion {
  id: number;
  grupo: string;
  horaInicio: string | null;
  estado: string;
}

interface ReporteReciente {
  id: number;
  codigo: string;
  tipo: TipoReporte;
  desde: string;
  hasta: string;
  fechaGeneracion: string;
  generadoPor: string;
  grupos: string | null;
  formato: FormatoReporte;
}

const TIPOS: { id: TipoReporte; nombre: string; descripcion: string }[] = [
  { id: 'ESTADO_GENERAL', nombre: 'Estado general', descripcion: 'Consolidado por integrante de uno o más grupos' },
  { id: 'DETALLE_INDIVIDUAL', nombre: 'Detalle individual', descripcion: 'Todas las jornadas de una persona' },
  { id: 'JORNADA', nombre: 'Jornada específica', descripcion: 'Registro completo de una jornada' },
];

export function ReportesPage() {
  const { tienePermiso } = useAuth();
  const notificar = useNotificar();
  const puedeGenerar = tienePermiso('reports.generate');

  const [tipo, setTipo] = useState<TipoReporte>('ESTADO_GENERAL');
  const [formato, setFormato] = useState<FormatoReporte>('PDF');
  const [desde, setDesde] = useState(() => rangoMes(new Date()).desde);
  const [hasta, setHasta] = useState(() => rangoMes(new Date()).hasta);

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [seleccionados, setSeleccionados] = useState<number[]>([]);
  const [personas, setPersonas] = useState<Miembro[]>([]);
  const [personaId, setPersonaId] = useState<number | null>(null);
  const [fechaJornada, setFechaJornada] = useState(() => fechaLocalIso());
  const [jornadas, setJornadas] = useState<JornadaOpcion[]>([]);
  const [jornadaId, setJornadaId] = useState<number | null>(null);

  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recientes, setRecientes] = useState<ReporteReciente[] | null>(null);

  const cargarRecientes = useCallback(async () => {
    try {
      setRecientes(await http.get<ReporteReciente[]>(`${environment.apiUrl}/reports/recent`));
    } catch {
      setRecientes([]);
    }
  }, []);

  useEffect(() => {
    http
      .get<Grupo[]>(`${environment.apiUrl}/groups?estado=ACTIVO`)
      .then((g) => setGrupos(g))
      .catch((err) => notificar.error('No se pudieron cargar los grupos', mensajeError(err)));
    void cargarRecientes();
  }, [cargarRecientes, notificar]);

  useEffect(() => {
    if (tipo !== 'DETALLE_INDIVIDUAL') return;
    if (seleccionados.length !== 1) {
      setPersonas([]);
      setPersonaId(null);
      return;
    }
    let vigente = true;
    http.get<Miembro[]>(`${environment.apiUrl}/groups/${seleccionados[0]}/members`)
      .then((lista) => {
        if (!vigente) return;
        const orden = [...lista].sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
        setPersonas(orden);
        setPersonaId((actual) => (actual && orden.some((p) => p.personaId === actual) ? actual : null));
      })
      .catch((err) => notificar.error('No se pudieron cargar las personas', mensajeError(err)));
    return () => {
      vigente = false;
    };
  }, [tipo, seleccionados, notificar]);

  useEffect(() => {
    if (tipo !== 'JORNADA') return;
    let vigente = true;
    http
      .get<JornadaOpcion[]>(`${environment.apiUrl}/sessions?fecha=${fechaJornada}`)
      .then((j) => {
        if (!vigente) return;
        setJornadas(j);
        setJornadaId(j[0]?.id ?? null);
      })
      .catch((err) => notificar.error('No se pudieron cargar las jornadas', mensajeError(err)));
    return () => {
      vigente = false;
    };
  }, [tipo, fechaJornada, notificar]);

  function cambiarTipo(nuevo: TipoReporte): void {
    setTipo(nuevo);
    setPersonaId(null);
    if (nuevo === 'DETALLE_INDIVIDUAL') {
      setSeleccionados((actuales) => actuales.slice(0, 1));
    }
  }

  function toggleGrupo(id: number): void {
    setPersonaId(null);
    setSeleccionados((s) =>
      tipo === 'DETALLE_INDIVIDUAL'
        ? [id]
        : s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  }

  const todosSeleccionados = grupos.length > 0 && seleccionados.length === grupos.length;

  // Validación según el tipo
  let bloqueo: string | null = null;
  if (tipo !== 'JORNADA' && (!desde || !hasta)) bloqueo = 'Indica el periodo.';
  else if (tipo !== 'JORNADA' && hasta < desde) bloqueo = 'La fecha “hasta” no puede ser anterior a “desde”.';
  else if (tipo === 'ESTADO_GENERAL' && seleccionados.length === 0) bloqueo = 'Selecciona al menos un grupo.';
  else if (tipo === 'DETALLE_INDIVIDUAL' && seleccionados.length !== 1) bloqueo = 'Selecciona un grupo.';
  else if (tipo === 'DETALLE_INDIVIDUAL' && !personaId) bloqueo = 'Selecciona una persona.';
  else if (tipo === 'JORNADA' && !jornadaId) bloqueo = 'Selecciona una jornada.';

  async function generar(): Promise<void> {
    if (bloqueo || generando) return;
    setError(null);
    setGenerando(true);
    try {
      const body: Record<string, unknown> =
        tipo === 'JORNADA'
          ? { tipo, formato, desde: fechaJornada, hasta: fechaJornada, grupoIds: [], jornadaId }
          : { tipo, formato, desde, hasta, grupoIds: seleccionados };
      if (tipo === 'DETALLE_INDIVIDUAL') body.personaId = personaId;

      const blob = await http.post<Blob>(`${environment.apiUrl}/reports/generate`, body, { responseType: 'blob' });
      const sufijo = tipo === 'JORNADA' ? `jornada-${jornadaId}` : `${desde}_${hasta}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extension = formato === 'EXCEL' ? 'xlsx' : 'pdf';
      a.download = `rimac21_${tipo.toLowerCase()}_${sufijo}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
      notificar.exito('Reporte generado', `El archivo ${formato} se descargó en tu equipo`);
      void cargarRecientes();
    } catch (err) {
      setError(mensajeError(err, 'No se pudo generar el reporte'));
    } finally {
      setGenerando(false);
    }
  }

  const nombreTipo = (t: TipoReporte) => TIPOS.find((x) => x.id === t)?.nombre ?? t;

  return (
    <>
      <PageHeader titulo="Reportes" subtitulo="Informes oficiales en PDF y Excel generados en el servidor" />

      <div className="row g-3">
        <div className="col-12 col-lg-5">
          <div className="r21-card">
            <div className="r21-card-header">
              <h2>Nuevo reporte</h2>
            </div>
            <div className="r21-card-body d-flex flex-column gap-3">
              {!puedeGenerar && (
                <div className="r21-notice">
                  <i className="pi pi-lock"></i>
                  <div className="r21-notice-body">Tu rol puede consultar reportes, pero no generarlos.</div>
                </div>
              )}

              <div>
                <label className="form-label small fw-semibold">Tipo de reporte</label>
                <div className="d-flex flex-column gap-2">
                  {TIPOS.map((t) => (
                    <label key={t.id} className={cx('form-check m-0 p-2 border rounded', tipo === t.id && 'border-danger-subtle bg-light')}>
                      <input
                        className="form-check-input ms-0 me-2"
                        type="radio"
                        name="tipo-reporte"
                        checked={tipo === t.id}
                        onChange={() => cambiarTipo(t.id)}
                      />
                      <span className="fw-semibold small">{t.nombre}</span>
                      <span className="d-block small text-muted ms-4">{t.descripcion}</span>
                    </label>
                  ))}
                </div>
              </div>

              {tipo !== 'JORNADA' ? (
                <div>
                  <label className="form-label small fw-semibold">Rango de fechas</label>
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label text-muted small mb-1" htmlFor="reporte-desde">Desde</label>
                      <input
                        id="reporte-desde"
                        type="date"
                        className="form-control form-control-sm"
                        value={desde}
                        aria-label="Desde"
                        onChange={(e) => setDesde(e.target.value)}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label text-muted small mb-1" htmlFor="reporte-hasta">Hasta</label>
                      <input
                        id="reporte-hasta"
                        type="date"
                        className="form-control form-control-sm"
                        value={hasta}
                        aria-label="Hasta"
                        onChange={(e) => setHasta(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="row g-2">
                  <div className="col-5">
                    <label className="form-label small fw-semibold" htmlFor="fecha-jornada">
                      Fecha
                    </label>
                    <input
                      id="fecha-jornada"
                      type="date"
                      className="form-control form-control-sm"
                      value={fechaJornada}
                      onChange={(e) => setFechaJornada(e.target.value)}
                    />
                  </div>
                  <div className="col-7">
                    <label className="form-label small fw-semibold" htmlFor="jornada-sel">
                      Jornada
                    </label>
                    <select
                      id="jornada-sel"
                      className="form-select form-select-sm"
                      value={jornadaId ?? ''}
                      onChange={(e) => setJornadaId(Number(e.target.value) || null)}
                      disabled={jornadas.length === 0}
                    >
                      {jornadas.length === 0 && <option value="">Sin jornadas en la fecha</option>}
                      {jornadas.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.grupo} · {j.horaInicio ?? 'sin horario'} · {j.estado.toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {tipo !== 'JORNADA' && (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <label className="form-label small fw-semibold m-0">
                      {tipo === 'ESTADO_GENERAL' ? 'Grupos del consolidado' : 'Grupo de la persona'}
                    </label>
                    {tipo === 'ESTADO_GENERAL' && grupos.length > 1 && (
                      <button
                        type="button"
                        className="r21-link"
                        onClick={() => setSeleccionados(todosSeleccionados ? [] : grupos.map((g) => g.id))}
                      >
                        {todosSeleccionados ? 'Quitar todos' : 'Seleccionar todos'}
                      </button>
                    )}
                  </div>
                  <div className="border rounded p-2" style={{ maxHeight: 160, overflowY: 'auto' }}>
                    {grupos.length === 0 && <div className="small text-muted">Sin grupos registrados</div>}
                    {grupos.map((g) => (
                      <div key={g.id} className="form-check">
                        <input
                          className="form-check-input"
                          type={tipo === 'DETALLE_INDIVIDUAL' ? 'radio' : 'checkbox'}
                          name={tipo === 'DETALLE_INDIVIDUAL' ? 'grupo-detalle' : undefined}
                          id={'g' + g.id}
                          checked={seleccionados.includes(g.id)}
                          onChange={() => toggleGrupo(g.id)}
                        />
                        <label className="form-check-label small" htmlFor={'g' + g.id}>
                          {g.nombre} <span className="text-muted">({g.etapa})</span>
                          {g.estado !== 'ACTIVO' && <span className="r21-badge neutro ms-1">Cerrado</span>}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tipo === 'DETALLE_INDIVIDUAL' && (
                <div>
                  <label className="form-label small fw-semibold">Persona</label>
                  <Dropdown
                    value={personaId}
                    options={personas}
                    optionLabel="nombreCompleto"
                    optionValue="personaId"
                    onChange={(e) => setPersonaId(e.value)}
                    placeholder={personas.length ? 'Selecciona una persona' : 'Sin integrantes'}
                    filter
                    filterPlaceholder="Buscar…"
                    emptyMessage="Sin integrantes"
                    className="p-inputtext-sm"
                  />
                </div>
              )}

              {error && (
                <div className="r21-notice warn" role="alert">
                  <i className="pi pi-exclamation-triangle"></i>
                  <div className="r21-notice-body">{error}</div>
                </div>
              )}

              <div>
                <label className="form-label small fw-semibold">Formato de descarga</label>
                <div className="btn-group w-100" role="group" aria-label="Formato del reporte">
                  <button type="button" className={cx('btn', formato === 'PDF' ? 'btn-r21' : 'btn-r21-outline')} onClick={() => setFormato('PDF')}>
                    <i className="pi pi-file-pdf"></i> PDF
                  </button>
                  <button type="button" className={cx('btn', formato === 'EXCEL' ? 'btn-r21' : 'btn-r21-outline')} onClick={() => setFormato('EXCEL')}>
                    <i className="pi pi-file-excel"></i> Excel
                  </button>
                </div>
              </div>

              <div>
                <button
                  className="btn btn-r21 w-100"
                  onClick={() => void generar()}
                  disabled={!puedeGenerar || generando || !!bloqueo}
                >
                  {generando ? (
                    <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                  ) : (
                    <i className={formato === 'EXCEL' ? 'pi pi-file-excel' : 'pi pi-file-pdf'}></i>
                  )}
                  {generando ? 'Generando…' : `Generar ${formato === 'EXCEL' ? 'Excel' : 'PDF'}`}
                </button>
                {bloqueo && puedeGenerar && <div className="small text-muted mt-2 text-center">{bloqueo}</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-7">
          <div className="r21-card">
            <div className="r21-card-header">
              <h2>Últimos reportes generados</h2>
              <button type="button" className="btn-r21-ghost" onClick={() => void cargarRecientes()} title="Actualizar">
                <i className="pi pi-refresh"></i>
              </button>
            </div>
            {recientes === null ? (
              <div className="p-4 text-center text-muted">Cargando…</div>
            ) : recientes.length === 0 ? (
              <div className="r21-card-body">
                <EmptyState mensaje="Aún no se han generado reportes" icono="pi pi-file" />
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Periodo</th>
                      <th>Grupos</th>
                      <th>Formato</th>
                      <th>Generado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recientes.map((r) => (
                      <tr key={r.id}>
                        <td className="fw-semibold">{nombreTipo(r.tipo)}</td>
                        <td className="text-nowrap small">
                          {r.desde === r.hasta ? r.desde : `${r.desde} → ${r.hasta}`}
                        </td>
                        <td className="small text-muted">{r.grupos ?? '—'}</td>
                        <td><span className="r21-badge neutro">{r.formato ?? 'PDF'}</span></td>
                        <td className="small text-nowrap">
                          {formatoFecha(r.fechaGeneracion, 'dd/MM HH:mm')}
                          <div className="text-muted">{r.generadoPor}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
