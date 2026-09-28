import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Dialog } from 'primereact/dialog';
import { authService } from '../../core/auth/auth.service';
import { HttpError, mensajeError } from '../../core/http/http';
import './login.scss';

const STORAGE_KEY_USER = 'r21_saved_usuario';
const STORAGE_KEY_REMEMBER = 'r21_remember_usuario';

export function LoginPage() {
  const navigate = useNavigate();
  const claveInputRef = useRef<HTMLInputElement>(null);

  const [usuario, setUsuario] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_USER) || '';
  });
  const [clave, setClave] = useState<string>('');
  const [recordar, setRecordar] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY_REMEMBER) === 'true';
  });
  const [verClave, setVerClave] = useState<boolean>(false);
  const [cargando, setCargando] = useState<boolean>(false);
  const [params] = useSearchParams();
  // Motivo del último cierre automático de sesión
  const [error, setError] = useState<string | null>(() => {
    const motivo = params.get('motivo');
    if (motivo === 'inactividad') return 'Su sesión se cerró tras 5 minutos sin uso. Vuelva a ingresar.';
    if (motivo === 'otra-pestana') return 'Se cerró la sesión desde otra pestaña.';
    return null;
  });
  const [mostrarAyuda, setMostrarAyuda] = useState<boolean>(false);

  useEffect(() => {
    document.title = 'Ingresar · Bomberos Rímac 21';
  }, []);

  const completo = usuario.trim() !== '' && clave.trim() !== '';

  async function ingresar(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (cargando || !completo) return;

    setCargando(true);
    setError(null);

    const userClean = usuario.trim();

    try {
      if (recordar) {
        localStorage.setItem(STORAGE_KEY_USER, userClean);
        localStorage.setItem(STORAGE_KEY_REMEMBER, 'true');
      } else {
        localStorage.removeItem(STORAGE_KEY_USER);
        localStorage.removeItem(STORAGE_KEY_REMEMBER);
      }

      await authService.login(userClean, clave);
      navigate('/inicio', { replace: true });
    } catch (err) {
      setError(
        err instanceof HttpError && err.status === 429
          ? 'Demasiados intentos fallidos. Espere un momento antes de volver a intentar.'
          : mensajeError(err, 'Credenciales incorrectas o usuario no autorizado'),
      );
      setClave('');
      setTimeout(() => {
        claveInputRef.current?.focus();
      }, 50);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="r21-login-screen">
      {/* Tarjeta de acceso centrada */}
      <div className="r21-login-card-wrapper">
        <div className="r21-login-card">
          {/* Cabecera institucional de la tarjeta */}
          <div className="card-brand-header">
            <div className="brand-logo-container">
              <img
                src="/assets/brand/logo-192.png"
                alt="Escudo Oficial Bomberos Rímac 21"
                className="brand-logo"
              />
            </div>

            <h1 className="brand-title">Compañía de Bomberos Voluntarios Rímac N.º 21</h1>
            <p className="brand-subtitle">Sistema del Área de Instrucción</p>
          </div>

          {/* Formulario */}
          <form onSubmit={ingresar} noValidate>
            {/* Campo Usuario */}
            <div className="r21-form-group">
              <label htmlFor="usuario" className="field-label">
                <i className="pi pi-user" />
                <span>Usuario</span>
              </label>
              <div className="input-wrapper">
                <i className="pi pi-user input-left-icon" />
                <InputText
                  id="usuario"
                  name="usuario"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="jefe.instruccion o código"
                  autoComplete="username"
                  autoFocus={!usuario}
                  disabled={cargando}
                  required
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div className="r21-form-group">
              <label htmlFor="clave" className="field-label">
                <i className="pi pi-lock" />
                <span>Contraseña</span>
              </label>
              <div className="input-wrapper has-toggle">
                <i className="pi pi-lock input-left-icon" />
                <InputText
                  ref={claveInputRef}
                  id="clave"
                  name="clave"
                  type={verClave ? 'text' : 'password'}
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  autoFocus={Boolean(usuario)}
                  disabled={cargando}
                  required
                />
                <button
                  type="button"
                  className="btn-toggle-password"
                  onClick={() => setVerClave(!verClave)}
                  aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  title={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  tabIndex={-1}
                >
                  <i className={verClave ? 'pi pi-eye-slash' : 'pi pi-eye'} />
                </button>
              </div>
            </div>

            {/* Fila de utilidades: Recordar usuario y ¿Necesita ayuda? */}
            <div className="form-aux-row">
              <label className="remember-wrap" htmlFor="recordar-check">
                <Checkbox
                  inputId="recordar-check"
                  checked={recordar}
                  onChange={(e) => setRecordar(e.checked ?? false)}
                  disabled={cargando}
                />
                <span className="remember-label">Recordar usuario</span>
              </label>

              <button
                type="button"
                className="btn-help-link"
                onClick={() => setMostrarAyuda(true)}
              >
                <i className="pi pi-question-circle" />
                <span>¿Necesita ayuda?</span>
              </button>
            </div>

            {/* Alerta de error */}
            {error && (
              <div className="r21-login-alert" role="alert" aria-live="assertive">
                <i className="pi pi-exclamation-triangle" />
                <span className="alert-msg">{error}</span>
              </div>
            )}

            {/* Botón de ingreso con PrimeReact */}
            <Button
              type="submit"
              className="btn-login-submit"
              disabled={cargando || !completo}
              loading={cargando}
              label={cargando ? 'Ingresando…' : 'Ingresar'}
              icon={!cargando ? 'pi pi-arrow-right' : undefined}
              iconPos="right"
            />
          </form>
        </div>
      </div>

      {/* Modal de Ayuda / Restablecimiento */}
      <Dialog
        header={
          <span>
            <i className="pi pi-info-circle me-2" />
            Asistencia de Acceso al Sistema
          </span>
        }
        visible={mostrarAyuda}
        className="r21-help-dialog"
        style={{ width: '90vw', maxWidth: '460px' }}
        onHide={() => setMostrarAyuda(false)}
        footer={
          <Button
            label="Entendido"
            icon="pi pi-check"
            className="btn-r21"
            onClick={() => setMostrarAyuda(false)}
          />
        }
      >
        <p className="help-intro">
          Si tiene inconvenientes con su usuario, contraseña o necesita acceso al sistema:
        </p>

        <ul className="help-steps">
          <li>
            <i className="pi pi-user-edit" />
            <div>
              <strong>Primer paso:</strong> Debe indicar y coordinar con su <strong>Jefe de Instrucción</strong> o con su <strong>Adjunto del Área de Instrucción</strong>.
            </div>
          </li>
          <li>
            <i className="pi pi-exclamation-circle" />
            <div>
              <strong>En caso de no obtener respuesta:</strong> Si nadie hace caso, comuníquese directamente al número:
            </div>
          </li>
        </ul>

        <div className="help-whatsapp-card">
          <div className="whatsapp-info">
            <span className="whatsapp-label">Soporte directo vía WhatsApp:</span>
            <span className="whatsapp-number">902 663 093</span>
          </div>
          <a
            href="https://wa.me/51902663093?text=Hola,%20necesito%20asistencia%20para%20acceder%20al%20Sistema%20del%20%C3%81rea%20de%20Instrucci%C3%B3n%20R-21"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-whatsapp"
          >
            <i className="pi pi-whatsapp" />
            <span>Hablar por WhatsApp</span>
          </a>
        </div>
      </Dialog>
    </div>
  );
}
