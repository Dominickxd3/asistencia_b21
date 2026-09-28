import { useEffect, useState } from 'react';
import { environment } from '../../environments/environment';
import { http, mensajeError } from '../../core/http/http';
import { EmptyState } from '../../shared/components/EmptyState';
import { PageHeader } from '../../shared/components/PageHeader';
import { Modal } from '../../shared/components/Modal';
import { formatoFecha, cx } from '../../shared/utils/format';
import {
  MODULOS_MAP,
  ACCIONES_MAP,
  obtenerModuloInfo,
  obtenerAccionInfo,
  obtenerEntidadInfo,
  formatearIp,
} from './auditoria.labels';

const TAMANO_PAGINA = 25;

interface Filtros {
  modulo: string;
  accion: string;
  desde: string;
  hasta: string;
}

const SIN_FILTROS: Filtros = { modulo: '', accion: '', desde: '', hasta: '' };

function formatJsonValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return val;
    }
  }
  return JSON.stringify(val, null, 2);
}

function parseJsonSafe(val: unknown): any {
  if (!val) return null;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}

function extraerResumenDetalle(r: any): string {
  if (r.descripcion) return r.descripcion;
  if (r.valorNuevo) {
    const obj = parseJsonSafe(r.valorNuevo);
    if (typeof obj === 'object' && obj !== null) {
      const entries = Object.entries(obj).slice(0, 3);
      return entries.map(([k, v]) => `${k}: ${String(v)}`).join(' · ');
    }
    return String(r.valorNuevo).slice(0, 80);
  }
  return '—';
}

