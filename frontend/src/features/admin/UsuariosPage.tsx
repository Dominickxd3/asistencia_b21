import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { environment } from '../../environments/environment';
import { useAuth } from '../../core/auth/auth.service';
import { http, mensajeError } from '../../core/http/http';
import { EmptyState } from '../../shared/components/EmptyState';
import { Modal } from '../../shared/components/Modal';
import { useNotificar } from '../../shared/components/Notificaciones';
import { PageHeader } from '../../shared/components/PageHeader';
import { StatusBadge } from '../../shared/components/StatusBadge';
import { cx, formatoFecha } from '../../shared/utils/format';
import { useDebounce } from '../../shared/utils/hooks';
import './usuarios.scss';

const base = `${environment.apiUrl}/users`;

interface Usuario {
  id: number;
  username: string;
  estado: 'ACTIVA' | 'INACTIVA' | 'BLOQUEADA';
  ultimoAcceso: string | null;
  personaId: number;
  nombre: string;
  dni: string | null;
  roles: { codigo: string; nombre: string }[];
  grupos: string[];
}

interface Rol {
  codigo: string;
  nombre: string;
  descripcion: string | null;
}

interface Candidato {
  id: number;
  nombre: string;
  dni: string | null;
  grupo: string | null;
}

interface Credenciales {
  username: string;
  passwordTemporal: string;
}

/** Qué puede hacer cada cargo, en palabras del día a día */
const QUE_HACE: Record<string, string> = {
  ADMIN_SISTEMA: 'Administra el sistema: cuentas, cargos y configuración.',
  JEFE_INSTRUCCION: 'Todo lo de Instrucción, incluido promover de etapa y configurar la sede.',
  SUBJEFE_INSTRUCCION:
    'Ve todos los grupos, registra y corrige asistencia, seguimiento y reportes.',
  ADJUNTO_INSTRUCCION:
    'Ve todos los grupos, registra y corrige asistencia, seguimiento y reportes.',
  ENCARGADO_GRUPO: 'Solo su grupo. Además hay que asignarlo como encargado desde Grupos.',
};

/** Usuario sugerido: nombre.apellido, en minúsculas y sin tildes */
function sugerirUsuario(c: Candidato | null): string {
  if (!c) return '';
  const limpio = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  const partes = c.nombre.split(' ');
  // nombre viene como «Apellido Apellido Nombres»
  const nombre = partes.length >= 3 ? partes[2] : partes[partes.length - 1];
  return `${limpio(nombre)}.${limpio(partes[0])}`;
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="r21-notice warn" role="alert">
      <i className="pi pi-exclamation-triangle"></i>
      <div className="r21-notice-body">{children}</div>
    </div>
  );
}

