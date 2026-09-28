import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { mensajeError } from '../../core/http/http';
import { EmptyState } from '../../shared/components/EmptyState';
import { Modal } from '../../shared/components/Modal';
import { useNotificar } from '../../shared/components/Notificaciones';
import { cx, plural } from '../../shared/utils/format';
import { useDebounce } from '../../shared/utils/hooks';
import { gruposApi } from './grupos-api';
import type { CandidatoEncargado, CandidatoIntegrante, GrupoDetalle, Integrante } from './grupos.models';

const MOTIVO_MIN = 5;

const RESULTADO_QUITAR: Record<string, string> = {
  SIN_ETAPA: 'Queda sin grupo y sin etapa (la había obtenido al entrar al grupo).',
  CONSERVA: 'Queda sin grupo y conserva su etapa.',
  RETIRADA: 'Su etapa queda como «Retirado».',
};

/** Acción confirmada con motivo obligatorio: maneja envío, bloqueo y error */
function useAccion(visible: boolean) {
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) setError(null);
  }, [visible]);
  async function ejecutar(fn: () => Promise<void>, porDefecto: string): Promise<void> {
    if (procesando) return;
    setProcesando(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(mensajeError(err, porDefecto));
    } finally {
      setProcesando(false);
    }
  }
  return { procesando, error, ejecutar };
}

function Aviso({ tipo = 'warn', icono = 'pi pi-exclamation-triangle', children }: { tipo?: 'warn' | 'info'; icono?: string; children: ReactNode }) {
  return (
    <div className={cx('r21-notice', tipo)} role={tipo === 'warn' ? 'alert' : undefined}>
      <i className={icono}></i>
      <div className="r21-notice-body">{children}</div>
    </div>
  );
}

function CampoMotivo({ id, valor, onCambio, placeholder }: { id: string; valor: string; onCambio: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="form-label small fw-semibold" htmlFor={id}>
        Motivo *
      </label>
      <textarea
        id={id}
        className="form-control form-control-sm"
        rows={2}
        maxLength={300}
        value={valor}
        placeholder={placeholder}
        onChange={(e) => onCambio(e.target.value)}
      />
      <div className="form-text small">Queda registrado en la auditoría.</div>
    </div>
  );
}

function Pie({ onCerrar, procesando, formId, texto, peligro = false, deshabilitado = false }: {
  onCerrar: () => void;
  procesando: boolean;
  formId: string;
  texto: string;
  peligro?: boolean;
  deshabilitado?: boolean;
}) {
  return (
    <>
      <button type="button" className="btn btn-sm btn-r21-outline" onClick={onCerrar} disabled={procesando}>
        Cancelar
      </button>
      <button
        type="submit"
        form={formId}
        className={cx('btn btn-sm', peligro ? 'btn-r21-danger' : 'btn-r21')}
        disabled={procesando || deshabilitado}
      >
        {procesando && <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>}
        {texto}
      </button>
    </>
  );
}

interface BaseProps {
  grupo: GrupoDetalle;
  visible: boolean;
  onCerrar: () => void;
  /** Tras completar la acción: recargar el detalle */
  onHecho: () => void;
}

// ============ Cerrar / cancelar ============

