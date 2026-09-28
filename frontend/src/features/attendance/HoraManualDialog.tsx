import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '../../shared/components/Modal';
import { horaActual } from '../../shared/utils/format';
import type { HoraManualResult } from './attendance.models';

interface Props {
  visible?: boolean;
  titulo?: string;
  modoAjuste?: boolean;
  persona?: string;
  /** La jornada es de hoy: las horas no pueden superar la hora actual */
  esHoy?: boolean;
  /** Horas actuales del registro (modo ajuste) en HH:mm */
  entradaActual?: string;
  salidaActual?: string;
  procesando?: boolean;
  error?: string | null;
  onConfirmado: (res: HoraManualResult) => void;
  onCancelar: () => void;
}

/** Diálogo de registro/ajuste con hora manual (requiere motivo). */
export function HoraManualDialog({
  visible = false,
  titulo = 'Hora manual',
  modoAjuste = false,
  persona = '',
  esHoy = true,
  entradaActual = '',
  salidaActual = '',
  procesando = false,
  error = null,
  onConfirmado,
  onCancelar,
}: Props) {
  const [horaEntrada, setHoraEntrada] = useState('');
  const [horaSalida, setHoraSalida] = useState('');
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (!visible) return;
    setHoraEntrada(modoAjuste ? entradaActual : esHoy ? horaActual() : '');
    setHoraSalida(modoAjuste ? salidaActual : '');
    setMotivo('');
  }, [visible, modoAjuste, esHoy, entradaActual, salidaActual]);

  const maximo = esHoy ? horaActual() : undefined;
  const cambioEntrada = modoAjuste ? horaEntrada !== entradaActual : !!horaEntrada;
  const cambioSalida = modoAjuste && horaSalida !== salidaActual;

  // Solo se valida lo que el usuario cambia; las horas ya registradas no se re-evalúan
  let errorLocal: string | null = null;
  if (maximo && cambioEntrada && horaEntrada > maximo) errorLocal = 'La hora de entrada no puede ser futura.';
  else if (maximo && cambioSalida && horaSalida > maximo) errorLocal = 'La hora de salida no puede ser futura.';
  else if (horaEntrada && horaSalida && horaSalida <= horaEntrada)
    errorLocal = 'La salida debe ser posterior a la entrada.';

  const valido =
    (modoAjuste ? cambioEntrada || cambioSalida : !!horaEntrada) &&
    motivo.trim().length >= 3 &&
    !errorLocal;

  function confirmar(e: FormEvent): void {
    e.preventDefault();
    if (!valido || procesando) return;
    onConfirmado({
      horaEntrada: cambioEntrada && horaEntrada ? horaEntrada : undefined,
      horaSalida: cambioSalida && horaSalida ? horaSalida : undefined,
      motivo: motivo.trim(),
    });
  }

  return (
    <Modal
      titulo={titulo}
      visible={visible}
      onCerrar={onCancelar}
      bloqueado={procesando}
      acciones={
        <>
          <button type="button" className="btn btn-sm btn-r21-outline" onClick={onCancelar} disabled={procesando}>
            Cancelar
          </button>
          <button type="submit" form="form-hora-manual" className="btn btn-sm btn-r21" disabled={procesando || !valido}>
            {procesando && <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>}
            {procesando ? 'Procesando…' : modoAjuste ? 'Guardar corrección' : 'Registrar entrada'}
          </button>
        </>
      }
    >
      <form id="form-hora-manual" onSubmit={confirmar} className="d-flex flex-column gap-2">
        {persona && (
          <div>
            <span className="text-muted small">Integrante</span>
            <div className="fw-semibold">{persona}</div>
          </div>
        )}
        <div className="row g-2">
          <div className={modoAjuste ? 'col-6' : 'col-12'}>
            <label className="form-label small fw-semibold" htmlFor="hora-entrada">
              Hora de entrada
            </label>
            <input
              id="hora-entrada"
              type="time"
              className="form-control"
              value={horaEntrada}
              max={maximo}
              onChange={(e) => setHoraEntrada(e.target.value)}
            />
          </div>
          {modoAjuste && (
            <div className="col-6">
              <label className="form-label small fw-semibold" htmlFor="hora-salida">
                Hora de salida
              </label>
              <input
                id="hora-salida"
                type="time"
                className="form-control"
                value={horaSalida}
                max={maximo}
                onChange={(e) => setHoraSalida(e.target.value)}
              />
            </div>
          )}
        </div>
        <div>
          <label className="form-label small fw-semibold" htmlFor="hora-motivo">
            Motivo (obligatorio)
          </label>
          <textarea
            id="hora-motivo"
            className="form-control"
            rows={2}
            maxLength={500}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej.: llegó con el bus de las 19:10 y no se registró"
          ></textarea>
        </div>
        {(errorLocal || error) && (
          <div className="r21-notice warn" role="alert">
            <i className="pi pi-exclamation-triangle"></i>
            <div className="r21-notice-body">{errorLocal ?? error}</div>
          </div>
        )}
      </form>
    </Modal>
  );
}