function SelectorRoles({
  roles,
  elegidos,
  onCambio,
}: {
  roles: Rol[];
  elegidos: string[];
  onCambio: (r: string[]) => void;
}) {
  return (
    <div className="selector-roles">
      {roles.map((r) => {
        const marcado = elegidos.includes(r.codigo);
        return (
          <label key={r.codigo} className={cx('opcion-rol', marcado && 'marcado')}>
            <input
              type="checkbox"
              checked={marcado}
              onChange={() =>
                onCambio(marcado ? elegidos.filter((x) => x !== r.codigo) : [...elegidos, r.codigo])
              }
            />
            <span>
              <span className="fw-semibold">{r.nombre}</span>
              <span className="d-block small text-muted">
                {QUE_HACE[r.codigo] ?? r.descripcion}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

function VerCredenciales({
  titulo,
  texto,
  credenciales,
  onCerrar,
}: {
  titulo: string;
  texto: ReactNode;
  credenciales: Credenciales;
  onCerrar: () => void;
}) {
  const notificar = useNotificar();
  const [copiado, setCopiado] = useState(false);

  async function copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(
        `Usuario: ${credenciales.username}\nContraseña temporal: ${credenciales.passwordTemporal}`,
      );
      setCopiado(true);
    } catch {
      notificar.aviso('No se pudo copiar', 'Anote los datos a mano.');
    }
  }

  return (
    <Modal
      titulo={titulo}
      visible
      onCerrar={onCerrar}
      acciones={
        <button type="button" className="btn btn-sm btn-r21" onClick={onCerrar}>
          Ya los anoté
        </button>
      }
    >
      <div className="d-flex flex-column gap-3">
        <p className="small mb-0">{texto}</p>
        <div className="r21-credenciales">
          <div>
            <span className="etiqueta">Usuario</span>
            <code>{credenciales.username}</code>
          </div>
          <div>
            <span className="etiqueta">Contraseña temporal</span>
            <code>{credenciales.passwordTemporal}</code>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-r21-outline"
            onClick={() => void copiar()}
          >
            <i className={copiado ? 'pi pi-check' : 'pi pi-copy'}></i>{' '}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <Aviso>
          Entrégueselos en persona. Por seguridad, esta contraseña no se volverá a mostrar.
        </Aviso>
      </div>
    </Modal>
  );
}

function NuevaCuenta({
  roles,
  onCerrar,
  onCreada,
}: {
  roles: Rol[];
  onCerrar: () => void;
  onCreada: (c: Credenciales, nombre: string) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const q = useDebounce(busqueda);
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null);
  const [persona, setPersona] = useState<Candidato | null>(null);
  const [username, setUsername] = useState('');
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (persona) return;
    let vigente = true;
    http
      .get<Candidato[]>(`${base}/candidatos`, { params: { q: q || undefined } })
      .then((r) => vigente && setCandidatos(r))
      .catch(
        (err) => vigente && setError(mensajeError(err, 'No se pudo cargar la lista de personas')),
      );
    return () => {
      vigente = false;
    };
  }, [q, persona]);

  function elegir(c: Candidato): void {
    setPersona(c);
    setUsername(sugerirUsuario(c));
    setError(null);
  }

  async function crear(): Promise<void> {
    if (!persona) return;
    setGuardando(true);
    setError(null);
    try {
      const cred = await http.post<Credenciales>(base, {
        personaId: persona.id,
        username,
        roles: elegidos,
      });
      onCreada(cred, persona.nombre);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo crear la cuenta'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo="Nueva cuenta"
      visible
      ancho="lg"
      bloqueado={guardando}
      onCerrar={onCerrar}
      acciones={
        <>
          <button
            type="button"
            className="btn btn-sm btn-r21-ghost"
            onClick={onCerrar}
            disabled={guardando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-sm btn-r21"
            onClick={() => void crear()}
            disabled={!persona || !username || elegidos.length === 0 || guardando}
          >
            {guardando ? 'Creando…' : 'Crear cuenta'}
          </button>
        </>
      }
    >
      <div className="d-flex flex-column gap-3">
        <div>
          <label className="form-label small fw-semibold">1. Persona</label>
          {persona ? (
            <div className="persona-elegida">
              <div>
                <div className="fw-semibold">{persona.nombre}</div>
                <div className="small text-muted">
                  {persona.dni ? `DNI ${persona.dni}` : 'Sin DNI'}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-r21-ghost"
                onClick={() => setPersona(null)}
                disabled={guardando}
              >
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <input
                type="search"
                className="form-control form-control-sm"
                placeholder="Buscar por nombre o DNI…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              <div className="lista-candidatos">
                {candidatos === null ? (
                  <div className="p-3 text-muted small">Cargando…</div>
                ) : candidatos.length === 0 ? (
                  <div className="p-3 text-muted small">
                    No hay personas sin cuenta que coincidan. Si es alguien nuevo, regístrelo
                    primero en Formación → Personas (sin grupo).
                  </div>
                ) : (
                  candidatos.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="candidato"
                      onClick={() => elegir(c)}
                    >
                      <span className="fw-semibold">{c.nombre}</span>
                      <span className="small text-muted">
                        {c.dni ? `DNI ${c.dni}` : 'Sin DNI'}
                        {c.grupo && ` · integrante de ${c.grupo}`}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div className="form-text small">
                Solo aparecen personas activas que aún no tienen cuenta.
              </div>
            </>
          )}
          {persona?.grupo && (
            <div className="mt-2">
              <Aviso>
                {persona.nombre} es integrante de {persona.grupo} (está en formación). Dele un cargo
                solo si también forma parte del personal de Instrucción.
              </Aviso>
            </div>
          )}
        </div>

        {persona && (
          <>
            <div>
              <label className="form-label small fw-semibold" htmlFor="nuevo-usuario">
                2. Usuario para entrar al sistema
              </label>
              <input
                id="nuevo-usuario"
                className="form-control form-control-sm"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                disabled={guardando}
              />
              <div className="form-text small">
                Minúsculas, números, punto o guion. Ejemplo: juan.perez
              </div>
            </div>
            <div>
              <label className="form-label small fw-semibold">3. Cargo</label>
              <SelectorRoles roles={roles} elegidos={elegidos} onCambio={setElegidos} />
            </div>
          </>
        )}

        {error && <Aviso>{error}</Aviso>}
      </div>
    </Modal>
  );
}

function EditarCargos({
  usuario,
  roles,
  onCerrar,
  onGuardado,
}: {
  usuario: Usuario;
  roles: Rol[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [elegidos, setElegidos] = useState(usuario.roles.map((r) => r.codigo));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(): Promise<void> {
    setGuardando(true);
    setError(null);
    try {
      await http.put(`${base}/${usuario.id}/roles`, { roles: elegidos });
      onGuardado();
    } catch (err) {
      setError(mensajeError(err, 'No se pudieron guardar los cargos'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={`Cargos de ${usuario.nombre}`}
      visible
      bloqueado={guardando}
      onCerrar={onCerrar}
      acciones={
        <>
          <button
            type="button"
            className="btn btn-sm btn-r21-ghost"
            onClick={onCerrar}
            disabled={guardando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-sm btn-r21"
            onClick={() => void guardar()}
            disabled={elegidos.length === 0 || guardando}
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <div className="d-flex flex-column gap-3">
        <SelectorRoles roles={roles} elegidos={elegidos} onCambio={setElegidos} />
        <div className="form-text small mt-0">
          Los cambios se aplican en menos de un minuto; la persona verá su nuevo menú al volver a
          entrar.
        </div>
        {error && <Aviso>{error}</Aviso>}
      </div>
    </Modal>
  );
}

function CambiarContrasena({
  usuario,
  onCerrar,
  onHecho,
}: {
  usuario: Usuario;
  onCerrar: () => void;
  onHecho: (c: Credenciales) => void;
}) {
  const [modo, setModo] = useState<'automatica' | 'manual'>('automatica');
  const [password, setPassword] = useState('');
  const [repetir, setRepetir] = useState('');
  const [ver, setVer] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problema =
    modo === 'manual'
      ? password.length < 8
        ? 'Debe tener al menos 8 caracteres.'
        : password !== repetir
          ? 'Las dos contraseñas no coinciden.'
          : null
      : null;

  async function guardar(): Promise<void> {
    setGuardando(true);
    setError(null);
    try {
      const cred = await http.post<Credenciales>(
        `${base}/${usuario.id}/restablecer-password`,
        modo === 'manual' ? { password } : {},
      );
      onHecho(cred);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo cambiar la contraseña'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo="Cambiar contraseña"
      visible
      bloqueado={guardando}
      onCerrar={onCerrar}
      acciones={
        <>
          <button
            type="button"
            className="btn btn-sm btn-r21-ghost"
            onClick={onCerrar}
            disabled={guardando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-sm btn-r21"
            onClick={() => void guardar()}
            disabled={guardando || problema !== null}
          >
            {guardando ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </>
      }
    >
      <div className="d-flex flex-column gap-3">
        <p className="small mb-0">
          Nueva contraseña para <strong>{usuario.nombre}</strong> (@{usuario.username}).
        </p>

        <div className="selector-roles">
          <label className={cx('opcion-rol', modo === 'automatica' && 'marcado')}>
            <input
              type="radio"
              name="modo"
              checked={modo === 'automatica'}
              onChange={() => setModo('automatica')}
            />
            <span>
              <span className="fw-semibold">Generar una automáticamente</span>
              <span className="d-block small text-muted">
                El sistema crea una segura y fácil de leer, por ejemplo R21-Abcd23xy.
              </span>
            </span>
          </label>
          <label className={cx('opcion-rol', modo === 'manual' && 'marcado')}>
            <input
              type="radio"
              name="modo"
              checked={modo === 'manual'}
              onChange={() => setModo('manual')}
            />
            <span>
              <span className="fw-semibold">Escribirla yo</span>
              <span className="d-block small text-muted">
                Útil si la persona le dicta la que quiere usar.
              </span>
            </span>
          </label>
        </div>

        {modo === 'manual' && (
          <div className="d-flex flex-column gap-2">
            <div className="input-group input-group-sm">
              <input
                type={ver ? 'text' : 'password'}
                className="form-control"
                placeholder="Nueva contraseña (mínimo 8 caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={guardando}
              />
              <button
                type="button"
                className="btn btn-r21-outline"
                onClick={() => setVer(!ver)}
                title={ver ? 'Ocultar' : 'Mostrar'}
              >
                <i className={ver ? 'pi pi-eye-slash' : 'pi pi-eye'}></i>
              </button>
            </div>
            <input
              type={ver ? 'text' : 'password'}
              className="form-control form-control-sm"
              placeholder="Repita la contraseña"
              value={repetir}
              onChange={(e) => setRepetir(e.target.value)}
              autoComplete="new-password"
              disabled={guardando}
            />
            {password && repetir && problema && <div className="small text-danger">{problema}</div>}
          </div>
        )}

        <div className="form-text small mt-0">
          La contraseña actual dejará de funcionar y se cerrará su sesión en todos los equipos.
        </div>
        {error && <Aviso>{error}</Aviso>}
      </div>
    </Modal>
  );
}

function ConfirmarDesactivar({
  usuario,
  onCerrar,
  onConfirmar,
}: {
  usuario: Usuario;
  onCerrar: () => void;
  onConfirmar: () => Promise<void>;
}) {
  const [guardando, setGuardando] = useState(false);
  return (
    <Modal
      titulo="Desactivar cuenta"
      visible
      bloqueado={guardando}
      onCerrar={onCerrar}
      acciones={
        <>
          <button
            type="button"
            className="btn btn-sm btn-r21-ghost"
            onClick={onCerrar}
            disabled={guardando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-sm btn-r21"
            disabled={guardando}
            onClick={() => {
              setGuardando(true);
              void onConfirmar().finally(() => setGuardando(false));
            }}
          >
            {guardando ? 'Desactivando…' : 'Desactivar'}
          </button>
        </>
      }
    >
      <div className="d-flex flex-column gap-2 small">
        <p className="mb-0">
          <strong>{usuario.nombre}</strong> (@{usuario.username}) no podrá entrar al sistema.
        </p>
        <ul className="mb-0 ps-3">
          <li>Se cerrará su sesión en todos los equipos.</li>
          <li>Su historial y sus registros se conservan.</li>
          <li>Puede reactivarla cuando quiera con «Reactivar».</li>
        </ul>
      </div>
    </Modal>
  );
}

type Dialogo =
  | { tipo: 'nueva' }
  | { tipo: 'cargos'; usuario: Usuario }
  | { tipo: 'contrasena'; usuario: Usuario }
  | { tipo: 'desactivar'; usuario: Usuario }
  | { tipo: 'credenciales'; titulo: string; texto: ReactNode; credenciales: Credenciales };

/** Administración de cuentas del personal y de sus cargos (roles) */
export function UsuariosPage() {
  const notificar = useNotificar();
  const { perfil } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);
  // El cargo de Administrador y las cuentas de administradores solo los gestiona un Administrador
  const soyAdmin = perfil?.roles.some((r) => r.codigo === 'ADMIN_SISTEMA') ?? false;
  const rolesAsignables = soyAdmin ? roles : roles.filter((r) => r.codigo !== 'ADMIN_SISTEMA');

  const cargar = useCallback(async () => {
    try {
      const [u, r] = await Promise.all([
        http.get<Usuario[]>(base),
        http.get<Rol[]>(`${base}/roles`),
      ]);
      setUsuarios(u);
      setRoles(r);
    } catch (err) {
      notificar.error('No se pudieron cargar las cuentas', mensajeError(err));
      setUsuarios([]);
    }
  }, [notificar]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function cambiarEstado(u: Usuario): Promise<void> {
    const activar = u.estado !== 'ACTIVA';
    setOcupado(u.id);
    try {
      await http.patch(`${base}/${u.id}/estado`, { estado: activar ? 'ACTIVA' : 'INACTIVA' });
      notificar.exito(activar ? 'Cuenta reactivada' : 'Cuenta desactivada', u.nombre);
      setDialogo(null);
      await cargar();
    } catch (err) {
      notificar.error('No se pudo cambiar el estado', mensajeError(err));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="r21-usuarios">
      <PageHeader
        titulo="Usuarios y permisos"
        subtitulo="Cuentas del personal de Instrucción"
        descripcion="Cada cuenta pertenece a una persona registrada. Lo que puede hacer depende de su cargo."
      >
        <button
          className="btn btn-sm btn-r21"
          onClick={() => setDialogo({ tipo: 'nueva' })}
          disabled={roles.length === 0}
        >
          <i className="pi pi-user-plus"></i> Nueva cuenta
        </button>
      </PageHeader>

      <div className="r21-card">
        <div className="table-responsive">
          {usuarios === null ? (
            <div className="p-4 text-center text-muted">Cargando…</div>
          ) : usuarios.length === 0 ? (
            <div className="r21-card-body">
              <EmptyState
                mensaje="Aún no hay cuentas"
                descripcion="Cree la primera con «Nueva cuenta»."
                icono="pi pi-users"
              />
            </div>
          ) : (
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Cargo</th>
                  <th className="text-center d-none d-sm-table-cell">Estado</th>
                  <th className="d-none d-lg-table-cell">Último acceso</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => {
                  const soyYo = u.id === perfil?.id;
                  const protegida = !soyAdmin && u.roles.some((r) => r.codigo === 'ADMIN_SISTEMA');
                  return (
                    <tr key={u.id} className={cx(u.estado !== 'ACTIVA' && 'inactiva')}>
                      <td>
                        <div className="fw-semibold">
                          {u.nombre}
                          {soyYo && <span className="badge-yo">Usted</span>}
                        </div>
                        <div className="small text-muted">
                          <i className="pi pi-user"></i> @{u.username}
                        </div>
                        <div className="d-sm-none mt-1">
                          <StatusBadge estado={u.estado} />
                        </div>
                      </td>
                      <td className="small">
                        {u.roles.length ? (
                          u.roles.map((r) => r.nombre).join(', ')
                        ) : (
                          <span className="text-muted">Sin cargo</span>
                        )}
                        {u.grupos.length > 0 && (
                          <div className="text-muted">Encarga: {u.grupos.join(', ')}</div>
                        )}
                      </td>
                      <td className="text-center d-none d-sm-table-cell">
                        <StatusBadge estado={u.estado} />
                      </td>
                      <td className="small text-muted d-none d-lg-table-cell">
                        {u.ultimoAcceso
                          ? formatoFecha(u.ultimoAcceso, 'dd/MM/yyyy HH:mm')
                          : 'Nunca'}
                      </td>
                      <td className="text-end text-nowrap">
                        {protegida ? (
                          <span
                            className="small text-muted"
                            title="Solo un Administrador puede modificar esta cuenta"
                          >
                            <i className="pi pi-lock"></i> Solo Administrador
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-r21-ghost"
                              title="Cambiar cargos"
                              onClick={() => setDialogo({ tipo: 'cargos', usuario: u })}
                              disabled={ocupado === u.id}
                            >
                              <i className="pi pi-id-card"></i>
                              <span className="d-none d-md-inline"> Cargos</span>
                            </button>
                            {!soyYo && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-r21-ghost"
                                  title="Crear una contraseña nueva"
                                  onClick={() => setDialogo({ tipo: 'contrasena', usuario: u })}
                                  disabled={ocupado === u.id}
                                >
                                  <i className="pi pi-key"></i>
                                  <span className="d-none d-md-inline"> Contraseña</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-r21-ghost"
                                  title={
                                    u.estado === 'ACTIVA'
                                      ? 'Impedir que entre al sistema'
                                      : 'Permitir que vuelva a entrar'
                                  }
                                  onClick={() =>
                                    u.estado === 'ACTIVA'
                                      ? setDialogo({ tipo: 'desactivar', usuario: u })
                                      : void cambiarEstado(u)
                                  }
                                  disabled={ocupado === u.id}
                                >
                                  <i
                                    className={
                                      u.estado === 'ACTIVA' ? 'pi pi-lock' : 'pi pi-lock-open'
                                    }
                                  ></i>
                                  <span className="d-none d-md-inline">
                                    {' '}
                                    {u.estado === 'ACTIVA' ? 'Desactivar' : 'Reactivar'}
                                  </span>
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {dialogo?.tipo === 'nueva' && (
        <NuevaCuenta
          roles={rolesAsignables}
          onCerrar={() => setDialogo(null)}
          onCreada={(cred, nombre) => {
            setDialogo({
              tipo: 'credenciales',
              titulo: 'Cuenta creada',
              texto: (
                <>
                  Se creó la cuenta de <strong>{nombre}</strong>. Con estos datos entra al sistema.
                </>
              ),
              credenciales: cred,
            });
            void cargar();
          }}
        />
      )}
      {dialogo?.tipo === 'cargos' && (
        <EditarCargos
          usuario={dialogo.usuario}
          roles={rolesAsignables}
          onCerrar={() => setDialogo(null)}
          onGuardado={() => {
            notificar.exito('Cargos actualizados', dialogo.usuario.nombre);
            setDialogo(null);
            void cargar();
          }}
        />
      )}
      {dialogo?.tipo === 'contrasena' && (
        <CambiarContrasena
          usuario={dialogo.usuario}
          onCerrar={() => setDialogo(null)}
          onHecho={(cred) =>
            setDialogo({
              tipo: 'credenciales',
              titulo: 'Contraseña cambiada',
              texto: (
                <>
                  Nueva contraseña de <strong>{dialogo.usuario.nombre}</strong>. Se cerró su sesión
                  en todos los equipos.
                </>
              ),
              credenciales: cred,
            })
          }
        />
      )}
      {dialogo?.tipo === 'desactivar' && (
        <ConfirmarDesactivar
          usuario={dialogo.usuario}
          onCerrar={() => setDialogo(null)}
          onConfirmar={() => cambiarEstado(dialogo.usuario)}
        />
      )}
      {dialogo?.tipo === 'credenciales' && (
        <VerCredenciales
          titulo={dialogo.titulo}
          texto={dialogo.texto}
          credenciales={dialogo.credenciales}
          onCerrar={() => setDialogo(null)}
        />
      )}
    </div>
  );
}