export function EstadoGrupoDialog({ grupo, visible, onCerrar, onHecho, estado }: BaseProps & { estado: 'CERRADO' | 'CANCELADO' }) {
  const notificar = useNotificar();
  const { procesando, error, ejecutar } = useAccion(visible);
  const [motivo, setMotivo] = useState('');
  useEffect(() => {
    if (visible) setMotivo(estado === 'CERRADO' ? 'Fin del periodo de instrucción' : '');
  }, [visible, estado]);

  const cerrar = estado === 'CERRADO';
  const bloqueadoPorJornadas = grupo.jornadasAbiertas > 0;

  function confirmar(e: FormEvent): void {
    e.preventDefault();
    if (motivo.trim().length < MOTIVO_MIN) return;
    void ejecutar(async () => {
      const r = await gruposApi.cambiarEstado(grupo.id, estado, motivo.trim());
      notificar.exito(
        cerrar ? 'Grupo cerrado' : 'Grupo cancelado',
        `${plural(r.integrantesFinalizados, 'integrante finalizado', 'integrantes finalizados')} · ${plural(r.jornadasCanceladas, 'jornada cancelada', 'jornadas canceladas')}`,
      );
      onHecho();
    }, 'No se pudo cambiar el estado del grupo');
  }

  return (
    <Modal
      titulo={`${cerrar ? 'Cerrar' : 'Cancelar'} ${grupo.nombre}`}
      visible={visible}
      onCerrar={onCerrar}
      bloqueado={procesando}
      acciones={
        <Pie
          onCerrar={onCerrar}
          procesando={procesando}
          formId="form-estado-grupo"
          texto={cerrar ? 'Cerrar grupo' : 'Cancelar grupo'}
          peligro
          deshabilitado={bloqueadoPorJornadas || motivo.trim().length < MOTIVO_MIN}
        />
      }
    >
      <form id="form-estado-grupo" onSubmit={confirmar} className="d-flex flex-column gap-3">
        <p className="small text-muted mb-0">
          {cerrar
            ? 'Use «Cerrar» cuando el grupo terminó su periodo de instrucción.'
            : 'Use «Cancelar» cuando el grupo no llegará a desarrollarse.'}{' '}
          Al confirmar:
        </p>
        <ul className="small mb-0 ps-3 d-flex flex-column gap-1">
          <li>
            {grupo.totalIntegrantes > 0
              ? `${plural(grupo.totalIntegrantes, 'integrante activo pasa', 'integrantes activos pasan')} a «Finalizado» (conservan su etapa e historial).`
              : 'El grupo no tiene integrantes activos.'}
          </li>
          <li>{grupo.encargado ? `${grupo.encargado.nombre} deja de ser encargado.` : 'El grupo no tiene encargado activo.'}</li>
          <li>Se cancelan las jornadas programadas desde hoy y deja de generarse la programación.</li>
          <li>Las asistencias ya registradas no se modifican.</li>
        </ul>
        {bloqueadoPorJornadas && (
          <Aviso>
            Hay {plural(grupo.jornadasAbiertas, 'jornada abierta', 'jornadas abiertas')}. Ciérrela en{' '}
            <Link to="/asistencia">Asistencia</Link> antes de continuar.
          </Aviso>
        )}
        <CampoMotivo
          id="motivo-estado"
          valor={motivo}
          onCambio={setMotivo}
          placeholder={cerrar ? 'Fin del periodo de instrucción' : 'Ej.: no se completó la convocatoria'}
        />
        <Aviso tipo="info" icono="pi pi-info-circle">
          Esta acción no se puede deshacer desde el sistema.
        </Aviso>
        {error && <Aviso>{error}</Aviso>}
      </form>
    </Modal>
  );
}

// ============ Reactivar ============

const SALIDA_POR_CIERRE = /^(Cierre del grupo|Grupo cancelado)/;

