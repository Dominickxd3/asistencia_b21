import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router';
import { environment } from '../../environments/environment';
import { http, mensajeError } from '../../core/http/http';
import { realtimeService } from '../../core/services/realtime.service';
import { EmptyState } from '../../shared/components/EmptyState';
import { Modal } from '../../shared/components/Modal';
import { PageHeader } from '../../shared/components/PageHeader';
import { cx, rangoMes } from '../../shared/utils/format';
import './tracking.scss';

interface TrackingRow {
  personaId: number;
  nombreCompleto: string;
  dni: string | null;
  asistencias: number;
  cumplimientoAplica: boolean;
  jornadasEsperadas: number;
  faltasJustificadas: number;
  faltasInjustificadas: number;
  salidasAnticipadas: number;
  participacionesVoluntarias: number;
  minutosObligatorios: number;
  minutosVoluntarios: number;
  minutosTotales: number;
}

interface GrupoOpcion {
  id: number;
  nombre: string;
  etapa: string;
}

interface JornadaDetalle {
  id: number;
  fecha: string;
  tipo: 'OBLIGATORIA' | 'VOLUNTARIA';
  estado: string;
  entrada: string | null;
  salida: string | null;
  minutos: number | null;
}

interface DetallePersona {
  personaId: number;
  nombreCompleto: string;
  dni: string | null;
  grupo: string;
  cumplimientoAplica: boolean;
  jornadas: JornadaDetalle[];
}

type Nivel = 'bien' | 'regular' | 'riesgo';

function porcentaje(fila: TrackingRow): number | null {
  if (!fila.cumplimientoAplica || fila.jornadasEsperadas === 0) return null;
  return Math.min(100, Math.round((fila.asistencias / fila.jornadasEsperadas) * 100));
}

function nivel(fila: TrackingRow): Nivel {
  const valor = porcentaje(fila) ?? 0;
  if (valor >= 85) return 'bien';
  if (valor >= 50) return 'regular';
  return 'riesgo';
}

function etiquetaNivel(fila: TrackingRow): string {
  if (!fila.cumplimientoAplica) return fila.participacionesVoluntarias > 0 ? 'Está participando' : 'Sin participación';
  const valor = porcentaje(fila) ?? 0;
  if (valor >= 85) return `Al día (${valor}%)`;
  if (valor >= 50) return `Regular (${valor}%)`;
  return `En riesgo (${valor}%)`;
}

function horas(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return m ? `${h} h ${String(m).padStart(2, '0')} min` : `${h} horas`;
}

function plural(valor: number, singular: string, pluralTexto: string): string {
  return `${valor} ${valor === 1 ? singular : pluralTexto}`;
}

function fechaHumana(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(a, m - 1, d)));
}

function textoJornada(j: JornadaDetalle): { icono: string; clase: string; texto: string } {
  if (['PRESENTE', 'FINALIZADO'].includes(j.estado)) return { icono: 'pi-check-circle', clase: 'ok', texto: 'Asistió' };
  if (j.estado === 'SALIDA_ANTICIPADA') return { icono: 'pi-clock', clase: 'warn', texto: 'Asistió y salió antes' };
  if (j.estado === 'FALTA_JUSTIFICADA') return { icono: 'pi-info-circle', clase: 'warn', texto: 'Faltó (Justificado)' };
  if (j.estado === 'FALTA_INJUSTIFICADA') return { icono: 'pi-times-circle', clase: 'danger', texto: 'Faltó (Sin justificar)' };
  return { icono: 'pi-minus-circle', clase: 'neutral', texto: 'Sin registro de asistencia' };
}

