import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '../../shared/components/Modal';
import { cx } from '../../shared/utils/format';

interface Props {
  visible?: boolean;
  titulo?: string;
  etiqueta?: string;
  ayuda?: string;
  textoBoton?: string;
  destructivo?: boolean;
  persona?: string;
  valorInicial?: string;
  procesando?: boolean;
  error?: string | null;
  onConfirmado: (motivo: string) => void;
  onCancelar: () => void;
}

const MINIMO = 3;
const MAXIMO = 500;

/** Diálogo de motivo obligatorio (justificada, salida anticipada, observación, anulación). */
export function MotivoDialog({
  visible = false,
  titulo = 'Motivo',
  etiqueta = 'Motivo',
  ayuda,
  textoBoton = 'Confirmar',
  destructivo = false,
  persona = '',
  valorInicial = '',
  procesando = false,
  error = null,
  onConfirmado,
  onCancelar,
}: Props) {
  const [texto, setTexto] = useState('');

  // Cada vez que se abre, parte del valor inicial
  useEffect(() => {
    if (visible) setTexto(valorInicial);
  }, [visible, valorInicial]);

  const valido = texto.trim().length >= MINIMO;

  function confirmar(e?: FormEvent): void {
    e?.preventDefault();
    if (!valido || procesando) return;
    onConfirmado(texto.trim());
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
          <button
            type="submit"
            form="form-motivo"
            className={cx('btn btn-sm', destructivo ? 'btn-r21-danger' : 'btn-r21')}
            disabled={procesando || !valido}
          >
            {procesando && <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>}
            {procesando ? 'Procesando…' : textoBoton}
          </button>
        </>
      }
    >
      <form id="form-motivo" onSubmit={confirmar} className="d-flex flex-column gap-2">
        {persona && (
          <div>
            <span className="text-muted small">Integrante</span>
            <div className="fw-semibold">{persona}</div>
          </div>
        )}
        <div>
          <label className="form-label fw-semibold small" htmlFor="motivo-texto">
            {etiqueta}
          </label>
          <textarea
            id="motivo-texto"
            className="form-control"
            rows={3}
            maxLength={MAXIMO}
            placeholder="Escribe el motivo…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) confirmar();
            }}
          ></textarea>
          <div className="d-flex justify-content-between small text-muted mt-1">
            <span>{ayuda ?? `Mínimo ${MINIMO} caracteres.`}</span>
            <span>
              {texto.length}/{MAXIMO}
            </span>
          </div>
        </div>
        {error && (
          <div className="r21-notice warn" role="alert">
            <i className="pi pi-exclamation-triangle"></i>
            <div className="r21-notice-body">{error}</div>
          </div>
        )}
      </form>
    </Modal>
  );
}