export function ReactivarGrupoDialog({ grupo, visible, onCerrar, onHecho }: BaseProps) {
  const notificar = useNotificar();
  const { procesando, error, ejecutar } = useAccion(visible);
  const [motivo, setMotivo] = useState('');
  const [restaurar, setRestaurar] = useState(true);
  useEffect(() => {
    if (!visible) return;
    setMotivo('');
    setRestaurar(true);
  }, [visible]);

  // Quienes salieron en el último cierre (misma fecha de salida)
  const porCierre = grupo.exIntegrantes.filter((x) => SALIDA_POR_CIERRE.test(x.motivo ?? ''));
  const ultimaSalida = porCierre.reduce<string | null>((m, x) => (x.fechaSalida && (!m || x.fechaSalida > m) ? x.fechaSalida : m), null);
  const recuperables = porCierre.filter((x) => x.fechaSalida === ultimaSalida).length;

  function confirmar(e: FormEvent): void {
    e.preventDefault();
    if (motivo.trim().length < MOTIVO_MIN) return;
    void ejecutar(async () => {
      const r = await gruposApi.reactivar(grupo.id, motivo.trim(), restaurar && recuperables > 0);
      const partes = [
        restaurar && recuperables > 0 ? plural(r.integrantesRestaurados, 'integrante reincorporado', 'integrantes reincorporados') : null,
        r.omitidos.length ? `no se reincorporó a: ${r.omitidos.map((o) => `${o.nombre} (${o.motivo})`).join(', ')}` : null,
      ].filter(Boolean);
      notificar.exito('Grupo reactivado', partes.join(' · ') || grupo.nombre);
      if (r.omitidos.length) notificar.aviso('Revise los integrantes', 'Algunas personas no pudieron volver al grupo.');
      onHecho();
    }, 'No se pudo reactivar el grupo');
  }

  return (
    <Modal
      titulo={`Reactivar ${grupo.nombre}`}
      visible={visible}
      onCerrar={onCerrar}
      bloqueado={procesando}
      acciones={
        <Pie onCerrar={onCerrar} procesando={procesando} formId="form-reactivar" texto="Reactivar grupo" deshabilitado={motivo.trim().length < MOTIVO_MIN} />
      }
    >
      <form id="form-reactivar" onSubmit={confirmar} className="d-flex flex-column gap-3">
        <p className="small text-muted mb-0">Al confirmar:</p>
        <ul className="small mb-0 ps-3 d-flex flex-column gap-1">
          <li>El grupo vuelve a «Activo» sin fecha de fin.</li>
          <li>Se genera de nuevo su programación desde hoy y se reponen las jornadas futuras canceladas por el cierre.</li>
          <li>El encargado no se repone: asígnelo otra vez desde el detalle.</li>
        </ul>
        {recuperables > 0 ? (
          <label className="d-flex align-items-start gap-2 small mb-0">
            <input type="checkbox" className="form-check-input mt-0" checked={restaurar} onChange={(e) => setRestaurar(e.target.checked)} />
            <span>
              Reincorporar a {recuperables === 1 ? 'la persona que salió' : `las ${recuperables} personas que salieron`} por el cierre. Se omite a
              quien hoy esté en otro grupo, en otra etapa o retirado.
            </span>
          </label>
        ) : (
          <p className="small text-muted mb-0">No hay integrantes que hayan salido por el cierre.</p>
        )}
        <CampoMotivo id="motivo-reactivar" valor={motivo} onCambio={setMotivo} placeholder="Ej.: se retoma la instrucción del grupo" />
        {error && <Aviso>{error}</Aviso>}
      </form>
    </Modal>
  );
}

// ============ Eliminar ============

export function EliminarGrupoDialog({ grupo, visible, onCerrar, onHecho }: BaseProps) {
  const notificar = useNotificar();
  const { procesando, error, ejecutar } = useAccion(visible);
  const [confirmacion, setConfirmacion] = useState('');
  useEffect(() => {
    if (visible) setConfirmacion('');
  }, [visible]);
  const coincide = confirmacion.trim().toUpperCase() === grupo.codigo;

  function confirmar(e: FormEvent): void {
    e.preventDefault();
    if (!coincide) return;
    void ejecutar(async () => {
      await gruposApi.eliminar(grupo.id);
      notificar.exito('Grupo eliminado', grupo.nombre);
      onHecho();
    }, 'No se pudo eliminar el grupo');
  }

  return (
    <Modal
      titulo={`Eliminar ${grupo.nombre}`}
      visible={visible}
      onCerrar={onCerrar}
      bloqueado={procesando}
      acciones={
        <Pie onCerrar={onCerrar} procesando={procesando} formId="form-eliminar-grupo" texto="Eliminar definitivamente" peligro deshabilitado={!coincide} />
      }
    >
      <form id="form-eliminar-grupo" onSubmit={confirmar} className="d-flex flex-column gap-3">
        <p className="small mb-0">
          El grupo no tiene integrantes ni asistencias, por eso puede eliminarse por completo junto con su
          programación. Úselo solo para grupos creados por error.
        </p>
        <div>
          <label className="form-label small fw-semibold" htmlFor="confirmar-codigo">
            Escriba el código <strong>{grupo.codigo}</strong> para confirmar
          </label>
          <input
            id="confirmar-codigo"
            className="form-control form-control-sm text-uppercase"
            value={confirmacion}
            autoComplete="off"
            onChange={(e) => setConfirmacion(e.target.value)}
          />
        </div>
        {error && <Aviso>{error}</Aviso>}
      </form>
    </Modal>
  );
}

// ============ Encargado ============