export function TrackingPage() {
  const [params, setParams] = useSearchParams();
  const [grupos, setGrupos] = useState<GrupoOpcion[]>([]);
  const [grupoId, setGrupoId] = useState<number | null>(() => Number(params.get('grupo')) || null);
  const [filas, setFilas] = useState<TrackingRow[]>([]);
  const [cumplimientoAplica, setCumplimientoAplica] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [desde, setDesde] = useState(() => rangoMes().desde);
  const [hasta, setHasta] = useState(() => rangoMes().hasta);
  const [seleccionado, setSeleccionado] = useState<TrackingRow | null>(null);
  const [detalle, setDetalle] = useState<DetallePersona | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const rangoInvalido = !!desde && !!hasta && hasta < desde;

  useEffect(() => {
    http.get<GrupoOpcion[]>(`${environment.apiUrl}/groups?estado=ACTIVO`)
      .then((lista) => {
        setGrupos(lista);
        setGrupoId((actual) => actual && lista.some((g) => g.id === actual) ? actual : (lista[0]?.id ?? null));
        if (!lista.length) setCargando(false);
      })
      .catch((err) => {
        setError(mensajeError(err, 'No se pudieron cargar los grupos'));
        setCargando(false);
      });
  }, []);

  // Tiempo real: una asistencia o cierre del grupo visible recarga sin mostrar «Cargando…»
  const [refresco, setRefresco] = useState(0);
  const silencioso = useRef(false);
  useEffect(() => {
    if (!grupoId) return;
    let temporizador: ReturnType<typeof setTimeout> | null = null;
    const alCambiar = (e: { grupoId?: number }) => {
      if (Number(e?.grupoId) !== grupoId || temporizador) return;
      temporizador = setTimeout(() => {
        temporizador = null;
        silencioso.current = true;
        setRefresco((n) => n + 1);
      }, 800);
    };
    const quitar = [
      realtimeService.on('asistencia.registrada', alCambiar),
      realtimeService.on('jornada.cerrada', alCambiar),
    ];
    return () => {
      quitar.forEach((q) => q());
      if (temporizador) clearTimeout(temporizador);
    };
  }, [grupoId]);

  useEffect(() => {
    if (!grupoId || !desde || !hasta || rangoInvalido) return;
    let vigente = true;
    if (!silencioso.current) setCargando(true);
    silencioso.current = false;
    setError(null);
    http.get<{ integrantes: TrackingRow[]; cumplimientoAplica: boolean }>(
      `${environment.apiUrl}/tracking?grupoId=${grupoId}&desde=${desde}&hasta=${hasta}&orden=faltas_injustificadas`,
    ).then((respuesta) => {
      if (!vigente) return;
      setFilas(respuesta.integrantes);
      setCumplimientoAplica(respuesta.cumplimientoAplica);
    }).catch((err) => vigente && setError(mensajeError(err, 'No se pudo cargar el seguimiento')))
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [grupoId, desde, hasta, rangoInvalido, refresco]);

  const foto = useMemo(() => {
    const bien = filas.filter((f) => nivel(f) === 'bien').length;
    const regular = filas.filter((f) => nivel(f) === 'regular').length;
    const riesgo = filas.length - bien - regular;
    const total = Math.max(1, filas.length);
    return { bien, regular, riesgo, total };
  }, [filas]);

  const ranking = useMemo(
    () => [...filas].filter((f) => f.faltasInjustificadas > 0)
      .sort((a, b) => b.faltasInjustificadas - a.faltasInjustificadas || a.nombreCompleto.localeCompare(b.nombreCompleto))
      .slice(0, 5),
    [filas],
  );
  const maxFaltas = Math.max(1, ...ranking.map((f) => f.faltasInjustificadas));

  const lectura = !cumplimientoAplica
    ? 'En ESBAS se muestran participaciones voluntarias; no se generan faltas obligatorias.'
    : foto.riesgo > foto.total / 2
      ? 'La mayoría del grupo necesita atención por baja asistencia.'
      : foto.bien >= foto.regular + foto.riesgo
        ? 'La mayoría del grupo mantiene una asistencia adecuada.'
        : 'El grupo requiere seguimiento cercano para mejorar su asistencia.';

  const donutStyle = {
    '--bien-fin': `${(foto.bien / foto.total) * 360}deg`,
    '--regular-fin': `${((foto.bien + foto.regular) / foto.total) * 360}deg`,
  } as CSSProperties;

  function cambiarGrupo(id: number): void {
    setGrupoId(id);
    setParams({ grupo: String(id) }, { replace: true });
  }

  async function abrirDetalle(fila: TrackingRow): Promise<void> {
    if (!grupoId) return;
    setSeleccionado(fila);
    setDetalle(null);
    setErrorDetalle(null);
    setCargandoDetalle(true);
    try {
      setDetalle(await http.get<DetallePersona>(
        `${environment.apiUrl}/tracking/person?grupoId=${grupoId}&personaId=${fila.personaId}&desde=${desde}&hasta=${hasta}`,
      ));
    } catch (err) {
      setErrorDetalle(mensajeError(err, 'No se pudo cargar el detalle'));
    } finally {
      setCargandoDetalle(false);
    }
  }

  function cerrarDetalle(): void {
    setSeleccionado(null);
    setDetalle(null);
    setErrorDetalle(null);
  }

  return (
    <>
      <PageHeader titulo="Seguimiento" subtitulo="Asistencia del grupo y personas que necesitan atención" />

      <section className="tracking-filters" aria-label="Filtros de seguimiento">
        <div className="tracking-filter tracking-filter--group">
          <label htmlFor="trk-grupo">Grupo</label>
          <select id="trk-grupo" value={grupoId ?? ''} onChange={(e) => cambiarGrupo(Number(e.target.value))}>
            {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </div>
        <div className="tracking-filter">
          <label htmlFor="trk-desde">Desde</label>
          <input id="trk-desde" type="date" className={cx(rangoInvalido && 'is-invalid')} value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="tracking-filter">
          <label htmlFor="trk-hasta">Hasta</label>
          <input id="trk-hasta" type="date" className={cx(rangoInvalido && 'is-invalid')} value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        {rangoInvalido && <div className="tracking-filter-error">La fecha “hasta” no puede ser anterior a “desde”.</div>}
      </section>

      {error ? (
        <div className="r21-card"><div className="r21-card-body"><EmptyState mensaje="No se pudo cargar el seguimiento" descripcion={error} icono="pi pi-exclamation-circle" /></div></div>
      ) : (
        <>
          <div className="tracking-charts" aria-busy={cargando}>
            <section className="tracking-chart-card">
              <header>
                <span className="tracking-kicker">Vista general</span>
                <h2>¿Cómo va el grupo en asistencia?</h2>
              </header>
              <div className="tracking-overview-body">
                <div className="tracking-donut" style={donutStyle}>
                  <div><strong>{cumplimientoAplica ? foto.riesgo : filas.length}</strong><span>{cumplimientoAplica ? 'en riesgo' : 'integrantes'}</span></div>
                </div>
                <div className="tracking-legend">
                  <span><i className="bien" />Asisten bien <strong>{foto.bien}</strong></span>
                  <span><i className="regular" />Asisten poco <strong>{foto.regular}</strong></span>
                  <span><i className="riesgo" />No asisten <strong>{foto.riesgo}</strong></span>
                </div>
              </div>
              <p className="tracking-reading">{lectura}</p>
            </section>

            <section className="tracking-chart-card">
              <header>
                <span className="tracking-kicker">Prioridad de atención</span>
                <h2>¿Quiénes están en alerta por faltas?</h2>
              </header>
              {ranking.length ? (
                <div className="tracking-ranking">
                  {ranking.map((fila) => (
                    <button type="button" key={fila.personaId} onClick={() => void abrirDetalle(fila)}>
                      <span className="tracking-ranking-name">{fila.nombreCompleto}</span>
                      <span className="tracking-ranking-track"><i style={{ width: `${(fila.faltasInjustificadas / maxFaltas) * 100}%` }} /></span>
                      <strong>{plural(fila.faltasInjustificadas, 'falta', 'faltas')}</strong>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="tracking-no-alerts"><i className="pi pi-check-circle" /><span>No hay faltas sin justificar en este periodo.</span></div>
              )}
              <p className="tracking-caption">Personas con más inasistencias sin justificar.</p>
            </section>
          </div>

          <section className="tracking-people">
            <header>
              <div>
                <h2>Integrantes</h2>
                <p>Haz clic en una persona para ver qué pasó.</p>
              </div>
              {cargando && <span className="spinner-border spinner-border-sm" />}
            </header>
            {filas.length === 0 && !cargando ? (
              <EmptyState mensaje="No hay integrantes para mostrar" icono="pi pi-users" />
            ) : (
              <div className="table-responsive">
                <table>
                  <thead><tr>
                    <th>Persona</th>
                    <th>¿Cómo va?</th>
                    <th>{cumplimientoAplica ? 'Jornadas' : 'Participaciones'}</th>
                    <th>{cumplimientoAplica ? 'Faltas sin justificar' : 'Horas en el local'}</th>
                  </tr></thead>
                  <tbody>
                    {filas.map((fila) => (
                      <tr key={fila.personaId} tabIndex={0} onClick={() => void abrirDetalle(fila)} onKeyDown={(e) => { if (e.key === 'Enter') void abrirDetalle(fila); }}>
                        <td><strong>{fila.nombreCompleto}</strong></td>
                        <td><span className={`tracking-status ${nivel(fila)}`}><i />{etiquetaNivel(fila)}</span></td>
                        <td>{cumplimientoAplica ? `${fila.asistencias} de ${fila.jornadasEsperadas}` : plural(fila.participacionesVoluntarias, 'participación', 'participaciones')}</td>
                        <td>{cumplimientoAplica ? plural(fila.faltasInjustificadas, 'inasistencia', 'inasistencias') : horas(fila.minutosTotales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <Modal titulo={seleccionado?.nombreCompleto ?? 'Detalle de asistencia'} visible={!!seleccionado} onCerrar={cerrarDetalle} ancho="lg">
        {seleccionado && (
          <div className="tracking-person-detail">
            <div className="tracking-person-state">
              <span className={`tracking-state-icon ${nivel(seleccionado)}`}><i className="pi pi-user" /></span>
              <div>
                <small>Estado actual</small>
                <h4>{etiquetaNivel(seleccionado)}</h4>
                <p>{seleccionado.cumplimientoAplica
                  ? `${seleccionado.asistencias} de ${seleccionado.jornadasEsperadas} jornadas completadas`
                  : plural(seleccionado.participacionesVoluntarias, 'participación voluntaria', 'participaciones voluntarias')}</p>
              </div>
            </div>
            <section className="tracking-quick-summary">
              <h5>Resumen rápido</h5>
              <div>
                <span><strong>{seleccionado.cumplimientoAplica ? seleccionado.faltasInjustificadas : 'No aplica'}</strong>Faltas sin justificar</span>
                <span><strong>{seleccionado.cumplimientoAplica ? seleccionado.faltasJustificadas : 'No aplica'}</strong>Faltas justificadas</span>
                <span><strong>{horas(seleccionado.minutosTotales)}</strong>Horas en el local</span>
              </div>
            </section>
            <section className="tracking-timeline">
              <h5>Detalle fecha por fecha</h5>
              {cargandoDetalle ? <div className="p-4 text-center text-muted">Cargando detalle…</div>
                : errorDetalle ? <div className="r21-notice warn">{errorDetalle}</div>
                  : !detalle?.jornadas.length ? <p className="text-muted">No hay registros en este periodo.</p>
                    : detalle.jornadas.map((jornada) => {
                      const estado = textoJornada(jornada);
                      return <div className={`tracking-timeline-item ${estado.clase}`} key={jornada.id}>
                        <i className={`pi ${estado.icono}`} />
                        <div><strong>{fechaHumana(jornada.fecha)}</strong><span>{estado.texto}{jornada.tipo === 'VOLUNTARIA' ? ' · Participación voluntaria' : ''}</span></div>
                        {jornada.minutos !== null && <small>{horas(jornada.minutos)}</small>}
                      </div>;
                    })}
            </section>
          </div>
        )}
      </Modal>
    </>
  );
}
