import { useEffect, useRef, useState } from 'react';
import { GeoBadge } from '../../shared/components/GeoBadge';
import { cx, formatoFecha, iniciales, calcularDuracion } from '../../shared/utils/format';
import type { AccionFila, PizarraItem, SolicitudAccion } from './attendance.models';

interface OpcionAccion {
  accion: AccionFila;
  texto: string;
  icono: string;
  peligro?: boolean;
}

interface Props {
  item: PizarraItem;
  abierta: boolean;
  obligatoria: boolean;
  procesando?: boolean;
  bloqueada?: boolean;
  puedeRegistrar?: boolean;
  puedeAjustar?: boolean;
  puedeAnular?: boolean;
  onAccion: (sol: SolicitudAccion) => void;
  onEscanearQr?: (item: PizarraItem) => void;
  onVerQr?: (personaId: number) => void;
}

const CON_REGISTRO = [
  'PRESENTE',
  'FINALIZADO',
  'FALTA_JUSTIFICADA',
  'FALTA_INJUSTIFICADA',
  'SALIDA_ANTICIPADA',
];

function accionPrincipal(estado: string | null, cerrada: boolean = false): OpcionAccion | null {
  if (cerrada) return null;
  if (!estado || estado === 'PENDIENTE') {
    return { accion: 'entrada', texto: 'Entrada', icono: 'pi pi-sign-in' };
  }
  if (estado === 'PRESENTE') {
    return { accion: 'salida', texto: 'Salida', icono: 'pi pi-sign-out' };
  }
  return null;
}

function opcionesMenu(
  estado: string | null,
  abierta: boolean,
  obligatoria: boolean,
  puedeAjustar: boolean,
  puedeAnular: boolean,
  tieneObservacion: boolean,
) {
  const ops: OpcionAccion[] = [];
  const sinRegistro = !estado || estado === 'PENDIENTE';

  if (sinRegistro) {
    if (abierta) {
      ops.push({ accion: 'hora-manual', texto: 'Modificar horas', icono: 'pi pi-clock' });
      if (obligatoria) {
        ops.push({
          accion: 'falta-justificada',
          texto: 'Registrar falta justificada',
          icono: 'pi pi-file-edit',
        });
      }
    }
  } else if (estado && CON_REGISTRO.includes(estado)) {
    ops.push({
      accion: 'observacion',
      texto: tieneObservacion ? 'Editar observación' : 'Agregar observación',
      icono: 'pi pi-comment',
    });

    if (abierta && estado === 'PRESENTE') {
      ops.push({ accion: 'salida-anticipada', texto: 'Salida anticipada', icono: 'pi pi-directions' });
    }

    if (puedeAjustar && estado !== 'FALTA_JUSTIFICADA' && estado !== 'FALTA_INJUSTIFICADA') {
      ops.push({ accion: 'ajustar', texto: 'Modificar horas', icono: 'pi pi-clock' });
    }

    if (puedeAnular) {
      ops.push({
        accion: 'anular',
        texto: 'Anular registro',
        icono: 'pi pi-times-circle',
        peligro: true,
      });
    }
  }

  // Opciones de QR siempre accesibles
  ops.push({
    accion: 'ver-qr' as AccionFila,
    texto: 'Ver credencial QR',
    icono: 'pi pi-qrcode',
  });
  if (abierta) {
    ops.push({
      accion: 'escanear-qr' as AccionFila,
      texto: 'Escanear QR con cámara',
      icono: 'pi pi-camera',
    });
  }

  return ops;
}

function obtenerBadgeEstado(estado: string | null, obligatoria: boolean) {
  switch (estado) {
    case 'FINALIZADO':
      return { texto: 'Finalizado', clase: 'pill-finalizado' };
    case 'PRESENTE':
      return { texto: 'En cuartel', clase: 'pill-presente' };
    case 'SALIDA_ANTICIPADA':
      return { texto: 'Salida anticipada', clase: 'pill-advertencia' };
    case 'FALTA_JUSTIFICADA':
      return { texto: 'Falta justificada', clase: 'pill-justificada' };
    case 'FALTA_INJUSTIFICADA':
      return { texto: 'Falta injustificada', clase: 'pill-injustificada' };
    case 'PENDIENTE':
    default:
      return obligatoria
        ? { texto: 'Pendiente', clase: 'pill-pendiente' }
        : { texto: 'Sin participación', clase: 'pill-neutro' };
  }
}

