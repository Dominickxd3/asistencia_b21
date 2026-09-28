import { useEffect, useId, useRef, useState } from 'react';
import { Modal } from '../../shared/components/Modal';

export interface EscaneoResultado {
  accion: 'ENTRADA' | 'SALIDA';
  nombreCompleto: string;
  detalle?: string;
}

interface Props {
  visible: boolean;
  jornada?: string;
  onCerrar: () => void;
  onEscaneado: (contenido: string) => Promise<EscaneoResultado>;
}

export function QrScannerDialog({ visible, onCerrar, onEscaneado }: Props) {
  const reactId = useId();
  const lectorId = `lector-qr-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [procesando, setProcesando] = useState(false);
  const [ultimoRegistro, setUltimoRegistro] = useState<EscaneoResultado | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const ocupado = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setUltimoRegistro(null);
    setMensajeError(null);

    if (!window.isSecureContext) {
      setMensajeError(
        'La cámara y la geolocalización requieren un contexto seguro (HTTPS o localhost).',
      );
      return;
    }

    let desmontado = false;
    let lector: import('html5-qrcode').Html5Qrcode | null = null;
    void import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (desmontado) return;
      const scanner = new Html5Qrcode(lectorId, false);
      lector = scanner;
      return scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
        async (contenido) => {
          if (ocupado.current || desmontado) return;
          ocupado.current = true;
          setProcesando(true);
          setMensajeError(null);

          try {
            scanner.pause(true);
            const resultado = await onEscaneado(contenido);
            setUltimoRegistro(resultado);
            setMensajeError(null);
          } catch (error) {
            setMensajeError(
              error instanceof Error ? error.message : 'No se pudo procesar el código QR',
            );
          } finally {
            setProcesando(false);
            window.setTimeout(() => {
              ocupado.current = false;
              if (!desmontado) {
                try {
                  scanner.resume();
                } catch {
                  // Diálogo cerrado durante la pausa
                }
              }
            }, 1800);
          }
        },
        () => undefined,
      );
    }).catch((error) => {
        if (desmontado) return;
        const detalle = error instanceof Error ? error.message : String(error);
        setMensajeError(
          `No se pudo iniciar la cámara. Verifique los permisos del navegador. (${detalle})`,
        );
      });

    return () => {
      desmontado = true;
      ocupado.current = false;
      if (!lector) return;
      void lector.stop()
        .catch(() => undefined)
        .then(() => {
          try {
            lector?.clear();
          } catch {
            // Ignorar
          }
        });
    };
  }, [visible, lectorId, onEscaneado]);

  return (
    <Modal
      titulo="Escanear asistencia por cámara (QR)"
      visible={visible}
      onCerrar={onCerrar}
      bloqueado={procesando}
      ancho="md"
    >
      <div className="r21-qr-scanner-centered">
        {/* Mensaje simple */}
        <p className="scanner-simple-msg text-muted text-center mb-1">
          Muestra el código QR frente a la cámara para registrar asistencia.
        </p>

        {/* Notificación de registro exitoso en tiempo real */}
        {ultimoRegistro && !procesando && (
          <div
            className={`scanner-result-notification ${
              ultimoRegistro.accion === 'ENTRADA' ? 'notif-entrada' : 'notif-salida'
            }`}
            role="status"
          >
            <div className="notif-icon-box">
              <i
                className={`pi ${
                  ultimoRegistro.accion === 'ENTRADA' ? 'pi-sign-in' : 'pi-sign-out'
                }`}
              />
            </div>
            <div className="notif-text-col">
              <span className="notif-action-tag">
                {ultimoRegistro.accion === 'ENTRADA'
                  ? '✓ Entrada registrada'
                  : '✓ Salida registrada'}
              </span>
              <strong className="notif-person-name">{ultimoRegistro.nombreCompleto}</strong>
              {ultimoRegistro.detalle && (
                <span className="notif-sub-detail">{ultimoRegistro.detalle}</span>
              )}
            </div>
          </div>
        )}

        {/* Visor de Cámara centrado */}
        <div className="scanner-viewport-wrapper">
          <div id={lectorId} className="r21-qr-reader" />
        </div>

        {/* Estado de procesamiento */}
        {procesando && (
          <div className="r21-notice info mt-2 justify-content-center text-center">
            <span className="spinner-border spinner-border-sm me-2" />
            <span>Validando ubicación GPS y registrando asistencia…</span>
          </div>
        )}

        {/* Mensaje de error */}
        {mensajeError && !procesando && (
          <div className="r21-notice warn mt-2 justify-content-center text-center" role="alert">
            <i className="pi pi-exclamation-triangle me-2" />
            <span>{mensajeError}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
