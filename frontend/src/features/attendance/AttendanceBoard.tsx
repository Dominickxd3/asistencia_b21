import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '../../shared/components/EmptyState';
import { cx } from '../../shared/utils/format';
import type { JornadaItem, PizarraItem, SolicitudAccion } from './attendance.models';
import { MemberRow } from './MemberRow';
import './attendance.scss';

interface Props {
  jornada: JornadaItem;
  jornadas: JornadaItem[];
  jornadaId: number | null;
  onSeleccionarJornada: (id: number) => void;
  items: PizarraItem[];
  procesandoId?: number | null;
  puedeRegistrar?: boolean;
  puedeAjustar?: boolean;
  puedeAnular?: boolean;
  abriendo?: boolean;
  onAccion: (sol: SolicitudAccion) => void;
  onAbrirScanner?: () => void;
  onAbrirCredenciales?: (personaId?: number | null) => void;
}

const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function AttendanceBoard({
  jornada,
  jornadas,
  jornadaId,
  onSeleccionarJornada,
  items,
  procesandoId = null,
  puedeRegistrar = false,
  puedeAjustar = false,
  puedeAnular = false,
  onAccion,
  onAbrirScanner,
  onAbrirCredenciales,
}: Props) {
  // Estado del selector dropdown enriquecido de jornadas
  const [dropdownAbierto, setDropdownAbierto] = useState(false);
  const [filtroJornada, setFiltroJornada] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const abierta = jornada.estado === 'ABIERTA';
  const cerrada = jornada.estado === 'CERRADA';
  const programada = jornada.estado === 'PROGRAMADA';
  const obligatoria = jornada.tipoJornada === 'OBLIGATORIA';

  // Cerrar dropdown al hacer clic fuera o presionar Escape
  useEffect(() => {
    if (!dropdownAbierto) return;
    const alClic = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setDropdownAbierto(false);
      }
    };
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownAbierto(false);
    };
    document.addEventListener('mousedown', alClic);
    document.addEventListener('keydown', alTecla);
    return () => {
      document.removeEventListener('mousedown', alClic);
      document.removeEventListener('keydown', alTecla);
    };
  }, [dropdownAbierto]);

  // Agrupar jornadas por grupo para vincular directamente con los grupos existentes (evitando duplicar nombres)
  const grupos = useMemo(() => {
    const mapa = new Map<
      number,
      {
        grupoId: number;
        nombre: string;
        etapa: string;
        jornadas: JornadaItem[];
        jornadaActiva: JornadaItem;
        abierta: boolean;
      }
    >();
    for (const j of jornadas) {
      let g = mapa.get(j.grupoId);
      if (!g) {
        g = {
          grupoId: j.grupoId,
          nombre: j.grupo,
          etapa: j.etapa,
          jornadas: [],
          jornadaActiva: j,
          abierta: false,
        };
        mapa.set(j.grupoId, g);
      }
      g.jornadas.push(j);
      if (j.estado === 'ABIERTA') g.abierta = true;
      if (j.id === jornadaId) {
        g.jornadaActiva = j;
      }
    }
    return Array.from(mapa.values());
  }, [jornadas, jornadaId]);

  const gruposFiltrados = useMemo(() => {
    const q = normalizar(filtroJornada.trim());
    if (!q) return grupos;
    return grupos.filter(
      (g) =>
        normalizar(g.nombre).includes(q) ||
        normalizar(g.etapa).includes(q),
    );
  }, [grupos, filtroJornada]);

  return (
    <div className="r21-attendance-board-v2">
      {/* 1. Selector de Grupo Enriquecido (Dropdown con Búsqueda Escalable) */}
      <section className="r21-jornada-dropdown-banner" aria-label="Grupo y jornada seleccionada">
        <div className="banner-kicker-row">
          <span className="banner-kicker">REGISTRO DISPONIBLE</span>
          <span className="banner-kicker-hint">
            {grupos.length > 1
              ? 'Haz clic en el grupo para seleccionar otro grupo de formación'
              : 'Grupo activo para el día'}
          </span>
        </div>

        <div className="banner-body-row">
          {/* Botón trigger del selector desplegable */}
          <div className="jornada-selector-dropdown-wrapper" ref={dropdownRef}>
            <button
              type="button"
              className={cx('btn-jornada-dropdown-trigger', dropdownAbierto && 'activo')}
              onClick={() => setDropdownAbierto(!dropdownAbierto)}
              aria-haspopup="listbox"
              aria-expanded={dropdownAbierto}
              title={grupos.length > 1 ? 'Haz clic para seleccionar otro grupo' : undefined}
            >
              <div className="trigger-icon-box">
                <i className="pi pi-users" />
              </div>

              <div className="trigger-text-details">
                <div className="trigger-title-row">
                  <h2 className="trigger-grupo-name">{jornada.grupo}</h2>
                  <span
                    className={cx(
                      'trigger-status-badge',
                      abierta ? 'abierta' : programada ? 'programada' : 'cerrada',
                    )}
                  >
                    <span className="badge-bullet" />
                    {abierta ? 'En curso' : programada ? 'Programada' : 'Cerrada'}
                  </span>
                </div>

                <div className="trigger-sub-details">
                  <span className="sub-type">
                    {obligatoria ? 'Participación obligatoria' : 'Participación voluntaria'}
                  </span>
                  <span className="sub-sep">·</span>
                  <span className="sub-hours">
                    {jornada.horaInicio
                      ? obligatoria
                        ? `${jornada.horaInicio} · salida libre hasta las 23:59`
                        : `${jornada.horaInicio} – ${jornada.horaFin ?? 'salida libre'}`
                      : 'Disponible todo el día · no genera faltas'}
                  </span>
                </div>
              </div>

              {grupos.length > 1 && (
                <div className="trigger-chevron">
                  <span className="chevron-label">Cambiar grupo ({grupos.length})</span>
                  <i className={cx('pi', dropdownAbierto ? 'pi-chevron-up' : 'pi-chevron-down')} />
                </div>
              )}
            </button>

            {/* Menú desplegable flotante con buscador para seleccionar entre los grupos únicos */}
            {dropdownAbierto && (
              <div className="jornada-dropdown-popover" role="listbox">
                {grupos.length > 3 && (
                  <div className="dropdown-search-container">
                    <i className="pi pi-search search-icon" />
                    <input
                      type="search"
                      placeholder="Buscar grupo de formación…"
                      value={filtroJornada}
                      onChange={(e) => setFiltroJornada(e.target.value)}
                      autoFocus
                    />
                    {filtroJornada && (
                      <button
                        type="button"
                        onClick={() => setFiltroJornada('')}
                        className="btn-clear-filter"
                        aria-label="Limpiar búsqueda"
                      >
                        <i className="pi pi-times" />
                      </button>
                    )}
                  </div>
                )}

                <div className="dropdown-scrollable-list">
                  {gruposFiltrados.length === 0 ? (
                    <div className="dropdown-no-results">
                      No se encontró ningún grupo que coincida con "{filtroJornada}".
                    </div>
                  ) : (
                    gruposFiltrados.map((g) => {
                      const esSeleccionado = g.grupoId === jornada.grupoId;
                      // Selección inteligente según horario de citación o voluntaria
                      const ahora = new Date().toTimeString().slice(0, 5);
                      const obligatoria = g.jornadas.find(
                        (j) => j.tipoJornada === 'OBLIGATORIA' && j.estado !== 'CANCELADA',
                      );
                      let elegida = g.jornadas[0];
                      if (obligatoria && obligatoria.horaInicio) {
                        const [h] = obligatoria.horaInicio.split(':').map(Number);
                        const umbral = `${String(Math.max(0, h - 1)).padStart(2, '0')}:30`;
                        if (ahora >= umbral) {
                          elegida = obligatoria;
                        } else {
                          const voluntaria = g.jornadas.find(
                            (j) => j.tipoJornada === 'VOLUNTARIA' && j.estado !== 'CANCELADA',
                          );
                          elegida = voluntaria ?? obligatoria;
                        }
                      } else {
                        elegida = g.jornadas.find((j) => j.estado === 'ABIERTA') ?? g.jornadas[0];
                      }

                      return (
                        <button
                          key={g.grupoId}
                          type="button"
                          role="option"
                          aria-selected={esSeleccionado}
                          className={cx(
                            'dropdown-jornada-row',
                            esSeleccionado && 'seleccionada',
                          )}
                          onClick={() => {
                            if (elegida) onSeleccionarJornada(elegida.id);
                            setDropdownAbierto(false);
                            setFiltroJornada('');
                          }}
                        >
                          <div className="row-icon-box">
                            <i className="pi pi-users" />
                          </div>

                          <div className="row-info-col">
                            <span className="row-group-title">{g.nombre}</span>
                            <span className="row-sub-text">
                              {g.etapa}
                              {g.jornadas[0]?.horaInicio
                                ? g.jornadas[0].tipoJornada === 'OBLIGATORIA'
                                  ? ` · entrada ${g.jornadas[0].horaInicio} · salida libre`
                                  : ` · ${g.jornadas[0].horaInicio} – ${g.jornadas[0].horaFin ?? 'salida libre'}`
                                : ''}
                            </span>
                          </div>

                          <div className="row-status-col">
                            <span
                              className={cx(
                                'row-pill-badge',
                                g.abierta
                                  ? 'abierta'
                                  : g.jornadas.every((j) => j.estado === 'CERRADA')
                                    ? 'cerrada'
                                    : 'programada',
                              )}
                            >
                              {g.abierta
                                ? 'En curso'
                                : g.jornadas.every((j) => j.estado === 'CERRADA')
                                  ? 'Cerrada'
                                  : 'Programada'}
                            </span>
                            {esSeleccionado && (
                              <i className="pi pi-check row-check-icon" aria-hidden="true" />
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="banner-right-actions" />
        </div>
      </section>

      {jornada.estado === 'CERRADA' && (
        <div className="r21-jornada-notice closed">
          <i className="pi pi-lock" />
          <div className="notice-content">
            <strong>Jornada cerrada.</strong> Solo se pueden registrar observaciones o corregir
            movimientos existentes.
          </div>
        </div>
      )}

      {/* 2. Sección de Integrantes con Tabla */}
      <section className="r21-integrantes-card" aria-label="Listado de integrantes">
        {/* Barra superior de herramientas de la grilla */}
        <div className="integrantes-card-toolbar">
          <div className="toolbar-info">
            <span className="toolbar-title">Integrantes</span>
            <span className="toolbar-count-badge">{items.length}</span>
          </div>

        </div>

        {/* Tabla institucional */}
        <div className="table-responsive-container">
          {items.length === 0 ? (
            <div className="p-4">
              <EmptyState mensaje="El grupo no tiene integrantes asignados" icono="pi pi-users" />
            </div>
          ) : (
            <table className="r21-integrantes-table">
              <thead>
                <tr>
                  <th className="th-integrante">INTEGRANTE</th>
                  <th className="th-entrada">ENTRADA</th>
                  <th className="th-salida">SALIDA</th>
                  <th className="th-duracion">DURACIÓN</th>
                  <th className="th-estado">ESTADO</th>
                  <th className="th-accion">ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <MemberRow
                    key={item.personaId}
                    item={item}
                    abierta={!cerrada}
                    obligatoria={obligatoria}
                    procesando={procesandoId === item.personaId}
                    bloqueada={procesandoId !== null && procesandoId !== item.personaId}
                    puedeRegistrar={puedeRegistrar}
                    puedeAjustar={puedeAjustar}
                    puedeAnular={puedeAnular}
                    onAccion={onAccion}
                    onEscanearQr={onAbrirScanner ? () => onAbrirScanner() : undefined}
                    onVerQr={onAbrirCredenciales ? (pId) => onAbrirCredenciales(pId) : undefined}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
