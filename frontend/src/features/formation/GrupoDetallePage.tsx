import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../../core/auth/auth.service';
import { HttpError, mensajeError } from '../../core/http/http';
import { EmptyState } from '../../shared/components/EmptyState';
import { useNotificar } from '../../shared/components/Notificaciones';
import { PageHeader } from '../../shared/components/PageHeader';
import { StatusBadge } from '../../shared/components/StatusBadge';
import { cx, formatoFecha } from '../../shared/utils/format';
import {
  AgregarIntegranteDialog,
  BajaIntegranteDialog,
  EliminarGrupoDialog,
  EncargadoDialog,
  EstadoGrupoDialog,
  QuitarEncargadoDialog,
  ReactivarGrupoDialog,
} from './GrupoDialogs';
import { GrupoFormModal } from './GrupoFormModal';
import { cuerpoGrupo, gruposApi } from './grupos-api';
import type { CatalogosGrupo, GrupoDetalle, GrupoForm, Integrante } from './grupos.models';
import './grupos.scss';

type Dialogo =
  | { tipo: 'editar' }
  | { tipo: 'estado'; estado: 'CERRADO' | 'CANCELADO' }
  | { tipo: 'eliminar' }
  | { tipo: 'reactivar' }
  | { tipo: 'encargado' }
  | { tipo: 'quitar-encargado' }
  | { tipo: 'agregar' }
  | { tipo: 'baja'; integrante: Integrante }
  | null;