const SITUACION_ENCARGADO: Record<CandidatoEncargado['situacion'], { texto: string; clase: string }> = {
  LISTO: { texto: 'Tiene cuenta', clase: 'ok' },
  SIN_ROL: { texto: 'Se le dará el rol', clase: 'warn' },
  SIN_CUENTA: { texto: 'Se creará su cuenta', clase: 'warn' },
  CUENTA_INACTIVA: { texto: 'Cuenta bloqueada', clase: 'neutro' },
};
const USUARIO_VALIDO = /^[a-z0-9][a-z0-9._-]{2,79}$/;

export function EncargadoDialog({ grupo, visible, onCerrar, onHecho, puedeGestionarUsuarios }: BaseProps & { puedeGestionarUsuarios: boolean }) {
  const notificar = useNotificar();
  const { procesando, error, ejecutar } = useAccion(visible);
  const [candidatos, setCandidatos] = useState<CandidatoEncargado[] | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [elegido, setElegido] = useState<number | null>(null);
  const [reasignar, setReasignar] = useState(false);
  const [username, setUsername] = useState('');
  const [filtro, setFiltro] = useState('');
  const [credenciales, setCredenciales] = useState<{ username: string; passwordTemporal: string; nombre: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCandidatos(null);
    setErrorCarga(null);
    setElegido(null);
    setReasignar(false);
    setUsername('');
    setFiltro('');
    setCredenciales(null);
    setCopiado(false);
    gruposApi
      .candidatosEncargado(grupo.id)
      .then(setCandidatos)
      .catch((err) => {
        setCandidatos([]);
        setErrorCarga(mensajeError(err, 'No se pudieron cargar los candidatos'));
      });
  }, [visible, grupo.id]);

  const seleccion = candidatos?.find((c) => c.personaId === elegido) ?? null;
  const enOtroGrupo = seleccion?.grupoActualId != null && seleccion.grupoActualId !== grupo.id;
  const usuarioInvalido = seleccion?.situacion === 'SIN_CUENTA' && !USUARIO_VALIDO.test(username.trim().toLowerCase());
  const t = filtro.trim().toLowerCase();
  const visibles = (candidatos ?? []).filter((c) => !t || `${c.nombre} ${c.username ?? ''}`.toLowerCase().includes(t));
  const integrantes = visibles.filter((c) => c.esIntegrante);
  const otros = visibles.filter((c) => !c.esIntegrante);

  function elegir(c: CandidatoEncargado): void {
    setElegido(c.personaId);
    setReasignar(false);
    setUsername(c.usernameSugerido ?? '');
  }

  function confirmar(e: FormEvent): void {
    e.preventDefault();
    if (!seleccion || usuarioInvalido || (enOtroGrupo && !reasignar)) return;
    void ejecutar(async () => {
      const r = await gruposApi.asignarEncargado(grupo.id, {
        personaId: seleccion.personaId,
        reasignar,
        ...(seleccion.situacion === 'SIN_CUENTA' ? { username: username.trim().toLowerCase() } : {}),
      });
      if (r.credenciales) {
        // Se muestran una sola vez: el diálogo queda abierto hasta que el usuario las anote
        setCredenciales({ ...r.credenciales, nombre: seleccion.nombre });
        return;
      }
      notificar.exito(
        'Encargado asignado',
        `${seleccion.nombre} → ${grupo.nombre}${r.rolOtorgado ? ' (se le otorgó el rol «Encargado de grupo»)' : ''}`,
      );
      onHecho();
    }, 'No se pudo asignar el encargado');
  }

  async function copiar(): Promise<void> {
    if (!credenciales) return;
    try {
      await navigator.clipboard.writeText(`Usuario: ${credenciales.username}\nContraseña temporal: ${credenciales.passwordTemporal}`);
      setCopiado(true);
    } catch {
      notificar.aviso('No se pudo copiar', 'Anote las credenciales manualmente.');
    }
  }

  if (credenciales) {
    return (
      <Modal
        titulo="Encargado asignado"
        visible={visible}
        onCerrar={onHecho}
        acciones={
          <button type="button" className="btn btn-sm btn-r21" onClick={onHecho}>
            Ya las anoté
          </button>
        }
      >
        <div className="d-flex flex-column gap-3">
          <p className="small mb-0">
            Se creó la cuenta de <strong>{credenciales.nombre}</strong> con el rol «Encargado de grupo». Con ella entra al
            sistema y registra la asistencia de {grupo.nombre} desde «Mi grupo».
          </p>
          <div className="r21-credenciales">
            <div>
              <span className="etiqueta">Usuario</span>
              <code>{credenciales.username}</code>
            </div>
            <div>
              <span className="etiqueta">Contraseña temporal</span>
              <code>{credenciales.passwordTemporal}</code>
            </div>
            <button type="button" className="btn btn-sm btn-r21-outline" onClick={() => void copiar()}>
              <i className={copiado ? 'pi pi-check' : 'pi pi-copy'}></i> {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <Aviso>Entréguela en persona. Por seguridad no se volverá a mostrar.</Aviso>
        </div>
      </Modal>
    );
  }

  const opcion = (c: CandidatoEncargado) => {
    const actual = c.usuarioId != null && c.usuarioId === grupo.encargado?.usuarioId;
    const bloqueada = c.situacion === 'CUENTA_INACTIVA';
    const badge = actual
      ? { texto: 'Encargado actual', clase: 'ok' }
      : c.situacion === 'LISTO' && c.grupoActual
        ? { texto: `Encarga ${c.grupoActual}`, clase: 'neutro' }
        : SITUACION_ENCARGADO[c.situacion];
    return (
      <label key={c.personaId} className={cx('r21-opcion', elegido === c.personaId && 'activa', (actual || bloqueada) && 'deshabilitada')}>
        <input type="radio" name="encargado" checked={elegido === c.personaId} disabled={actual || bloqueada} onChange={() => elegir(c)} />
        <span className="opcion-cuerpo">
          <span className="opcion-titulo">{c.nombre}</span>
          <span className="opcion-detalle">
            {c.username ? `@${c.username}` : 'Sin cuenta en el sistema'}
            {c.roles.length > 0 ? ` · ${c.roles.join(', ')}` : ''}
          </span>
        </span>
        <span className={cx('r21-badge', badge.clase)}>{badge.texto}</span>
      </label>
    );
  };

  return (
    <Modal
      titulo={grupo.encargado ? 'Cambiar encargado' : 'Asignar encargado'}
      visible={visible}
      onCerrar={onCerrar}
      bloqueado={procesando}
      ancho="lg"
      acciones={
        <Pie
          onCerrar={onCerrar}
          procesando={procesando}
          formId="form-encargado"
          texto={seleccion?.situacion === 'SIN_CUENTA' ? 'Crear cuenta y asignar' : 'Asignar'}
          deshabilitado={!seleccion || usuarioInvalido || (enOtroGrupo && !reasignar)}
        />
      }
    >
      <form id="form-encargado" onSubmit={confirmar} className="d-flex flex-column gap-3">
        <p className="small text-muted mb-0">
          Elija a un integrante del grupo. Si no tiene cuenta se le crea una, y si no tiene el rol se le otorga solo
          «Encargado de grupo», que le permite registrar la asistencia de su grupo desde «Mi grupo».
        </p>
        {candidatos !== null && candidatos.length > 8 && (
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder="Buscar por nombre o usuario…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            aria-label="Buscar candidatos"
          />
        )}
        {candidatos === null ? (
          <div className="text-muted small d-flex align-items-center gap-2">
            <span className="spinner-border spinner-border-sm" aria-hidden="true"></span> Cargando candidatos…
          </div>
        ) : candidatos.length === 0 ? (
          <EmptyState
            compacto
            mensaje={errorCarga ?? 'No hay candidatos'}
            descripcion={errorCarga ? '' : 'Agregue integrantes al grupo para poder elegir a su encargado.'}
            icono="pi pi-user-minus"
            accionTexto={puedeGestionarUsuarios && !errorCarga ? 'Ir a usuarios' : ''}
            accionRuta={puedeGestionarUsuarios && !errorCarga ? '/admin/usuarios' : ''}
          />
        ) : (
          <div className="r21-opciones" role="radiogroup" aria-label="Candidatos a encargado">
            <div className="r21-opciones-titulo">Integrantes del grupo ({integrantes.length})</div>
            {integrantes.length === 0 && <div className="small text-muted">{t ? 'Sin coincidencias.' : 'El grupo aún no tiene integrantes.'}</div>}
            {integrantes.map(opcion)}
            {otros.length > 0 && (
              <>
                <div className="r21-opciones-titulo mt-2">Otros usuarios habilitados</div>
                {otros.map(opcion)}
              </>
            )}
          </div>
        )}

        {seleccion?.situacion === 'SIN_CUENTA' && (
          <div className="r21-notice info align-items-start">
            <i className="pi pi-user-plus"></i>
            <div className="r21-notice-body d-flex flex-column gap-2">
              <span>
                Se creará la cuenta de <strong>{seleccion.nombre}</strong> con una contraseña temporal que verá una sola vez.
              </span>
              <div>
                <label className="form-label small fw-semibold mb-1" htmlFor="enc-username">
                  Usuario
                </label>
                <input
                  id="enc-username"
                  className={cx('form-control form-control-sm', usuarioInvalido && 'is-invalid')}
                  value={username}
                  maxLength={80}
                  autoComplete="off"
                  onChange={(e) => setUsername(e.target.value)}
                />
                {usuarioInvalido && (
                  <div className="r21-field-error">3 a 80 caracteres: minúsculas, números, punto o guion</div>
                )}
              </div>
            </div>
          </div>
        )}
        {seleccion?.situacion === 'SIN_ROL' && (
          <Aviso tipo="info" icono="pi pi-shield">
            {seleccion.nombre} ya tiene cuenta (@{seleccion.username}). Se le otorgará el rol «Encargado de grupo».
          </Aviso>
        )}
        {enOtroGrupo && seleccion && (
          <Aviso>
            <div className="mb-2">
              {seleccion.nombre} ya encarga <strong>{seleccion.grupoActual}</strong>. Una persona encarga un solo grupo a
              la vez: ese grupo quedará sin encargado.
            </div>
            <label className="d-flex align-items-center gap-2 mb-0">
              <input type="checkbox" className="form-check-input m-0" checked={reasignar} onChange={(e) => setReasignar(e.target.checked)} />
              Moverlo a este grupo
            </label>
          </Aviso>
        )}
        {grupo.encargado && seleccion && (
          <p className="small text-muted mb-0">
            La asignación de {grupo.encargado.nombre} se finalizará y quedará en el historial.
          </p>
        )}
        {error && <Aviso>{error}</Aviso>}
      </form>
    </Modal>
  );
}

