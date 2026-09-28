import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../core/auth/auth.service';
import { mensajeError } from '../../core/http/http';
import { EmptyState } from '../../shared/components/EmptyState';
import { useNotificar } from '../../shared/components/Notificaciones';
import { PageHeader } from '../../shared/components/PageHeader';
import { StatusBadge } from '../../shared/components/StatusBadge';
import { cx, formatoFecha, plural } from '../../shared/utils/format';
import { useDebounce } from '../../shared/utils/hooks';
import { GrupoFormModal } from './GrupoFormModal';
import { gruposApi } from './grupos-api';
import type { CatalogosGrupo, EstadoGrupo, Grupo, GrupoForm } from './grupos.models';
import './grupos.scss';

type FiltroEstado = EstadoGrupo | 'TODOS';

const FILTROS: { valor: FiltroEstado; texto: string }[] = [
  { valor: 'ACTIVO', texto: 'Activos' },
  { valor: 'CERRADO', texto: 'Cerrados' },
  { valor: 'CANCELADO', texto: 'Cancelados' },
  { valor: 'TODOS', texto: 'Todos' },
];

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function GruposPage() {
  const { tienePermiso } = useAuth();
  const notificar = useNotificar();
  const navegar = useNavigate();
  const puedeGestionar = tienePermiso('formation.manage_groups');
  const puedeSeguimiento = tienePermiso('tracking.view');

  const [grupos, setGrupos] = useState<Grupo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroEstado>('ACTIVO');
  const [etapa, setEtapa] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const texto = useDebounce(sinTildes(busqueda.trim()), 200);

  const [catalogos, setCatalogos] = useState<CatalogosGrupo | null>(null);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    gruposApi
      .listar()
      .then(setGrupos)
      .catch((err) => {
        setGrupos([]);
        setError(mensajeError(err, 'No se pudieron cargar los grupos'));
      });
  }, []);

  useEffect(() => {
    if (!puedeGestionar) return;
    gruposApi
      .catalogos()
      .then(setCatalogos)
      .catch(() => setCatalogos(null));
  }, [puedeGestionar]);

  const conteo = useMemo(() => {
    const c: Record<FiltroEstado, number> = { ACTIVO: 0, CERRADO: 0, CANCELADO: 0, TODOS: 0 };
    for (const g of grupos ?? []) {
      c[g.estado] += 1;
      c.TODOS += 1;
    }
    return c;
  }, [grupos]);

  const etapas = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const g of grupos ?? []) mapa.set(g.etapaCodigo, g.etapa);
    return [...mapa.entries()];
  }, [grupos]);

  const visibles = useMemo(
    () =>
      (grupos ?? []).filter(
        (g) =>
          (filtro === 'TODOS' || g.estado === filtro) &&
          (!etapa || g.etapaCodigo === etapa) &&
          (!texto || sinTildes(`${g.nombre} ${g.codigo} ${g.periodo} ${g.encargado?.nombre ?? ''}`).includes(texto)),
      ),
    [grupos, filtro, etapa, texto],
  );

  async function crear(form: GrupoForm): Promise<void> {
    const nuevo = await gruposApi.crear(form);
    notificar.exito('Grupo creado', `${nuevo.nombre}. Asigne su encargado e integrantes.`);
    setCreando(false);
    navegar(`/formacion/grupos/${nuevo.id}`);
  }

  const sinEncargado = (grupos ?? []).filter((g) => g.estado === 'ACTIVO' && !g.encargado).length;

  return (
    <div className="r21-grupos">
      <PageHeader titulo="Grupos" subtitulo="Cohortes por etapa y periodo">
        {puedeGestionar && (
          <button className="btn btn-sm btn-r21" onClick={() => setCreando(true)} disabled={!catalogos}>
            <i className="pi pi-plus"></i> Nuevo grupo
          </button>
        )}
      </PageHeader>

      {!puedeGestionar && grupos !== null && (
        <div className="r21-notice info">
          <i className="pi pi-eye"></i>
          <div className="r21-notice-body">
            <strong>Modo consulta.</strong> Su rol permite ver los grupos; crear, editar o cambiar integrantes
            corresponde a la Jefatura de Instrucción.
          </div>
        </div>
      )}

      {puedeGestionar && sinEncargado > 0 && (
        <div className="r21-notice warn">
          <i className="pi pi-exclamation-triangle"></i>
          <div className="r21-notice-body">
            {sinEncargado === 1 ? 'Hay 1 grupo activo' : `Hay ${sinEncargado} grupos activos`} sin encargado: nadie
            podrá registrar su asistencia desde «Mi grupo».
          </div>
        </div>
      )}

      <div className="r21-card grupos-toolbar">
        <div className="r21-card-body">
          <div className="grupos-filtros" role="tablist" aria-label="Estado del grupo">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                role="tab"
                aria-selected={filtro === f.valor}
                className={cx('filtro-estado', filtro === f.valor && 'activo')}
                onClick={() => setFiltro(f.valor)}
              >
                {f.texto}
                <span className="filtro-conteo">{conteo[f.valor]}</span>
              </button>
            ))}
          </div>
          <div className="grupos-busqueda">
            <select
              className="form-select form-select-sm"
              value={etapa}
              onChange={(e) => setEtapa(e.target.value)}
              aria-label="Filtrar por etapa"
            >
              <option value="">Todas las etapas</option>
              {etapas.map(([codigo, nombre]) => (
                <option key={codigo} value={codigo}>
                  {nombre}
                </option>
              ))}
            </select>
            <input
              type="search"
              className="form-control form-control-sm"
              placeholder="Buscar grupo, código o encargado…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar grupos"
            />
          </div>
        </div>
      </div>

      {grupos === null ? (
        <div className="r21-card r21-card-body text-center text-muted">Cargando…</div>
      ) : visibles.length === 0 ? (
        <div className="r21-card">
          <div className="r21-card-body">
            {error ? (
              <EmptyState mensaje="No se pudieron cargar los grupos" descripcion={error} icono="pi pi-exclamation-circle" />
            ) : grupos.length === 0 ? (
              <EmptyState
                mensaje="Aún no hay grupos registrados"
                descripcion={puedeGestionar ? 'Cree el primer grupo con «Nuevo grupo».' : ''}
                icono="pi pi-th-large"
              />
            ) : (
              <EmptyState mensaje="Sin resultados" descripcion="Ningún grupo coincide con los filtros." icono="pi pi-filter-slash" />
            )}
          </div>
        </div>
      ) : (
        <div className="row g-3">
          {visibles.map((g) => (
            <div key={g.id} className="col-12 col-md-6 col-lg-4">
              <div className={cx('r21-card h-100 d-flex flex-column grupo-card', g.estado !== 'ACTIVO' && 'inactivo')}>
                <div className="r21-card-header">
                  <div className="min-w-0">
                    <h2 className="grupo-card-titulo">
                      <Link to={`/formacion/grupos/${g.id}`}>{g.nombre}</Link>
                    </h2>
                    <span className="grupo-codigo">{g.codigo}</span>
                  </div>
                  <StatusBadge estado={g.estado} />
                </div>
                <div className="r21-card-body small flex-grow-1">
                  <dl className="row mb-0 g-1">
                    <dt className="col-5 text-muted fw-normal">Etapa</dt>
                    <dd className="col-7 mb-1">{g.etapa}</dd>
                    <dt className="col-5 text-muted fw-normal">Periodo</dt>
                    <dd className="col-7 mb-1">{g.periodo}</dd>
                    <dt className="col-5 text-muted fw-normal">Vigencia</dt>
                    <dd className="col-7 mb-1">
                      {formatoFecha(`${g.fechaInicio}T00:00:00`, 'dd/MM/yyyy')}
                      {g.fechaFin ? ` – ${formatoFecha(`${g.fechaFin}T00:00:00`, 'dd/MM/yyyy')}` : ' – en curso'}
                    </dd>
                    <dt className="col-5 text-muted fw-normal">Integrantes</dt>
                    <dd className="col-7 mb-1 fw-semibold">{g.totalIntegrantes}</dd>
                    <dt className="col-5 text-muted fw-normal">Encargado</dt>
                    <dd className="col-7 mb-0">
                      {g.encargado ? (
                        g.encargado.nombre
                      ) : g.estado === 'ACTIVO' ? (
                        <span className="r21-badge warn">
                          <i className="pi pi-exclamation-triangle"></i> Sin asignar
                        </span>
                      ) : (
                        <em className="text-muted">—</em>
                      )}
                    </dd>
                  </dl>
                </div>
                <div className="r21-card-footer">
                  <span className="text-muted">{plural(g.totalIntegrantes, 'integrante')}</span>
                  <div className="d-flex gap-2 ms-auto">
                    {puedeSeguimiento && g.estado === 'ACTIVO' && (
                      <Link to={`/seguimiento?grupo=${g.id}`} className="btn btn-sm btn-r21-outline" title="Ver seguimiento">
                        <i className="pi pi-chart-line"></i>
                        <span className="visually-hidden">Seguimiento</span>
                      </Link>
                    )}
                    <Link to={`/formacion/grupos/${g.id}`} className="btn btn-sm btn-r21-outline">
                      {puedeGestionar && g.estado === 'ACTIVO' ? (
                        <>
                          <i className="pi pi-sliders-h"></i> Gestionar
                        </>
                      ) : (
                        <>
                          <i className="pi pi-eye"></i> Ver detalle
                        </>
                      )}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {puedeGestionar && (
        <GrupoFormModal
          visible={creando}
          grupo={null}
          catalogos={catalogos}
          onCerrar={() => setCreando(false)}
          onGuardar={crear}
        />
      )}
    </div>
  );
}
