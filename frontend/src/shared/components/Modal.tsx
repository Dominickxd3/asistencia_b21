import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cx } from '../utils/format';

interface Props {
  titulo: string;
  visible?: boolean;
  onCerrar: () => void;
  /** Botones del pie del diálogo */
  acciones?: ReactNode;
  /** Mientras procesa no se cierra con Escape ni con clic fuera */
  bloqueado?: boolean;
  ancho?: 'md' | 'lg';
  children?: ReactNode;
}

/**
 * Diálogo modal institucional: cierra con Escape o clic fuera, bloquea el
 * scroll de la página y enfoca el primer campo al abrirse.
 */
export function Modal({ titulo, visible = false, onCerrar, acciones, bloqueado = false, ancho = 'md', children }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const tituloId = useId();

  useEffect(() => {
    if (!visible) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const foco = panel.current?.querySelector<HTMLElement>(
      'input:not([type=hidden]):not([disabled]), textarea, select, .r21-modal-body button',
    );
    foco?.focus();
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || bloqueado) return;
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alPresionar);
    return () => document.removeEventListener('keydown', alPresionar);
  }, [visible, bloqueado, onCerrar]);

  if (!visible) return null;
  const cerrar = () => {
    if (!bloqueado) onCerrar();
  };

  return (
    <>
      <div className="r21-modal-backdrop" onClick={cerrar}></div>
      <div className="r21-modal-wrap" onClick={cerrar}>
        <div
          ref={panel}
          className={cx('r21-modal', ancho === 'lg' && 'lg')}
          role="dialog"
          aria-modal="true"
          aria-labelledby={tituloId}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="r21-modal-header">
            <h3 id={tituloId}>{titulo}</h3>
            <button type="button" className="r21-modal-close" aria-label="Cerrar" onClick={cerrar} disabled={bloqueado}>
              <i className="pi pi-times"></i>
            </button>
          </div>
          <div className="r21-modal-body">{children}</div>
          {acciones && <div className="r21-modal-footer">{acciones}</div>}
        </div>
      </div>
    </>
  );
}