export function QuitarEncargadoDialog({ grupo, visible, onCerrar, onHecho }: BaseProps) {
  const notificar = useNotificar();
  const { procesando, error, ejecutar } = useAccion(visible);
  const [motivo, setMotivo] = useState('');
  useEffect(() => {
    if (visible) setMotivo('');
  }, [visible]);

  function confirmar(e: FormEvent): void {
    e.preventDefault();
    if (motivo.trim().length < MOTIVO_MIN) return;
    void ejecutar(async () => {
      await gruposApi.finalizarEncargado(grupo.id, motivo.trim());
      notificar.aviso('Encargado retirado', `${grupo.nombre} queda sin encargado`);
      onHecho();
    }, 'No se pudo retirar al encargado');
  }

  return (
    <Modal
      titulo="Quitar encargado"
      visible={visible}
      onCerrar={onCerrar}
      bloqueado={procesando}
      acciones={
        <Pie onCerrar={onCerrar} procesando={procesando} formId="form-quitar-encargado" texto="Quitar encargado" peligro deshabilitado={motivo.trim().length < MOTIVO_MIN} />
      }
    >
      <form id="form-quitar-encargado" onSubmit={confirmar} className="d-flex flex-column gap-3">
        <p className="small mb-0">
          <strong>{grupo.encargado?.nombre}</strong> dejará de ver y registrar la asistencia de {grupo.nombre}. Mientras
          no haya encargado, solo la jefatura podrá registrarla.
        </p>
        <CampoMotivo id="motivo-encargado" valor={motivo} onCambio={setMotivo} placeholder="Ej.: licencia temporal" />
        {error && <Aviso>{error}</Aviso>}
      </form>
    </Modal>
  );
}