const dmy = (iso: string | null | undefined) => (iso ? formatoFecha(`${iso.slice(0, 10)}T00:00:00`, 'dd/MM/yyyy') : '');
const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function GrupoDetallePage() {
  const { id } = useParams();
  const grupoId = Number(id);
  const navegar = useNavigate();
  const notificar = useNotificar();
  const { tienePermiso } = useAuth();
  const puedeGestionar = tienePermiso('formation.manage_groups');
  const puedeIntegrantes = puedeGestionar && tienePermiso('formation.manage_people');
  const puedeSeguimiento = tienePermiso('tracking.view');
  const puedeUsuarios = tienePermiso('users.manage');

  const [grupo, setGrupo] = useState<GrupoDetalle | null>(null);
  const [error, setError] = useState<{ mensaje: string; noExiste: boolean } | null>(null);
  const [catalogos, setCatalogos] = useState<CatalogosGrupo | null>(null);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [filtro, setFiltro] = useState('');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    try {
      setGrupo(await gruposApi.detalle(grupoId));
      setError(null);
    } catch (err) {
      // «Cannot GET …» = el backend en ejecución no tiene la ruta (versión anterior), no un grupo borrado
      const sinRuta =
        err instanceof HttpError && String(err.error?.message ?? '').startsWith('Cannot ');
      setError({
        mensaje: sinRuta
          ? 'El servidor no reconoce esta función. Reinicie el backend para cargar la versión actual.'
          : mensajeError(err, 'No se pudo cargar el grupo'),
        noExiste: !sinRuta && err instanceof HttpError && (err.status === 404 || err.status === 400),
      });
    }
  }, [grupoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!puedeGestionar) return;
    gruposApi.catalogos().then(setCatalogos).catch(() => setCatalogos(null));
  }, [puedeGestionar]);

  // Menú de acciones: se cierra con clic fuera o Escape
  useEffect(() => {
    if (!menuAbierto) return;
    const fuera = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setMenuAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [menuAbierto]);

  const integrantes = useMemo(() => {
    const t = sinTildes(filtro.trim());
    return (grupo?.integrantes ?? []).filter((i) => !t || sinTildes(`${i.nombreCompleto} ${i.dni ?? ''}`).includes(t));
  }, [grupo, filtro]);

  const cerrarDialogo = useCallback(() => setDialogo(null), []);
  const trasAccion = useCallback(() => {
    setDialogo(null);
    void cargar();
  }, [cargar]);

  async function guardarEdicion(form: GrupoForm): Promise<void> {
    if (!grupo) return;
    const cuerpo = cuerpoGrupo(form);
    // La etapa solo se envía si puede cambiar; el resto, siempre (el backend ignora lo que no cambió)
    const cambios = grupo.etapaEditable ? cuerpo : { ...cuerpo, etapaId: undefined };
    const actualizado = await gruposApi.actualizar(grupo.id, cambios);
    setGrupo(actualizado);
    setDialogo(null);
    notificar.exito('Grupo actualizado', actualizado.nombre);
  }

  if (error && !grupo) {
    return (
      <div className="r21-grupos">
        <Link to="/formacion/grupos" className="r21-volver">
          <i className="pi pi-arrow-left"></i> Grupos
        </Link>
        <div className="r21-card">
          <div className="r21-card-body">
            <EmptyState
              mensaje={error.noExiste ? 'El grupo no existe' : 'No se pudo cargar el grupo'}
              descripcion={error.noExiste ? 'Puede haber sido eliminado.' : error.mensaje}
              icono="pi pi-exclamation-circle"
              accionTexto="Volver a grupos"
              accionRuta="/formacion/grupos"
            />
          </div>
        </div>
      </div>
    );
  }

  if (!grupo) {
    return (
      <div className="r21-grupos">
        <div className="r21-card r21-card-body text-center text-muted">Cargando grupo…</div>
      </div>
    );
  }

  const activo = grupo.estado === 'ACTIVO';
  const gestionable = puedeGestionar && activo;

  return (
    <div className="r21-grupos r21-grupo-detalle">
      <Link to="/formacion/grupos" className="r21-volver">
        <i className="pi pi-arrow-left"></i> Grupos
      </Link>

      <PageHeader titulo={grupo.nombre} subtitulo={`${grupo.codigo} · ${grupo.etapa}`}>
        <StatusBadge estado={grupo.estado} />
        {puedeGestionar && !activo && (
          <button className="btn btn-sm btn-r21" onClick={() => setDialogo({ tipo: 'reactivar' })}>
            <i className="pi pi-replay"></i> Reactivar grupo
          </button>
        )}
        {puedeSeguimiento && activo && (
          <Link to={`/seguimiento?grupo=${grupo.id}`} className="btn btn-sm btn-r21-outline">
            <i className="pi pi-chart-line"></i> Seguimiento
          </Link>
        )}
        {gestionable && (
          <>
            <button className="btn btn-sm btn-r21-outline" onClick={() => setDialogo({ tipo: 'editar' })} disabled={!catalogos}>
              <i className="pi pi-pencil"></i> Editar
            </button>
            <div className="position-relative" ref={menuRef}>
              <button
                className="btn btn-sm btn-r21-outline"
                aria-haspopup="menu"
                aria-expanded={menuAbierto}
                onClick={() => setMenuAbierto(!menuAbierto)}
              >
                Más acciones <i className="pi pi-chevron-down"></i>
              </button>
              {menuAbierto && (
                <div className="r21-menu" role="menu">
                  <button role="menuitem" onClick={() => { setMenuAbierto(false); setDialogo({ tipo: 'estado', estado: 'CERRADO' }); }}>
                    <i className="pi pi-flag"></i> Cerrar grupo (fin del periodo)
                  </button>
                  <button role="menuitem" className="danger" onClick={() => { setMenuAbierto(false); setDialogo({ tipo: 'estado', estado: 'CANCELADO' }); }}>
                    <i className="pi pi-ban"></i> Cancelar grupo
                  </button>
                  {grupo.eliminable && (
                    <>
                      <div className="r21-menu-sep"></div>
                      <button role="menuitem" className="danger" onClick={() => { setMenuAbierto(false); setDialogo({ tipo: 'eliminar' }); }}>
                        <i className="pi pi-trash"></i> Eliminar (creado por error)
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </PageHeader>

      {!activo && (
        <div className="r21-notice">
          <i className="pi pi-lock"></i>
          <div className="r21-notice-body">
            Grupo {grupo.estado === 'CERRADO' ? 'cerrado' : 'cancelado'}
            {grupo.fechaFin ? ` el ${dmy(grupo.fechaFin)}` : ''}. Se conserva como historial de consulta
            {puedeGestionar ? '; puede volver a activarlo con «Reactivar grupo».' : '.'}
          </div>
        </div>
      )}
      {activo && !puedeGestionar && (
        <div className="r21-notice info">
          <i className="pi pi-eye"></i>
          <div className="r21-notice-body">
            <strong>Modo consulta.</strong> Su rol no permite modificar grupos.
          </div>
        </div>
      )}

      <div className="row g-3">
        <div className="col-12 col-lg-8">
          <div className="r21-card mb-3">
            <div className="r21-card-header">
              <h2>
                Integrantes <span className="text-muted fw-normal">({grupo.totalIntegrantes})</span>
              </h2>
              <div className="d-flex gap-2 align-items-center">
                {grupo.integrantes.length > 6 && (
                  <input
                    type="search"
                    className="form-control form-control-sm grupos-filtro-integrantes"
                    placeholder="Filtrar…"
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    aria-label="Filtrar integrantes"
                  />
                )}
                {puedeIntegrantes && activo && (
                  <button className="btn btn-sm btn-r21" onClick={() => setDialogo({ tipo: 'agregar' })}>
                    <i className="pi pi-user-plus"></i> Agregar
                  </button>
                )}
              </div>
            </div>
            {grupo.integrantes.length === 0 ? (
              <div className="r21-card-body">
                <EmptyState
                  compacto
                  mensaje="Sin integrantes activos"
                  descripcion={puedeIntegrantes && activo ? 'Use «Agregar» para incorporar personas de esta etapa.' : ''}
                  icono="pi pi-users"
                />
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Persona</th>
                      <th className="d-none d-sm-table-cell">DNI</th>
                      <th>Ingreso</th>
                      {puedeIntegrantes && activo && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {integrantes.map((i) => (
                      <tr key={i.id}>
                        <td className="fw-semibold">{i.nombreCompleto}</td>
                        <td className="d-none d-sm-table-cell text-muted">{i.dni ?? '—'}</td>
                        <td className="text-nowrap">{dmy(i.fechaIngreso)}</td>
                        {puedeIntegrantes && activo && (
                          <td className="text-end">
                            <button
                              className="btn btn-sm btn-r21-ghost"
                              onClick={() => setDialogo({ tipo: 'baja', integrante: i })}
                              title="Dar de baja"
                            >
                              <i className="pi pi-user-minus"></i>
                              <span className="d-none d-md-inline ms-1">Dar de baja</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {integrantes.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center text-muted small py-3">
                          Sin coincidencias para «{filtro}»
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {grupo.exIntegrantes.length > 0 && (
            <details className="r21-card r21-desplegable">
              <summary className="r21-card-header">
                <h2>
                  Ex integrantes <span className="text-muted fw-normal">({grupo.exIntegrantes.length})</span>
                </h2>
                <i className="pi pi-chevron-down"></i>
              </summary>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Persona</th>
                      <th>Periodo en el grupo</th>
                      <th>Estado</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.exIntegrantes.map((x, n) => (
                      <tr key={`${x.personaId}-${n}`}>
                        <td>{x.nombreCompleto}</td>
                        <td className="text-nowrap small">
                          {dmy(x.fechaIngreso)} – {dmy(x.fechaSalida) || '—'}
                        </td>
                        <td>
                          <StatusBadge estado={x.estado} />
                        </td>
                        <td className="small text-muted">{x.motivo ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>

        <div className="col-12 col-lg-4 d-flex flex-column gap-3">
          <div className="r21-card mb-0">
            <div className="r21-card-header">
              <h2>Encargado</h2>
            </div>
            <div className="r21-card-body">
              {grupo.encargado ? (
                <div className="grupo-encargado">
                  <div className="encargado-avatar">
                    <i className="pi pi-user"></i>
                  </div>
                  <div className="min-w-0">
                    <div className="fw-semibold">{grupo.encargado.nombre}</div>
                    <div className="small text-muted">Desde {formatoFecha(grupo.encargado.desde, 'dd/MM/yyyy')}</div>
                  </div>
                </div>
              ) : activo ? (
                <div className="r21-notice warn">
                  <i className="pi pi-exclamation-triangle"></i>
                  <div className="r21-notice-body">Sin encargado: nadie registra la asistencia desde «Mi grupo».</div>
                </div>
              ) : (
                <span className="text-muted small">Sin encargado activo.</span>
              )}
              {gestionable && (
                <div className="d-flex gap-2 mt-3">
                  <button className="btn btn-sm btn-r21-outline flex-grow-1" onClick={() => setDialogo({ tipo: 'encargado' })}>
                    <i className="pi pi-user-edit"></i> {grupo.encargado ? 'Cambiar' : 'Asignar encargado'}
                  </button>
                  {grupo.encargado && (
                    <button className="btn btn-sm btn-r21-ghost" onClick={() => setDialogo({ tipo: 'quitar-encargado' })} title="Quitar encargado">
                      <i className="pi pi-times"></i>
                      <span className="visually-hidden">Quitar encargado</span>
                    </button>
                  )}
                </div>
              )}
              {grupo.historialEncargados.some((h) => h.estado !== 'ACTIVO') && (
                <details className="grupo-historial mt-3">
                  <summary className="small">Encargados anteriores</summary>
                  <ul className="list-unstyled small mb-0 mt-2 d-flex flex-column gap-2">
                    {grupo.historialEncargados
                      .filter((h) => h.estado !== 'ACTIVO')
                      .map((h, n) => (
                        <li key={n}>
                          <div>{h.nombre}</div>
                          <div className="text-muted">
                            {formatoFecha(h.desde, 'dd/MM/yyyy')} – {formatoFecha(h.hasta, 'dd/MM/yyyy') || '—'}
                            {h.motivo ? ` · ${h.motivo}` : ''}
                          </div>
                        </li>
                      ))}
                  </ul>
                </details>
              )}
            </div>
          </div>

          <div className="r21-card mb-0">
            <div className="r21-card-header">
              <h2>Datos del grupo</h2>
            </div>
            <div className="r21-card-body small">
              <dl className="row mb-0 g-1">
                <dt className="col-5 text-muted fw-normal">Código</dt>
                <dd className="col-7 mb-1">{grupo.codigo}</dd>
                <dt className="col-5 text-muted fw-normal">Etapa</dt>
                <dd className="col-7 mb-1">{grupo.etapa}</dd>
                <dt className="col-5 text-muted fw-normal">Periodo</dt>
                <dd className="col-7 mb-1">{grupo.periodo}</dd>
                <dt className="col-5 text-muted fw-normal">Inicio</dt>
                <dd className="col-7 mb-1">{dmy(grupo.fechaInicio)}</dd>
                <dt className="col-5 text-muted fw-normal">Fin</dt>
                <dd className="col-7 mb-1">{grupo.fechaFin ? dmy(grupo.fechaFin) : <em className="text-muted">Sin definir</em>}</dd>
                <dt className="col-5 text-muted fw-normal">Jornadas abiertas</dt>
                <dd className={cx('col-7 mb-0', grupo.jornadasAbiertas > 0 && 'fw-semibold')}>
                  {grupo.jornadasAbiertas > 0 ? `${grupo.jornadasAbiertas} en curso` : 'Ninguna'}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {gestionable && (
        <>
          <GrupoFormModal
            visible={dialogo?.tipo === 'editar'}
            grupo={grupo}
            catalogos={catalogos}
            onCerrar={cerrarDialogo}
            onGuardar={guardarEdicion}
          />
          <EstadoGrupoDialog
            grupo={grupo}
            estado={dialogo?.tipo === 'estado' ? dialogo.estado : 'CERRADO'}
            visible={dialogo?.tipo === 'estado'}
            onCerrar={cerrarDialogo}
            onHecho={trasAccion}
          />
          <EliminarGrupoDialog
            grupo={grupo}
            visible={dialogo?.tipo === 'eliminar'}
            onCerrar={cerrarDialogo}
            onHecho={() => navegar('/formacion/grupos', { replace: true })}
          />
          <EncargadoDialog
            grupo={grupo}
            visible={dialogo?.tipo === 'encargado'}
            onCerrar={cerrarDialogo}
            onHecho={trasAccion}
            puedeGestionarUsuarios={puedeUsuarios}
          />
          <QuitarEncargadoDialog
            grupo={grupo}
            visible={dialogo?.tipo === 'quitar-encargado'}
            onCerrar={cerrarDialogo}
            onHecho={trasAccion}
          />
        </>
      )}
      {puedeGestionar && !activo && (
        <ReactivarGrupoDialog grupo={grupo} visible={dialogo?.tipo === 'reactivar'} onCerrar={cerrarDialogo} onHecho={trasAccion} />
      )}
      {puedeIntegrantes && activo && (
        <>
          <AgregarIntegranteDialog grupo={grupo} visible={dialogo?.tipo === 'agregar'} onCerrar={cerrarDialogo} onHecho={trasAccion} />
          <BajaIntegranteDialog
            grupo={grupo}
            integrante={dialogo?.tipo === 'baja' ? dialogo.integrante : null}
            visible={dialogo?.tipo === 'baja'}
            onCerrar={cerrarDialogo}
            onHecho={trasAccion}
          />
        </>
      )}
    </div>
  );
}
