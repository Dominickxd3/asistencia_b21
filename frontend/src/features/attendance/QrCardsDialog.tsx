import { useEffect, useState } from 'react';
import { Modal } from '../../shared/components/Modal';
import { EmptyState } from '../../shared/components/EmptyState';
import { mensajeError } from '../../core/http/http';
import { attendanceApi } from './attendance-api';
import type { CredencialQr } from './attendance.models';

interface Props {
  visible: boolean;
  grupoId: number | null;
  grupo: string;
  personaIdFiltro?: number | null;
  onCerrar: () => void;
}

export function QrCardsDialog({
  visible,
  grupoId,
  grupo,
  personaIdFiltro = null,
  onCerrar,
}: Props) {
  const [credenciales, setCredenciales] = useState<CredencialQr[]>([]);
  const [cargando, setCargando] = useState(false);
  const [rotando, setRotando] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [filtroIndividual, setFiltroIndividual] = useState<number | null>(personaIdFiltro);

  useEffect(() => {
    setFiltroIndividual(personaIdFiltro);
  }, [personaIdFiltro, visible]);

  useEffect(() => {
    if (!visible || !grupoId) return;
    let vigente = true;
    setCargando(true);
    setError(null);
    attendanceApi
      .credencialesQr(grupoId)
      .then((r) => vigente && setCredenciales(r))
      .catch((err) =>
        vigente && setError(mensajeError(err, 'No se pudieron cargar las credenciales QR')),
      )
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [visible, grupoId, version]);

  async function rotar(c: CredencialQr): Promise<void> {
    if (!grupoId || rotando !== null) return;
    setRotando(c.personaId);
    setError(null);
    try {
      await attendanceApi.rotarQr(grupoId, c.personaId);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo renovar el QR'));
    } finally {
      setRotando(null);
    }
  }

  const credencialesAMostrar = filtroIndividual
    ? credenciales.filter((c) => c.personaId === filtroIndividual)
    : credenciales;

  const esIndividual = Boolean(filtroIndividual && credencialesAMostrar.length === 1);

  const tituloModal = esIndividual
    ? `Credencial QR · ${credencialesAMostrar[0].nombreCompleto}`
    : `Credenciales QR · ${grupo}`;

  return (
    <Modal
      titulo={tituloModal}
      visible={visible}
      onCerrar={onCerrar}
      ancho={esIndividual ? 'md' : 'lg'}
      bloqueado={rotando !== null}
      acciones={
        <div className="d-flex align-items-center justify-content-between w-100 gap-2">
          {esIndividual ? (
            <button
              type="button"
              className="btn btn-sm btn-r21-outline no-print"
              onClick={() => setFiltroIndividual(null)}
            >
              <i className="pi pi-users" /> Ver todo el grupo ({credenciales.length})
            </button>
          ) : (
            <div />
          )}

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-r21-outline"
              onClick={onCerrar}
              disabled={rotando !== null}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="btn btn-sm btn-r21"
              onClick={() => window.print()}
              disabled={cargando || credencialesAMostrar.length === 0}
            >
              <i className="pi pi-print" />{' '}
              {esIndividual ? 'Imprimir credencial' : 'Imprimir credenciales'}
            </button>
          </div>
        </div>
      }
    >
      <div className="r21-qr-dialog-content text-center">
        <p className="small text-muted mb-3 no-print text-center mx-auto">
          {esIndividual
            ? 'Credencial individual para el registro de asistencia en la Compañía Rímac N.º 21.'
            : 'Cada QR identifica a una persona. Renovarlo invalida inmediatamente la credencial anterior.'}
        </p>

        {error && (
          <div className="r21-notice warn mb-3 no-print justify-content-center" role="alert">
            <i className="pi pi-exclamation-triangle" />
            <div className="r21-notice-body">{error}</div>
          </div>
        )}

        {cargando ? (
          <div className="text-center text-muted py-4">
            <span className="spinner-border spinner-border-sm me-2" />
            Cargando credenciales…
          </div>
        ) : credencialesAMostrar.length === 0 ? (
          <EmptyState
            compacto
            mensaje="No se encontraron credenciales para mostrar"
            icono="pi pi-qrcode"
          />
        ) : esIndividual ? (
          /* Vista individual perfectamente centrada */
          <div className="r21-qr-single-container">
            {credencialesAMostrar.map((c) => (
              <article className="r21-qr-card individual" key={c.personaId}>
                <div className="qr-image-box">
                  <img src={c.imagen} alt={`QR de ${c.nombreCompleto}`} />
                </div>
                <strong className="qr-card-name">{c.nombreCompleto}</strong>
                <span className="qr-card-dni">
                  {c.dni ? `DNI ${c.dni}` : `Código ${c.personaId}`}
                </span>
                <small className="qr-card-unit">ASISTENCIA RÍMAC 21</small>
                <div className="r21-qr-card-actions no-print">
                  <a
                    className="btn btn-sm btn-r21-outline"
                    href={c.imagen}
                    download={`QR-${c.nombreCompleto.replace(/\s+/g, '-')}.png`}
                  >
                    <i className="pi pi-download" /> Descargar
                  </a>
                  <button
                    type="button"
                    className="btn btn-sm btn-r21-outline"
                    onClick={() => void rotar(c)}
                    disabled={rotando !== null}
                  >
                    {rotando === c.personaId ? (
                      <span className="spinner-border spinner-border-sm" />
                    ) : (
                      <i className="pi pi-refresh" />
                    )}{' '}
                    Renovar
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          /* Vista grupal con grilla centrada */
          <div className="r21-qr-print-area">
            <div className="r21-qr-print-title">
              <strong>Compañía de Bomberos Voluntarios Rímac N.º 21</strong>
              <span>{tituloModal}</span>
            </div>
            <div className="r21-qr-cards-grid">
              {credencialesAMostrar.map((c) => (
                <article className="r21-qr-card" key={c.personaId}>
                  <div className="qr-image-box">
                    <img src={c.imagen} alt={`QR de ${c.nombreCompleto}`} />
                  </div>
                  <strong className="qr-card-name">{c.nombreCompleto}</strong>
                  <span className="qr-card-dni">
                    {c.dni ? `DNI ${c.dni}` : `Código ${c.personaId}`}
                  </span>
                  <small className="qr-card-unit">ASISTENCIA RÍMAC 21</small>
                  <div className="r21-qr-card-actions no-print">
                    <a
                      className="btn btn-sm btn-r21-outline"
                      href={c.imagen}
                      download={`QR-${c.nombreCompleto.replace(/\s+/g, '-')}.png`}
                    >
                      <i className="pi pi-download" /> Descargar
                    </a>
                    <button
                      type="button"
                      className="btn btn-sm btn-r21-outline"
                      onClick={() => void rotar(c)}
                      disabled={rotando !== null}
                    >
                      {rotando === c.personaId ? (
                        <span className="spinner-border spinner-border-sm" />
                      ) : (
                        <i className="pi pi-refresh" />
                      )}{' '}
                      Renovar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
