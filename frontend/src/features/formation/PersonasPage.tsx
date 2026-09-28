import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { environment } from '../../environments/environment';
import { useAuth } from '../../core/auth/auth.service';
import { http, mensajeError } from '../../core/http/http';
import { EmptyState } from '../../shared/components/EmptyState';
import { Modal } from '../../shared/components/Modal';
import { useNotificar } from '../../shared/components/Notificaciones';
import { PageHeader } from '../../shared/components/PageHeader';
import { Paginador } from '../../shared/components/Paginador';
import { StatusBadge } from '../../shared/components/StatusBadge';
import { cx } from '../../shared/utils/format';
import { useDebounce } from '../../shared/utils/hooks';
import { PersonaFormModal } from './PersonaFormModal';
import { personasApi } from './personas-api';
import { nombreCompleto, type FiltrosPersonas, type PaginaPersonas, type Persona, type ResumenPersonas } from './personas.models';
import './personas.scss';

interface HistorialEtapa {
  id: number;
  etapa: string;
  etapaNombre: string;
  grupo: string;
  fechaInicio: string;
  fechaFin: string | null;
  estado: string;
  observacion: string | null;
}

interface GrupoOpcion {
  id: number;
  nombre: string;
  etapaCodigo: string;
  estado: string;
}

const ETAPAS_DESTINO = [
  { codigo: 'ASPIRANTE_COMPANIA', nombre: 'Aspirante de compañía' },
  { codigo: 'ASPIRANTE_ESBAS', nombre: 'Aspirante en formación ESBAS' },
];
const TAMANOS = [10, 25, 50, 100];
const CLAVE_TAMANO = 'r21.personas.tamano';

function tamanoGuardado(): number {
  try {
    const t = Number(localStorage.getItem(CLAVE_TAMANO));
    return TAMANOS.includes(t) ? t : 25;
  } catch {
    return 25;
  }
}

/** Los filtros viven en la URL: se pueden compartir y sobreviven a recargar */
function leerFiltros(p: URLSearchParams): FiltrosPersonas {
  const estado = p.get('estado');
  const tamano = Number(p.get('tamano'));
  return {
    q: p.get('q') ?? '',
    grupo: p.get('grupo') ?? '',
    etapa: p.get('etapa') ?? '',
    estado: estado === 'ACTIVO' || estado === 'INACTIVO' ? estado : 'TODOS',
    pagina: Math.max(1, Number(p.get('pagina')) || 1),
    tamano: TAMANOS.includes(tamano) ? tamano : tamanoGuardado(),
  };
}