// ============ Integrantes ============

const SITUACION: Record<CandidatoIntegrante['situacion'], { texto: string; clase: string }> = {
  AGREGAR: { texto: 'Disponible', clase: 'ok' },
  TRANSFERIR: { texto: 'En otro grupo', clase: 'warn' },
  YA_INTEGRA: { texto: 'Ya integra', clase: 'neutro' },
  OTRA_ETAPA: { texto: 'Otra etapa', clase: 'neutro' },
};

export function AgregarIntegranteDialog({ grupo, visible, onCerrar, onHecho }: BaseProps) {
  const notificar = useNotificar();
  const [busqueda, setBusqueda] = useState('');
  const q = useDebounce(busqueda.trim(), 300);
  const [candidatos, setCandidatos] = useState<CandidatoIntegrante[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<number | null>(null);
  const [porTransferir, setPorTransferir] = useState<number | null>(null);
  const [agregados, setAgregados] = useState(0);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setBusqueda('');
    setPorTransferir(null);
    setAgregados(0);
    setError(null);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let vigente = true;
    gruposApi
      .candidatosIntegrante(grupo.id, q)
      .then((c) => vigente && setCandidatos(c))
      .catch((err) => {
        if (!vigente) return;
        setCandidatos([]);
        setError(mensajeError(err, 'No se pudo buscar personas'));
      });
    return () => {
      vigente = false;
    };
  }, [visible, grupo.id, q, recarga]);

  async function agregar(c: CandidatoIntegrante, transferir: boolean): Promise<void> {
    if (procesando) return;
    setProcesando(c.personaId);
    setError(null);
    try {
      await gruposApi.agregarIntegrante(grupo.id, c.personaId, transferir);
      notificar.exito(transferir ? 'Integrante transferido' : 'Integrante agregado', c.nombreCompleto);
      setPorTransferir(null);
      setAgregados((n) => n + 1);
      setRecarga((n) => n + 1);
    } catch (err) {
      setError(mensajeError(err, 'No se pudo agregar'));
    } finally {
      setProcesando(null);
    }
  }

  function cerrar(): void {
    if (agregados > 0) onHecho();
    else onCerrar();
  }

  return (
    <Modal
      titulo={`Agregar integrantes · ${grupo.nombre}`}
      visible={visible}
      onCerrar={cerrar}
      bloqueado={procesando !== null}
      ancho="lg"
      acciones={
        <button type="button" className="btn btn-sm btn-r21" onClick={cerrar} disabled={procesando !== null}>
          {agregados > 0 ? `Listo (${plural(agregados, 'agregado', 'agregados')})` : 'Cerrar'}
        </button>
      }
    >
      <div className="d-flex flex-column gap-3">
        <input
          type="search"
          className="form-control form-control-sm"
          placeholder="Buscar por apellidos, nombres o DNI…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar personas"
        />
        <p className="small text-muted mb-0">
          Solo se agregan personas de la etapa <strong>{grupo.etapa}</strong> o sin etapa. Para cambiar a alguien de
          etapa use <Link to="/formacion/personas">Promover</Link>. ¿No aparece? Regístrela en{' '}
          <Link to="/formacion/personas">Personas</Link>.
        </p>
        {error && <Aviso>{error}</Aviso>}
        {candidatos === null ? (
          <div className="text-muted small">Buscando…</div>
        ) : candidatos.length === 0 ? (
          <EmptyState compacto mensaje="Sin coincidencias" icono="pi pi-user-minus" />
        ) : (
          <div className="r21-card mb-0">
            <table className="table table-sm align-middle mb-0 tabla-candidatos">
              <tbody>
                {candidatos.map((c) => (
                  <tr key={c.personaId}>
                    <td>
                      <div className="fw-semibold">{c.nombreCompleto}</div>
                      <div className="small text-muted">
                        {c.dni ? `DNI ${c.dni}` : 'Sin DNI'} · {c.etapa ?? 'Sin etapa'}
                        {c.grupoActual && c.situacion !== 'YA_INTEGRA' ? ` · ${c.grupoActual}` : ''}
                      </div>
                    </td>
                    <td className="text-end text-nowrap">
                      {porTransferir === c.personaId ? (
                        <span className="d-inline-flex align-items-center gap-2">
                          <span className="small">¿Mover desde {c.grupoActual}?</span>
                          <button className="btn btn-sm btn-r21-outline" onClick={() => setPorTransferir(null)} disabled={procesando !== null}>
                            No
                          </button>
                          <button className="btn btn-sm btn-r21" onClick={() => void agregar(c, true)} disabled={procesando !== null}>
                            {procesando === c.personaId && <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>}
                            Transferir
                          </button>
                        </span>
                      ) : c.situacion === 'AGREGAR' ? (
                        <button className="btn btn-sm btn-r21-outline" onClick={() => void agregar(c, false)} disabled={procesando !== null}>
                          {procesando === c.personaId ? (
                            <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                          ) : (
                            <i className="pi pi-plus"></i>
                          )}
                          Agregar
                        </button>
                      ) : c.situacion === 'TRANSFERIR' ? (
                        <button className="btn btn-sm btn-r21-outline" onClick={() => setPorTransferir(c.personaId)} disabled={procesando !== null}>
                          <i className="pi pi-arrow-right-arrow-left"></i> Transferir
                        </button>
                      ) : (
                        <span
                          className={cx('r21-badge', SITUACION[c.situacion].clase)}
                          title={c.situacion === 'OTRA_ETAPA' ? 'Pertenece a otra etapa: use «Promover» en Personas' : undefined}
                        >
                          {SITUACION[c.situacion].texto}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function BajaIntegranteDialog({ grupo, visible, onCerrar, onHecho, integrante }: BaseProps & { integrante: Integrante | null }) {
  const notificar = useNotificar();
  const { procesando, error, ejecutar } = useAccion(visible);
  const [tipo, setTipo] = useState<'QUITAR' | 'RETIRO'>('QUITAR');
  const [motivo, setMotivo] = useState('');
  useEffect(() => {
    if (!visible) return;
    setTipo('QUITAR');
    setMotivo('');
  }, [visible]);

  function confirmar(e: FormEvent): void {
    e.preventDefault();
    if (!integrante || motivo.trim().length < MOTIVO_MIN) return;
    void ejecutar(async () => {
      const r = await gruposApi.retirarIntegrante(grupo.id, integrante.personaId, tipo, motivo.trim());
      notificar.exito(
        tipo === 'RETIRO' ? 'Retiro registrado' : 'Integrante quitado',
        `${integrante.nombreCompleto}. ${r?.etapa ? RESULTADO_QUITAR[r.etapa] : ''}`.trim(),
      );
      onHecho();
    }, 'No se pudo dar de baja');
  }

  return (
    <Modal
      titulo={`Dar de baja a ${integrante?.nombreCompleto ?? ''}`}
      visible={visible}
      onCerrar={onCerrar}
      bloqueado={procesando}
      acciones={
        <Pie onCerrar={onCerrar} procesando={procesando} formId="form-baja" texto="Confirmar baja" peligro deshabilitado={motivo.trim().length < MOTIVO_MIN} />
      }
    >
      <form id="form-baja" onSubmit={confirmar} className="d-flex flex-column gap-3">
        <div className="r21-opciones" role="radiogroup" aria-label="Tipo de baja">
          <label className={cx('r21-opcion', tipo === 'QUITAR' && 'activa')}>
            <input type="radio" name="tipo-baja" checked={tipo === 'QUITAR'} onChange={() => setTipo('QUITAR')} />
            <span className="opcion-cuerpo">
              <span className="opcion-titulo">Quitar del grupo</span>
              <span className="opcion-detalle">
                Para errores de registro o reubicación. Si obtuvo su etapa al entrar a este grupo, queda sin etapa; si
                ya la tenía, la conserva. Queda constancia en su historial.
              </span>
            </span>
          </label>
          <label className={cx('r21-opcion', tipo === 'RETIRO' && 'activa')}>
            <input type="radio" name="tipo-baja" checked={tipo === 'RETIRO'} onChange={() => setTipo('RETIRO')} />
            <span className="opcion-cuerpo">
              <span className="opcion-titulo">Retiro de la formación</span>
              <span className="opcion-detalle">Abandona la instrucción: también se cierra su etapa como «Retirado».</span>
            </span>
          </label>
        </div>
        <CampoMotivo
          id="motivo-baja"
          valor={motivo}
          onCambio={setMotivo}
          placeholder={tipo === 'RETIRO' ? 'Ej.: renuncia voluntaria' : 'Ej.: registrado en el grupo equivocado'}
        />
        <p className="small text-muted mb-0">Sus asistencias registradas se conservan.</p>
        {error && <Aviso>{error}</Aviso>}
      </form>
    </Modal>
  );
}