export function MemberRow({
  item,
  abierta: _abierta,
  obligatoria,
  procesando = false,
  bloqueada = false,
  puedeRegistrar = true,
  puedeAjustar = false,
  puedeAnular = false,
  onAccion,
  onEscanearQr,
  onVerQr,
}: Props) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const contenedorMenu = useRef<HTMLDivElement>(null);

  const ap = puedeRegistrar ? accionPrincipal(item.estado, bloqueada) : null;
  const opciones = puedeRegistrar
    ? opcionesMenu(
        item.estado,
        !bloqueada,
        obligatoria,
        puedeAjustar,
        puedeAnular,
        Boolean(item.observacion),
      )
    : [];

  useEffect(() => {
    if (!menuAbierto) return;
    const alClic = (e: MouseEvent) => {
      if (!contenedorMenu.current?.contains(e.target as Node)) {
        setMenuAbierto(false);
      }
    };
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAbierto(false);
    };
    document.addEventListener('mousedown', alClic);
    document.addEventListener('keydown', alTecla);
    return () => {
      document.removeEventListener('mousedown', alClic);
      document.removeEventListener('keydown', alTecla);
    };
  }, [menuAbierto]);

  function emitir(accion: AccionFila): void {
    setMenuAbierto(false);
    if ((accion as string) === 'escanear-qr') {
      onEscanearQr?.(item);
      return;
    }
    if ((accion as string) === 'ver-qr') {
      onVerQr?.(item.personaId);
      return;
    }
    onAccion({ accion, item });
  }

  const horaEntrada = formatoFecha(item.fechaHoraEntrada, 'HH:mm');
  const horaSalida = formatoFecha(item.fechaHoraSalida, 'HH:mm');
  const duracion = calcularDuracion(item.fechaHoraEntrada, item.fechaHoraSalida);
  const badge = obtenerBadgeEstado(item.estado, obligatoria);

  return (
    <tr className={cx('r21-integrante-row', procesando && 'procesando')}>
      {/* 1. INTEGRANTE */}
      <td className="cell-integrante">
        <div className="integrante-info-wrapper">
          <div className="integrante-avatar" aria-hidden="true">
            {iniciales(item.nombreCompleto)}
          </div>
          <div className="integrante-datos">
            <span className="integrante-nombre">{item.nombreCompleto}</span>
            <div className="integrante-meta-row">
              {item.geoEntrada && item.geoEntrada.estado !== 'SIN_GEOCERCA' && (
                <GeoBadge
                  compacto
                  prefijo="Entrada"
                  estado={item.geoEntrada.estado}
                  precisionMetros={item.geoEntrada.precisionMetros}
                  distanciaMetros={item.geoEntrada.distanciaMetros}
                />
              )}
              {item.geoSalida && item.geoSalida.estado !== 'SIN_GEOCERCA' && (
                <GeoBadge
                  compacto
                  prefijo="Salida"
                  estado={item.geoSalida.estado}
                  precisionMetros={item.geoSalida.precisionMetros}
                  distanciaMetros={item.geoSalida.distanciaMetros}
                />
              )}
              {item.observacion && (
                <span className="integrante-observacion" title={item.observacion}>
                  <i className="pi pi-comment" /> {item.observacion}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* 2. ENTRADA */}
      <td className="cell-entrada">
        <span className={cx('hora-valor', !horaEntrada && 'hora-vacia')}>
          {horaEntrada || '—'}
        </span>
      </td>

      {/* 3. SALIDA */}
      <td className="cell-salida">
        <span className={cx('hora-valor', !horaSalida && 'hora-vacia')}>
          {horaSalida || '—'}
        </span>
      </td>

      {/* 4. DURACIÓN */}
      <td className="cell-duracion">
        <span className={cx('duracion-valor', duracion === '—' && 'duracion-vacia')}>
          {duracion}
        </span>
      </td>

      {/* 5. ESTADO */}
      <td className="cell-estado">
        <span className={cx('r21-pill-badge', badge.clase)}>
          {badge.texto}
        </span>
      </td>

      {/* 6. ACCIÓN */}
      <td className="cell-accion">
        <div className="acciones-container">
          {ap && (
            <button
              type="button"
              className="btn-accion-rapida"
              disabled={procesando || bloqueada}
              onClick={() => emitir(ap.accion)}
              title={ap.texto}
            >
              {procesando ? (
                <span className="spinner-border spinner-border-sm" aria-hidden="true" />
              ) : (
                <i className={ap.icono} />
              )}
              <span>{ap.texto}</span>
            </button>
          )}

          {/* Botón Escanear QR por Cámara */}
          {!bloqueada && puedeRegistrar && onEscanearQr && (
            <button
              type="button"
              className="btn-accion-icono btn-camara-qr"
              onClick={() => onEscanearQr(item)}
              disabled={procesando}
              title="Escanear asistencia por cámara (QR)"
              aria-label={`Escanear QR de ${item.nombreCompleto}`}
            >
              <i className="pi pi-camera" />
            </button>
          )}

          {/* Botón Ver Credencial QR */}
          {onVerQr && (
            <button
              type="button"
              className="btn-accion-icono btn-credencial-qr"
              onClick={() => onVerQr(item.personaId)}
              disabled={procesando || bloqueada}
              title="Ver credencial QR"
              aria-label={`Ver credencial QR de ${item.nombreCompleto}`}
            >
              <i className="pi pi-qrcode" />
            </button>
          )}

          {opciones.length > 0 && (
            <div className="menu-contextual-anchor" ref={contenedorMenu}>
              <button
                type="button"
                className={cx('btn-opciones-dots', menuAbierto && 'activo')}
                onClick={() => setMenuAbierto(!menuAbierto)}
                disabled={bloqueada || procesando}
                aria-label={`Acciones para ${item.nombreCompleto}`}
                aria-haspopup="menu"
                aria-expanded={menuAbierto}
              >
                <i className="pi pi-ellipsis-v" />
              </button>

              {menuAbierto && (
                <div className="r21-action-popover" role="menu">
                  {opciones.map((op) => (
                    <button
                      key={op.accion}
                      type="button"
                      role="menuitem"
                      className={cx('action-popover-item', op.peligro && 'danger-item')}
                      onClick={() => emitir(op.accion)}
                    >
                      <i className={op.icono} />
                      <span>{op.texto}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