export function PersonasPage() {
  const { tienePermiso } = useAuth();
  const notificar = useNotificar();
  const puedeGestionar = tienePermiso('formation.manage_people');
  const puedePromover = tienePermiso('formation.promote');
  const puedeAsignarGrupo = puedeGestionar && tienePermiso('formation.manage_groups');

  const [params, setParams] = useSearchParams();
  const filtros = useMemo(() => leerFiltros(params), [params]);
  const [busqueda, setBusqueda] = useState(filtros.q);
  const busquedaDiferida = useDebounce(busqueda.trim(), 300);

  const [pagina, setPagina] = useState<PaginaPersonas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [resumen, setResumen] = useState<ResumenPersonas | null>(null);
  const [recarga, setRecarga] = useState(0);

  const [ficha, setFicha] = useState<{ id: number | null } | null>(null);
  const [historialDe, setHistorialDe] = useState<Persona | null>(null);
  const [historial, setHistorial] = useState<HistorialEtapa[] | null>(null);

  const [promoviendo, setPromoviendo] = useState<Persona | null>(null);
  const [gruposPromocion, setGruposPromocion] = useState<GrupoOpcion[]>([]);
  const [etapaDestino, setEtapaDestino] = useState(ETAPAS_DESTINO[0].codigo);
  const [grupoDestino, setGrupoDestino] = useState<number | ''>('');
  const [observacion, setObservacion] = useState('');
  const [procesandoPromocion, setProcesandoPromocion] = useState(false);
  const [errorPromocion, setErrorPromocion] = useState<string | null>(null);

  const actualizar = useCallback(
    (cambios: Partial<FiltrosPersonas>) => {
      setParams(
        (prev) => {
          const f = { ...leerFiltros(prev), pagina: 1, ...cambios };
          const n = new URLSearchParams();
          if (f.q) n.set('q', f.q);
          if (f.grupo) n.set('grupo', f.grupo);
          if (f.etapa) n.set('etapa', f.etapa);
          if (f.estado !== 'TODOS') n.set('estado', f.estado);
          if (f.pagina > 1) n.set('pagina', String(f.pagina));
          if (f.tamano !== 25) n.set('tamano', String(f.tamano));
          return n;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  // La búsqueda escrita se aplica tras una pausa; solo reacciona a lo tecleado (no a «Limpiar»)
  const ultimaBusqueda = useRef(busquedaDiferida);
  useEffect(() => {
    if (busquedaDiferida === ultimaBusqueda.current) return;
    ultimaBusqueda.current = busquedaDiferida;
    actualizar({ q: busquedaDiferida });
  }, [busquedaDiferida, actualizar]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    personasApi
      .listar(filtros)
      .then((r) => {
        if (!vigente) return;
        // Si la página quedó fuera de rango (p. ej. tras desactivar a la última persona), vuelve a la última
        const ultima = Math.max(1, Math.ceil(r.total / r.tamano));
        if (r.items.length === 0 && filtros.pagina > ultima) actualizar({ pagina: ultima });
        else setPagina(r);
      })
      .catch((err) => vigente && notificar.error('No se pudo cargar la lista', mensajeError(err)))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [filtros, recarga, notificar, actualizar]);

  useEffect(() => {
    personasApi.resumen(filtros.estado).then(setResumen).catch(() => setResumen(null));
  }, [recarga, filtros.estado]);

  function cambiarTamano(t: number): void {
    try {
      localStorage.setItem(CLAVE_TAMANO, String(t));
    } catch {
      /* sin almacenamiento: solo aplica a esta vista */
    }
    actualizar({ tamano: t });
  }

  const hayFiltros = !!(filtros.q || filtros.grupo || filtros.etapa || filtros.estado !== 'TODOS');
  function limpiarFiltros(): void {
    setBusqueda('');
    actualizar({ q: '', grupo: '', etapa: '', estado: 'TODOS' });
  }

  // ---------- Historial ----------

  async function verHistorial(p: Persona): Promise<void> {
    setHistorialDe(p);
    setHistorial(null);
    try {
      setHistorial(await http.get<HistorialEtapa[]>(`${environment.apiUrl}/formation/personas/${p.id}/historial`));
    } catch (err) {
      setHistorial([]);
      notificar.error('No se pudo cargar el historial', mensajeError(err));
    }
  }

  // ---------- Promoción ----------

  function abrirPromocion(p: Persona): void {
    setPromoviendo(p);
    setEtapaDestino(ETAPAS_DESTINO[0].codigo);
    setGrupoDestino('');
    setObservacion('');
    setErrorPromocion(null);
    if (gruposPromocion.length === 0) {
      http
        .get<GrupoOpcion[]>(`${environment.apiUrl}/groups?estado=ACTIVO`)
        .then(setGruposPromocion)
        .catch((err) => setErrorPromocion(mensajeError(err, 'No se pudieron cargar los grupos')));
    }
  }

  const gruposDeEtapa = gruposPromocion.filter((g) => g.etapaCodigo === etapaDestino);

  async function promover(e: FormEvent): Promise<void> {
    e.preventDefault();
    const p = promoviendo;
    if (!p || procesandoPromocion) return;
    setProcesandoPromocion(true);
    setErrorPromocion(null);
    try {
      await http.post(`${environment.apiUrl}/formation/promote`, {
        personaId: p.id,
        etapaDestino,
        ...(grupoDestino ? { grupoDestinoId: grupoDestino } : {}),
        ...(observacion.trim() ? { observacion: observacion.trim() } : {}),
      });
      const etapa = ETAPAS_DESTINO.find((x) => x.codigo === etapaDestino)?.nombre ?? etapaDestino;
      notificar.exito('Promoción registrada', `${nombreCompleto(p)} → ${etapa}`);
      setPromoviendo(null);
      setRecarga((n) => n + 1);
    } catch (err) {
      setErrorPromocion(mensajeError(err, 'No se pudo promover'));
    } finally {
      setProcesandoPromocion(false);
    }
  }

  const items = pagina?.items ?? [];

  return (
    <div className="r21-personas">
      <PageHeader titulo="Personas" subtitulo="Una sola persona, todo su historial de etapas">
        {puedeGestionar && (
          <button className="btn btn-sm btn-r21" onClick={() => setFicha({ id: null })}>
            <i className="pi pi-user-plus"></i> Nueva persona
          </button>
        )}
      </PageHeader>

      <div className="r21-card">
        <div className="personas-filtros">
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder="Buscar por nombre, apellido o DNI…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar personas"
          />
          <select
            className="form-select form-select-sm select-categoria"
            value={filtros.etapa}
            onChange={(e) => actualizar({ etapa: e.target.value })}
            aria-label="Filtrar por categoría"
          >
            <option value="">Todas las personas</option>
            {resumen?.etapas.map((e) => (
              <option key={e.codigo} value={e.codigo}>
                {e.nombre}
              </option>
            ))}
            <option value="INSTRUCCION">Instrucción</option>
          </select>
          <select
            className="form-select form-select-sm"
            value={filtros.estado}
            onChange={(e) => actualizar({ estado: e.target.value as FiltrosPersonas['estado'] })}
            aria-label="Filtrar por estado"
          >
            <option value="TODOS">Todos los estados</option>
            <option value="ACTIVO">Activas</option>
            <option value="INACTIVO">Inactivas</option>
          </select>
          {hayFiltros && (
            <button type="button" className="btn btn-sm btn-r21-ghost" onClick={limpiarFiltros}>
              <i className="pi pi-filter-slash"></i> Limpiar
            </button>
          )}
        </div>

        <div className="table-responsive">
          {pagina === null ? (
            <div className="p-4 text-center text-muted">Cargando…</div>
          ) : items.length === 0 ? (
            <div className="r21-card-body">
              <EmptyState
                mensaje={hayFiltros ? 'Sin resultados' : 'Aún no hay personas registradas'}
                descripcion={
                  hayFiltros
                    ? 'Ninguna persona coincide con los filtros.'
                    : puedeGestionar
                      ? 'Registre la primera con «Nueva persona».'
                      : ''
                }
                icono={hayFiltros ? 'pi pi-filter-slash' : 'pi pi-user-minus'}
              />
              {hayFiltros && (
                <div className="text-center mt-2">
                  <button type="button" className="btn btn-sm btn-r21-outline" onClick={limpiarFiltros}>
                    Limpiar filtros
                  </button>
                </div>
              )}
            </div>
          ) : (
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Persona</th>
                  <th className="d-none d-sm-table-cell">Etapa</th>
                  <th>Grupo</th>
                  <th className="d-none d-lg-table-cell">Contacto</th>
                  <th className="text-center d-none d-sm-table-cell">Estado</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody className={cx(cargando && 'cargando')}>
                {items.map((p) => (
                  <tr key={p.id} className={cx(p.estado !== 'ACTIVO' && 'inactiva')}>
                    <td>
                      <div className="fw-semibold">{nombreCompleto(p)}</div>
                      <div className="d-sm-none my-1">
                        <StatusBadge estado={p.estado} />
                      </div>
                      <div className="small text-muted">
                        {p.dni ? `DNI ${p.dni}` : 'Sin DNI'}
                        {p.username && (
                          <span className="ms-2" title="Tiene cuenta en el sistema">
                            <i className="pi pi-user"></i> @{p.username}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="small d-none d-sm-table-cell">
                      {p.etapa ?? (p.esPersonal ? 'Instrucción' : <span className="text-muted">—</span>)}
                    </td>
                    <td className="small">
                      {p.grupoId ? (
                        <Link to={`/formacion/grupos/${p.grupoId}`} className="enlace-grupo" title="Ver el grupo">
                          {p.grupo}
                        </Link>
                      ) : p.esPersonal ? (
                        <span className="text-muted" title="Usuario del sistema, no es alumno">
                          <i className="pi pi-id-card"></i> {p.roles.join(', ') || 'Personal'}
                        </span>
                      ) : (
                        <span className="text-muted">Sin grupo</span>
                      )}
                      {(p.etapa || p.esPersonal) && <div className="d-sm-none text-muted">{p.etapa ?? 'Instrucción'}</div>}
                    </td>
                    <td className="small d-none d-lg-table-cell text-muted">
                      {p.telefono || p.correo ? (
                        <>
                          {p.telefono && <div>{p.telefono}</div>}
                          {p.correo && <div className="text-truncate" style={{ maxWidth: 200 }}>{p.correo}</div>}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="text-center d-none d-sm-table-cell">
                      <StatusBadge estado={p.estado} />
                    </td>
                    <td className="text-end text-nowrap">
                      {puedeGestionar && (
                        <button className="btn btn-sm btn-r21-ghost" onClick={() => setFicha({ id: p.id })} title="Editar datos" aria-label={`Editar a ${nombreCompleto(p)}`}>
                          <i className="pi pi-pencil"></i>
                        </button>
                      )}
                      <button className="btn btn-sm btn-r21-ghost" onClick={() => void verHistorial(p)} title="Historial de etapas" aria-label={`Historial de ${nombreCompleto(p)}`}>
                        <i className="pi pi-history"></i>
                      </button>
                      {puedePromover && p.estado === 'ACTIVO' && p.etapaCodigo && (
                        <button className="btn btn-sm btn-r21-ghost" onClick={() => abrirPromocion(p)} title="Promover de etapa" aria-label={`Promover a ${nombreCompleto(p)}`}>
                          <i className="pi pi-arrow-up"></i>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {pagina && pagina.total > 0 && (
          <Paginador
            total={pagina.total}
            pagina={filtros.pagina}
            tamano={filtros.tamano}
            tamanos={TAMANOS}
            unidad={pagina.total === 1 ? 'persona' : 'personas'}
            onPagina={(n) => actualizar({ pagina: n })}
            onTamano={cambiarTamano}
          />
        )}
      </div>

      <PersonaFormModal
        visible={ficha !== null}
        personaId={ficha?.id ?? null}
        grupos={resumen?.grupos ?? []}
        puedeAsignarGrupo={puedeAsignarGrupo}
        grupoInicial={null}
        onCerrar={() => setFicha(null)}
        onCambio={() => {
          setFicha(null);
          setRecarga((n) => n + 1);
        }}
      />

      <Modal
        titulo={historialDe ? `Historial de ${nombreCompleto(historialDe)}` : 'Historial'}
        visible={!!historialDe}
        onCerrar={() => setHistorialDe(null)}
        ancho="lg"
      >
        {historial === null ? (
          <div className="text-muted small d-flex align-items-center gap-2">
            <span className="spinner-border spinner-border-sm" aria-hidden="true"></span> Cargando historial…
          </div>
        ) : historial.length === 0 ? (
          <EmptyState compacto mensaje="Sin historial de etapas" icono="pi pi-history" />
        ) : (
          <div className="r21-card">
            <table className="table table-sm mb-0">
              <thead>
                <tr>
                  <th>Etapa</th>
                  <th>Grupo</th>
                  <th>Desde</th>
                  <th>Hasta</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((h) => (
                  <tr key={h.id}>
                    <td>
                      {h.etapaNombre}
                      {h.observacion && <div className="small text-muted">{h.observacion}</div>}
                    </td>
                    <td>{h.grupo}</td>
                    <td className="text-nowrap">{String(h.fechaInicio).slice(0, 10)}</td>
                    <td className="text-nowrap">{h.fechaFin ? String(h.fechaFin).slice(0, 10) : '—'}</td>
                    <td>
                      <StatusBadge estado={h.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal
        titulo={promoviendo ? `Promover a ${nombreCompleto(promoviendo)}` : 'Promover'}
        visible={!!promoviendo}
        onCerrar={() => setPromoviendo(null)}
        bloqueado={procesandoPromocion}
        acciones={
          <>
            <button type="button" className="btn btn-sm btn-r21-outline" onClick={() => setPromoviendo(null)} disabled={procesandoPromocion}>
              Cancelar
            </button>
            <button type="submit" form="form-promocion" className="btn btn-sm btn-r21" disabled={procesandoPromocion}>
              {procesandoPromocion && <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>}
              Confirmar promoción
            </button>
          </>
        }
      >
        <form id="form-promocion" onSubmit={promover} className="d-flex flex-column gap-3">
          <p className="small text-muted mb-0">
            La persona no se duplica: se cierra su etapa activa, sale de su grupo actual y se abre la nueva etapa
            conservando el historial.
          </p>
          <div>
            <label className="form-label small fw-semibold" htmlFor="etapa-destino">
              Etapa destino
            </label>
            <select
              id="etapa-destino"
              className="form-select form-select-sm"
              value={etapaDestino}
              onChange={(e) => {
                setEtapaDestino(e.target.value);
                setGrupoDestino('');
              }}
            >
              {ETAPAS_DESTINO.map((e) => (
                <option key={e.codigo} value={e.codigo}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label small fw-semibold" htmlFor="grupo-destino">
              Grupo destino
            </label>
            <select
              id="grupo-destino"
              className="form-select form-select-sm"
              value={grupoDestino}
              onChange={(e) => setGrupoDestino(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Sin grupo por ahora</option>
              {gruposDeEtapa.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nombre}
                </option>
              ))}
            </select>
            {gruposDeEtapa.length === 0 && <div className="small text-muted mt-1">No hay grupos activos de esta etapa.</div>}
          </div>
          <div>
            <label className="form-label small fw-semibold" htmlFor="obs-promocion">
              Observación (opcional)
            </label>
            <input
              id="obs-promocion"
              className="form-control form-control-sm"
              maxLength={500}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Ej.: aprobó evaluación de etapa"
            />
          </div>
          {errorPromocion && (
            <div className="r21-notice warn" role="alert">
              <i className="pi pi-exclamation-triangle"></i>
              <div className="r21-notice-body">{errorPromocion}</div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
