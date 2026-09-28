import { Modal } from '../../shared/components/Modal';
import { plural } from '../../shared/utils/format';
import type { ResumenCierre } from './attendance.models';

interface Props {
  visible?: boolean;
  resumen: ResumenCierre | null;
  procesando?: boolean;
  error?: string | null;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/**
 * Cierre de jornada: muestra quiénes quedarán como falta injustificada
 * y a quiénes se les registrará la salida automáticamente.
 */
export function CierreDialog({ visible = false, resumen, procesando = false, error = null, onConfirmar, onCancelar }: Props) {
  const pendientes = resumen?.pendientes ?? [];
  const presentes = resumen?.presentes ?? [];
  const sinCambios = pendientes.length === 0 && presentes.length === 0;

  return (
    <Modal
      titulo="Cerrar jornada"
      visible={visible}
      onCerrar={onCancelar}
      bloqueado={procesando}
      ancho="lg"
      acciones={
        <>
          <button type="button" className="btn btn-sm btn-r21-outline" onClick={onCancelar} disabled={procesando}>
            Cancelar
          </button>
          <button type="button" className="btn btn-sm btn-r21" disabled={procesando || !resumen} onClick={onConfirmar}>
            {procesando && <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>}
            {procesando ? 'Cerrando…' : 'Confirmar cierre'}
          </button>
        </>
      }
    >
      {!resumen && (
        <div className="text-muted small d-flex align-items-center gap-2">
          <span className="spinner-border spinner-border-sm" aria-hidden="true"></span> Revisando registros…
        </div>
      )}

      {resumen && sinCambios && (
        <p className="mb-0">
          {resumen.generaFaltas
            ? 'Todos los integrantes tienen su registro completo. ¿Confirmas el cierre de la jornada?'
            : 'Se cerrará la jornada voluntaria. Las personas sin participación no generan pendientes ni faltas.'}
        </p>
      )}

      {pendientes.length > 0 && (
        <div className="r21-notice warn">
          <i className="pi pi-exclamation-triangle"></i>
          <div className="r21-notice-body">
            <strong>{plural(pendientes.length, 'persona')} sin registro</strong> quedarán como{' '}
            <span className="r21-badge peligro">Falta injustificada</span>
            <ul className="mb-0 mt-2 ps-3">
              {pendientes.map((p) => (
                <li key={p.personaId}>{p.nombreCompleto}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {presentes.length > 0 && (
        <div className="r21-notice info">
          <i className="pi pi-sign-out"></i>
          <div className="r21-notice-body">
            <strong>{plural(presentes.length, 'persona')} en cuartel</strong> sin salida registrada: se
            registrará su salida a la hora de fin de la jornada (o ahora, si aún no termina).
            <ul className="mb-0 mt-2 ps-3">
              {presentes.map((p) => (
                <li key={p.personaId}>{p.nombreCompleto}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {resumen && !sinCambios && (
        <p className="small text-muted mb-0">Esta acción no se puede deshacer desde la pizarra.</p>
      )}

      {error && (
        <div className="r21-notice warn" role="alert">
          <i className="pi pi-exclamation-triangle"></i>
          <div className="r21-notice-body">{error}</div>
        </div>
      )}
    </Modal>
  );
}