export function AuditoriaPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS);
  const [registroDetalle, setRegistroDetalle] = useState<any | null>(null);

  const hayFiltros = Object.values(filtros).some(Boolean);
  const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA));

  function cambiarFiltro(parcial: Partial<Filtros>): void {
    setFiltros((f) => ({ ...f, ...parcial }));
    setPagina(1);
  }

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    const params = new URLSearchParams();
    if (filtros.modulo) params.set('modulo', filtros.modulo);
    if (filtros.accion) params.set('accion', filtros.accion);
    if (filtros.desde) params.set('desde', filtros.desde);
    if (filtros.hasta) params.set('hasta', filtros.hasta);
    params.set('pagina', String(pagina));

    http
      .get<{ items: any[]; total: number }>(`${environment.apiUrl}/audit?${params}`)
      .then((r) => {
        if (!vigente) return;
        setItems(r.items);
        setTotal(r.total);
      })
      .catch((err) => vigente && setError(mensajeError(err, 'No se pudo cargar la auditoría')))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [filtros, pagina]);

  return (
    <>
      <PageHeader
        titulo="Auditoría y Trazabilidad del Sistema"
        subtitulo="Registro cronológico de operaciones, accesos y modificaciones con identificación de entidad e IP"
      />

      {/* Tarjeta de Filtros amigables */}
      <div className="r21-card mb-3">
        <div className="r21-card-body">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-3">
              <label className="form-label small fw-semibold text-secondary" htmlFor="aud-modulo">
                <i className="pi pi-folder me-1"></i> Módulo del sistema
              </label>
              <select
                id="aud-modulo"
                className="form-select form-select-sm"
                value={filtros.modulo}
                onChange={(e) => cambiarFiltro({ modulo: e.target.value })}
              >
                <option value="">Todos los módulos</option>
                {Object.entries(MODULOS_MAP).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-3">
              <label className="form-label small fw-semibold text-secondary" htmlFor="aud-accion">
                <i className="pi pi-bolt me-1"></i> Acción realizada
              </label>
              <select
                id="aud-accion"
                className="form-select form-select-sm"
                value={filtros.accion}
                onChange={(e) => cambiarFiltro({ accion: e.target.value })}
              >
                <option value="">Todas las acciones</option>
                {Object.entries(ACCIONES_MAP).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold text-secondary" htmlFor="aud-desde">
                <i className="pi pi-calendar me-1"></i> Desde
              </label>
              <input
                id="aud-desde"
                type="date"
                className="form-control form-control-sm"
                value={filtros.desde}
                onChange={(e) => cambiarFiltro({ desde: e.target.value })}
              />
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold text-secondary" htmlFor="aud-hasta">
                <i className="pi pi-calendar me-1"></i> Hasta
              </label>
              <input
                id="aud-hasta"
                type="date"
                className="form-control form-control-sm"
                value={filtros.hasta}
                onChange={(e) => cambiarFiltro({ hasta: e.target.value })}
              />
            </div>

            <div className="col-12 col-md-2 d-flex justify-content-md-end align-items-center gap-2">
              {hayFiltros && (
                <button
                  type="button"
                  className="btn btn-sm btn-r21-outline w-100"
                  onClick={() => {
                    setFiltros(SIN_FILTROS);
                    setPagina(1);
                  }}
                  title="Restablecer filtros"
                >
                  <i className="pi pi-filter-slash"></i> Limpiar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tarjeta de Tabla de Auditoría */}
      <div className="r21-card">
        <div className="r21-card-header d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <span className="fw-semibold">Registro de auditoría</span>
            <span className="badge bg-light text-dark border font-monospace">{total} eventos</span>
          </div>
          <span className="small text-muted">Mostrando {TAMANO_PAGINA} eventos por página</span>
        </div>

        <div className="p-0 table-responsive">
          {error ? (
            <div className="r21-card-body">
              <EmptyState mensaje="No se pudo cargar la auditoría" descripcion={error} icono="pi pi-exclamation-circle" />
            </div>
          ) : cargando && items.length === 0 ? (
            <div className="p-4 text-center text-muted">
              <i className="pi pi-spin pi-spinner me-2"></i> Cargando eventos de auditoría…
            </div>
          ) : items.length === 0 ? (
            <div className="r21-card-body">
              <EmptyState mensaje="Sin registros con estos filtros" icono="pi pi-lock" />
            </div>
          ) : (
            <table className="table table-hover align-middle mb-0" style={{ fontSize: '12.5px' }}>
              <thead className="table-light">
                <tr>
                  <th style={{ width: '145px' }}>Fecha y hora</th>
                  <th style={{ minWidth: '130px' }}>Usuario responsable</th>
                  <th style={{ minWidth: '180px' }}>Acción realizada</th>
                  <th style={{ minWidth: '160px' }}>Módulo</th>
                  <th style={{ minWidth: '170px' }}>Registro / Entidad</th>
                  <th style={{ minWidth: '140px' }}>Dirección IP</th>
                  <th>Detalle</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Detalle</th>
                </tr>
              </thead>
              <tbody style={{ opacity: cargando ? 0.6 : 1 }}>
                {items.map((r) => {
                  const moduloInfo = obtenerModuloInfo(r.modulo);
                  const accionInfo = obtenerAccionInfo(r.accion);
                  const entidadInfo = obtenerEntidadInfo(r.entidad);
                  const ipInfo = formatearIp(r.ip);
                  const resumen = extraerResumenDetalle(r);

                  return (
                    <tr key={r.id}>
                      <td className="text-muted text-nowrap">
                        <i className="pi pi-clock me-1 text-secondary" style={{ fontSize: '11px' }}></i>
                        {formatoFecha(r.fechaHora, 'dd/MM/yyyy HH:mm:ss')}
                      </td>
                      <td className="fw-semibold">
                        <div className="d-flex align-items-center gap-1">
                          <i className="pi pi-user text-muted" style={{ fontSize: '11px' }}></i>
                          <span>{r.usuario ?? 'Sistema'}</span>
                        </div>
                      </td>
                      <td>
                        <span className={cx('r21-badge', accionInfo.badge)} title={accionInfo.desc}>
                          <i className={accionInfo.icon}></i>
                          {accionInfo.label}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-1" title={moduloInfo.desc}>
                          <i className={cx(moduloInfo.icon, 'text-secondary')} style={{ fontSize: '12px' }}></i>
                          <span>{moduloInfo.label}</span>
                        </div>
                      </td>
                      <td>
                        <div className="d-flex flex-column" style={{ lineHeight: '1.2' }}>
                          <span className="fw-semibold text-dark d-flex align-items-center gap-1">
                            <i className={cx(entidadInfo.icon, 'text-muted')} style={{ fontSize: '11px' }}></i>
                            {entidadInfo.label}
                          </span>
                          <span
                            className="text-muted font-monospace mt-1"
                            style={{ fontSize: '11px' }}
                          >
                            {r.entidadId ? `ID: #${r.entidadId}` : 'Ámbito global'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className="badge bg-light text-dark border d-inline-flex align-items-center gap-1 font-monospace"
                          style={{ fontSize: '11.5px', padding: '4px 7px' }}
                          title={ipInfo.esLocal ? 'Conexión local' : 'Dirección IP de red'}
                        >
                          <i
                            className={cx(ipInfo.esLocal ? 'pi pi-desktop text-success' : 'pi pi-globe text-primary')}
                            style={{ fontSize: '11px' }}
                          ></i>
                          {ipInfo.ip}
                        </span>
                      </td>
                      <td className="text-truncate" style={{ maxWidth: 220 }} title={resumen}>
                        <span className="text-secondary">{resumen}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-light border py-0 px-2"
                          onClick={() => setRegistroDetalle(r)}
                          title="Inspeccionar todos los detalles de este evento"
                          style={{ fontSize: '11.5px' }}
                        >
                          <i className="pi pi-eye text-primary me-1"></i> Ver
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {total > 0 && (
          <div className="r21-card-footer d-flex justify-content-between align-items-center">
            <button
              className="btn btn-sm btn-r21-outline"
              disabled={pagina <= 1 || cargando}
              onClick={() => setPagina(pagina - 1)}
            >
              <i className="pi pi-chevron-left me-1"></i> Anterior
            </button>
            <span className="small text-muted">
              Página <strong className="text-dark">{pagina}</strong> de {paginas}
            </span>
            <button
              className="btn btn-sm btn-r21-outline"
              disabled={pagina >= paginas || cargando}
              onClick={() => setPagina(pagina + 1)}
            >
              Siguiente <i className="pi pi-chevron-right ms-1"></i>
            </button>
          </div>
        )}
      </div>

      {/* Modal de Detalle Completo de Auditoría */}
      {registroDetalle && (
        <Modal
          titulo="Detalle de Auditoría y Trazabilidad"
          visible={true}
          ancho="lg"
          onCerrar={() => setRegistroDetalle(null)}
          acciones={
            <button
              type="button"
              className="btn btn-sm btn-r21-outline"
              onClick={() => setRegistroDetalle(null)}
            >
              Cerrar
            </button>
          }
        >
          {(() => {
            const r = registroDetalle;
            const accionInfo = obtenerAccionInfo(r.accion);
            const moduloInfo = obtenerModuloInfo(r.modulo);
            const entidadInfo = obtenerEntidadInfo(r.entidad);
            const ipInfo = formatearIp(r.ip);
            const valorAnterior = parseJsonSafe(r.valorAnterior);
            const valorNuevo = parseJsonSafe(r.valorNuevo);

            return (
              <div className="d-flex flex-column gap-3">
                {/* Cabecera del evento */}
                <div
                  className="p-3 rounded border d-flex align-items-center justify-content-between"
                  style={{ backgroundColor: '#F8FAFC' }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <span className={cx('r21-badge', accionInfo.badge, 'fs-6 px-3 py-1')}>
                      <i className={cx(accionInfo.icon, 'me-1')}></i>
                      {accionInfo.label}
                    </span>
                    <span className="text-muted small">| {accionInfo.desc}</span>
                  </div>
                  <span className="text-muted small">
                    <i className="pi pi-clock me-1"></i>
                    {formatoFecha(r.fechaHora, 'dd/MM/yyyy HH:mm:ss')}
                  </span>
                </div>

                {/* Grilla de metadatos */}
                <div className="row g-2">
                  <div className="col-12 col-md-6">
                    <div className="p-2 border rounded bg-white">
                      <span className="text-muted small d-block">Usuario que ejecutó la acción:</span>
                      <strong className="text-dark d-flex align-items-center gap-1 mt-1">
                        <i className="pi pi-user text-primary"></i>
                        {r.usuario ?? 'Sistema automático'}
                      </strong>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="p-2 border rounded bg-white">
                      <span className="text-muted small d-block">Módulo correspondiente:</span>
                      <strong className="text-dark d-flex align-items-center gap-1 mt-1">
                        <i className={cx(moduloInfo.icon, 'text-primary')}></i>
                        {moduloInfo.label}
                      </strong>
                      <span className="small text-muted" style={{ fontSize: '11px' }}>
                        {moduloInfo.desc}
                      </span>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="p-2 border rounded bg-white">
                      <span className="text-muted small d-block">Entidad y registro afectado:</span>
                      <div className="d-flex align-items-center gap-2 mt-1">
                        <strong className="text-dark d-flex align-items-center gap-1">
                          <i className={cx(entidadInfo.icon, 'text-primary')}></i>
                          {entidadInfo.label}
                        </strong>
                        <span className="badge bg-secondary font-monospace">
                          {r.entidadId ? `ID: #${r.entidadId}` : 'Ámbito general'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="p-2 border rounded bg-white">
                      <span className="text-muted small d-block">Dirección IP de conexión:</span>
                      <div className="d-flex align-items-center gap-2 mt-1">
                        <span className="badge bg-light text-dark border font-monospace d-inline-flex align-items-center gap-1">
                          <i
                            className={cx(ipInfo.esLocal ? 'pi pi-desktop text-success' : 'pi pi-globe text-primary')}
                          ></i>
                          {ipInfo.ip}
                        </span>
                        <span className="small text-muted" style={{ fontSize: '11px' }}>
                          {ipInfo.esLocal ? '(Servidor / Dispositivo local)' : '(Red externa)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {r.userAgent && (
                    <div className="col-12">
                      <div className="p-2 border rounded bg-white">
                        <span className="text-muted small d-block">Navegador / Dispositivo (User Agent):</span>
                        <code className="text-secondary small font-monospace d-block mt-1 text-break">
                          {r.userAgent}
                        </code>
                      </div>
                    </div>
                  )}

                  {r.descripcion && (
                    <div className="col-12">
                      <div className="p-2 border rounded bg-white">
                        <span className="text-muted small d-block">Descripción / Motivo registrado:</span>
                        <span className="text-dark mt-1 d-block">{r.descripcion}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Comparación de cambios */}
                {(valorAnterior || valorNuevo) && (
                  <div className="mt-2">
                    <h5 className="fs-6 fw-semibold text-secondary mb-2">
                      <i className="pi pi-sliders-h me-1"></i> Registro de datos modificados
                    </h5>
                    <div className="row g-2">
                      {valorAnterior && (
                        <div className={valorNuevo ? 'col-12 col-md-6' : 'col-12'}>
                          <div className="border rounded overflow-hidden">
                            <div className="bg-light px-3 py-1 border-bottom small fw-semibold text-secondary">
                              <i className="pi pi-history me-1 text-danger"></i> Valor anterior
                            </div>
                            <pre
                              className="p-2 m-0 bg-white small font-monospace overflow-auto"
                              style={{ maxHeight: '200px', fontSize: '11px' }}
                            >
                              {formatJsonValue(valorAnterior)}
                            </pre>
                          </div>
                        </div>
                      )}

                      {valorNuevo && (
                        <div className={valorAnterior ? 'col-12 col-md-6' : 'col-12'}>
                          <div className="border rounded overflow-hidden">
                            <div className="bg-light px-3 py-1 border-bottom small fw-semibold text-secondary">
                              <i className="pi pi-check-circle me-1 text-success"></i> Valor nuevo / Datos registrados
                            </div>
                            <pre
                              className="p-2 m-0 bg-white small font-monospace overflow-auto"
                              style={{ maxHeight: '200px', fontSize: '11px' }}
                            >
                              {formatJsonValue(valorNuevo)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </Modal>
      )}
    </>
  );
}
