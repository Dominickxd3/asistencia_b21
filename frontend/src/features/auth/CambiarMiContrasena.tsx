import { useState, type FormEvent } from 'react';
import { environment } from '../../environments/environment';
import { http, mensajeError } from '../../core/http/http';
import { Modal } from '../../shared/components/Modal';
import { useNotificar } from '../../shared/components/Notificaciones';

/** Cambio de la propia contraseña, desde el menú del perfil */
export function CambiarMiContrasena({ onCerrar }: { onCerrar: () => void }) {
  const notificar = useNotificar();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [ver, setVer] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problema =
    nueva.length > 0 && nueva.length < 8
      ? 'Debe tener al menos 8 caracteres.'
      : repetir && nueva !== repetir
        ? 'Las dos contraseñas nuevas no coinciden.'
        : nueva && nueva === actual
          ? 'La contraseña nueva debe ser distinta de la actual.'
          : null;
  const listo = actual.length > 0 && nueva.length >= 8 && nueva === repetir && problema === null;

  async function guardar(e?: FormEvent): Promise<void> {
    e?.preventDefault();
    if (!listo) return;
    setGuardando(true);
    setError(null);
    try {
      await http.post(`${environment.apiUrl}/auth/cambiar-password`, { actual, nueva });
      notificar.exito('Contraseña cambiada', 'Úsela la próxima vez que entre. Se cerró su sesión en los demás equipos.');
      onCerrar();
    } catch (err) {
      setError(mensajeError(err, 'No se pudo cambiar la contraseña'));
    } finally {
      setGuardando(false);
    }
  }

  const tipo = ver ? 'text' : 'password';
  return (
    <Modal
      titulo="Cambiar mi contraseña"
      visible
      bloqueado={guardando}
      onCerrar={onCerrar}
      acciones={
        <>
          <button type="button" className="btn btn-sm btn-r21-ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button type="button" className="btn btn-sm btn-r21" onClick={() => void guardar()} disabled={!listo || guardando}>
            {guardando ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </>
      }
    >
      <form className="d-flex flex-column gap-3" onSubmit={(e) => void guardar(e)}>
        <div>
          <label className="form-label small fw-semibold" htmlFor="pw-actual">
            Contraseña actual
          </label>
          <div className="input-group input-group-sm">
            <input
              id="pw-actual"
              type={tipo}
              className="form-control"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              autoComplete="current-password"
              disabled={guardando}
            />
            <button type="button" className="btn btn-r21-outline" onClick={() => setVer(!ver)} title={ver ? 'Ocultar' : 'Mostrar'}>
              <i className={ver ? 'pi pi-eye-slash' : 'pi pi-eye'}></i>
            </button>
          </div>
        </div>
        <div>
          <label className="form-label small fw-semibold" htmlFor="pw-nueva">
            Contraseña nueva
          </label>
          <input
            id="pw-nueva"
            type={tipo}
            className="form-control form-control-sm"
            placeholder="Mínimo 8 caracteres"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            autoComplete="new-password"
            disabled={guardando}
          />
        </div>
        <div>
          <label className="form-label small fw-semibold" htmlFor="pw-repetir">
            Repita la contraseña nueva
          </label>
          <input
            id="pw-repetir"
            type={tipo}
            className="form-control form-control-sm"
            value={repetir}
            onChange={(e) => setRepetir(e.target.value)}
            autoComplete="new-password"
            disabled={guardando}
          />
        </div>
        {problema && <div className="small text-danger">{problema}</div>}
        {error && (
          <div className="r21-notice warn" role="alert">
            <i className="pi pi-exclamation-triangle"></i>
            <div className="r21-notice-body">{error}</div>
          </div>
        )}
        {/* Enter en cualquier campo envía el formulario */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
