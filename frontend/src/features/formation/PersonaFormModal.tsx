import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { mensajeError } from '../../core/http/http';
import { Modal } from '../../shared/components/Modal';
import { useNotificar } from '../../shared/components/Notificaciones';
import { StatusBadge } from '../../shared/components/StatusBadge';
import { cx, fechaLocalIso } from '../../shared/utils/format';
import { gruposApi } from './grupos-api';

const RESULTADO_QUITAR: Record<string, string> = {
  SIN_ETAPA: 'Queda sin grupo y sin etapa (la había obtenido al entrar al grupo).',
  CONSERVA: 'Queda sin grupo y conserva su etapa.',
  RETIRADA: 'Su etapa queda como «Retirado».',
};
import { personasApi } from './personas-api';
import { nombreCompleto, type FichaPersona, type PersonaForm, type ResumenPersonas } from './personas.models';

const VACIO: PersonaForm = {
  dni: '',
  nombres: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  telefono: '',
  correo: '',
  fechaNacimiento: '',
};

const formDe = (p: FichaPersona): PersonaForm => ({
  dni: p.dni ?? '',
  nombres: p.nombres,
  apellidoPaterno: p.apellidoPaterno,
  apellidoMaterno: p.apellidoMaterno ?? '',
  telefono: p.telefono ?? '',
  correo: p.correo ?? '',
  fechaNacimiento: p.fechaNacimiento ?? '',
});

type Modo = 'form' | 'desactivar' | 'reactivar' | 'eliminar' | 'quitar-grupo';

interface Props {
  visible: boolean;
  /** null = nueva persona */
  personaId: number | null;
  grupos: ResumenPersonas['grupos'];
  /** Puede incorporar o quitar de un grupo (formation.manage_groups) */
  puedeAsignarGrupo: boolean;
  grupoInicial: number | null;
  onCerrar: () => void;
  /** Tras guardar o cambiar estado: recargar lista y conteos */
  onCambio: () => void;
}

export function PersonaFormModal({ visible, personaId, grupos, puedeAsignarGrupo, grupoInicial, onCerrar, onCambio }: Props) {
  const notificar = useNotificar();
  const esNueva = personaId === null;
  const [ficha, setFicha] = useState<FichaPersona | null>(null);
  const [form, setForm] = useState<PersonaForm>(VACIO);
  const [grupoId, setGrupoId] = useState<number | ''>('');
  const [modo, setModo] = useState<Modo>('form');
  const [motivo, setMotivo] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setModo('form');
    setMotivo('');
    setEnviado(false);
    setError(null);
    setFicha(null);
    setGrupoId(grupoInicial ?? '');
    if (personaId === null) {
      setForm(VACIO);
      return;
    }
    personasApi
      .obtener(personaId)
      .then((p) => {
        setFicha(p);
        setForm(formDe(p));
      })
      .catch((err) => setError(mensajeError(err, 'No se pudo cargar la persona')));
  }, [visible, personaId, grupoInicial]);

  const errores = {
    dni: form.dni && !/^\d{8}$/.test(form.dni) ? 'Debe tener 8 dígitos' : null,
    nombres: !form.nombres.trim() ? 'Indique los nombres' : null,
    apellidoPaterno: !form.apellidoPaterno.trim() ? 'Indique el apellido paterno' : null,
    telefono: form.telefono.trim() && !/^[+\d][\d\s-]{5,29}$/.test(form.telefono.trim()) ? 'Teléfono inválido' : null,
    correo: form.correo.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo.trim()) ? 'Correo inválido' : null,
  };
  const valido = Object.values(errores).every((e) => e === null);
  const err = (c: keyof typeof errores) => (enviado ? errores[c] : null);
  const cargando = !esNueva && ficha === null && !error;

  async function ejecutar(fn: () => Promise<void>, porDefecto: string): Promise<void> {
    if (procesando) return;
    setProcesando(true);
    setError(null);
    try {
      await fn();
    } catch (ex) {
      setError(mensajeError(ex, porDefecto));
    } finally {
      setProcesando(false);
    }
  }

  function guardar(e: FormEvent): void {
    e.preventDefault();
    setEnviado(true);
    if (!valido) return;
    void ejecutar(async () => {
      if (esNueva) {
        const p = await personasApi.crear(form);
        if (grupoId !== '') {
          const grupo = grupos.find((g) => g.grupoId === grupoId)?.nombre ?? 'el grupo';
          try {
            await gruposApi.agregarIntegrante(grupoId, p.id, false);
            notificar.exito('Persona registrada', `${nombreCompleto(p)} → ${grupo}`);
          } catch (ex) {
            notificar.aviso('Persona registrada sin grupo', `No se pudo incorporar a ${grupo}: ${mensajeError(ex)}`);
          }
        } else {
          notificar.exito('Persona registrada', nombreCompleto(p));
        }
      } else if (ficha) {
        const p = await personasApi.actualizar(ficha.id, form);
        notificar.exito('Datos actualizados', nombreCompleto(p));
      }
      onCambio();
    }, 'No se pudo guardar');
  }

  function cambiarEstado(e: FormEvent): void {
    e.preventDefault();
    if (!ficha || motivo.trim().length < 5) return;
    const estado = modo === 'desactivar' ? 'INACTIVO' : 'ACTIVO';
    void ejecutar(async () => {
      const r = await personasApi.cambiarEstado(ficha.id, estado, motivo.trim());
      const detalle = [
        r.grupoFinalizado ? `salió de ${r.grupoFinalizado}` : null,
        r.encargosFinalizados ? 'dejó de ser encargado' : null,
        r.cuentaInactivada ? 'su cuenta quedó inactiva' : null,
      ].filter(Boolean);
      notificar.exito(estado === 'INACTIVO' ? 'Persona desactivada' : 'Persona reactivada', detalle.join(' · ') || nombreCompleto(ficha));
      onCambio();
    }, 'No se pudo cambiar el estado');
  }

  function quitarDelGrupo(e: FormEvent): void {
    e.preventDefault();
    if (!ficha?.grupoId || motivo.trim().length < 5) return;
    const grupoId = ficha.grupoId;
    void ejecutar(async () => {
      const r = await gruposApi.retirarIntegrante(grupoId, ficha.id, 'QUITAR', motivo.trim());
      notificar.exito(`Quitado de ${ficha.grupo}`, r?.etapa ? RESULTADO_QUITAR[r.etapa] : nombreCompleto(ficha));
      onCambio();
    }, 'No se pudo quitar del grupo');
  }

  function eliminar(e: FormEvent): void {
    e.preventDefault();
    if (!ficha) return;
    void ejecutar(async () => {
      await personasApi.eliminar(ficha.id);
      notificar.exito('Persona eliminada', nombreCompleto(ficha));
      onCambio();
    }, 'No se pudo eliminar');
  }

  const titulo = esNueva
    ? 'Nueva persona'
    : modo === 'quitar-grupo'
      ? 'Quitar del grupo'
      : modo === 'desactivar'
      ? 'Desactivar persona'
      : modo === 'reactivar'
        ? 'Reactivar persona'
        : modo === 'eliminar'
          ? 'Eliminar persona'
          : 'Datos de la persona';

  const pie =
    modo === 'form' ? (
      <>
        {ficha && (
          <div className="me-auto d-flex gap-2">
            {ficha.estado === 'ACTIVO' ? (
              <button type="button" className="btn btn-sm btn-r21-ghost text-danger" onClick={() => { setModo('desactivar'); setError(null); }} disabled={procesando}>
                <i className="pi pi-ban"></i> Desactivar
              </button>
            ) : (
              <button type="button" className="btn btn-sm btn-r21-ghost" onClick={() => { setModo('reactivar'); setError(null); }} disabled={procesando}>
                <i className="pi pi-replay"></i> Reactivar
              </button>
            )}
            {ficha.eliminable && (
              <button type="button" className="btn btn-sm btn-r21-ghost text-danger" onClick={() => { setModo('eliminar'); setError(null); }} disabled={procesando}>
                <i className="pi pi-trash"></i> Eliminar
              </button>
            )}
          </div>
        )}
        <button type="button" className="btn btn-sm btn-r21-outline" onClick={onCerrar} disabled={procesando}>
          Cancelar
        </button>
        <button type="submit" form="form-persona" className="btn btn-sm btn-r21" disabled={procesando || cargando}>
          {procesando && <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>}
          {esNueva ? 'Registrar' : 'Guardar cambios'}
        </button>
      </>
    ) : (
      <>
        <button type="button" className="btn btn-sm btn-r21-outline" onClick={() => { setModo('form'); setError(null); }} disabled={procesando}>
          Volver
        </button>
        <button
          type="submit"
          form="form-persona-estado"
          className={cx('btn btn-sm', modo === 'reactivar' ? 'btn-r21' : 'btn-r21-danger')}
          disabled={procesando || (modo !== 'eliminar' && motivo.trim().length < 5)}
        >
          {procesando && <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>}
          {modo === 'desactivar'
            ? 'Desactivar'
            : modo === 'reactivar'
              ? 'Reactivar'
              : modo === 'quitar-grupo'
                ? 'Quitar del grupo'
                : 'Eliminar definitivamente'}
        </button>
      </>
    );

  const campo = (id: keyof PersonaForm, etiqueta: string, props: Record<string, unknown> = {}) => (
    <>
      <label className="form-label small fw-semibold" htmlFor={`p-${id}`}>
        {etiqueta}
      </label>
      <input
        id={`p-${id}`}
        className={cx('form-control form-control-sm', id in errores && err(id as keyof typeof errores) && 'is-invalid')}
        value={form[id]}
        onChange={(e) => setForm({ ...form, [id]: id === 'dni' ? e.target.value.replace(/\D/g, '') : e.target.value })}
        {...props}
      />
      {id in errores && err(id as keyof typeof errores) && <div className="r21-field-error">{err(id as keyof typeof errores)}</div>}
    </>
  );

  return (
    <Modal titulo={titulo} visible={visible} onCerrar={onCerrar} bloqueado={procesando} ancho="lg" acciones={pie}>
      {cargando ? (
        <div className="text-muted small d-flex align-items-center gap-2">
          <span className="spinner-border spinner-border-sm" aria-hidden="true"></span> Cargando…
        </div>
      ) : modo === 'form' ? (
        <form id="form-persona" onSubmit={guardar} noValidate className="d-flex flex-column gap-3">
          {ficha && (
            <div className="r21-persona-situacion">
              <StatusBadge estado={ficha.estado} />
              {ficha.esPersonal ? (
                <span>
                  <i className="pi pi-id-card"></i> Personal del sistema (no es alumno)
                </span>
              ) : (
                <>
                  <span>
                    <span className="text-muted">Etapa:</span> {ficha.etapa ?? 'Sin etapa'}
                  </span>
                  <span>
                    <span className="text-muted">Grupo:</span>{' '}
                    {ficha.grupoId ? <Link to={`/formacion/grupos/${ficha.grupoId}`}>{ficha.grupo}</Link> : 'Sin grupo'}
                    {ficha.grupoId && puedeAsignarGrupo && (
                      <button
                        type="button"
                        className="btn btn-sm btn-r21-ghost ms-1 py-0"
                        onClick={() => {
                          setModo('quitar-grupo');
                          setMotivo('');
                          setError(null);
                        }}
                        title="Quitar del grupo (p. ej. se registró en el grupo equivocado)"
                      >
                        <i className="pi pi-times"></i> Quitar
                      </button>
                    )}
                  </span>
                </>
              )}
              {ficha.encargaGrupoId && (
                <span>
                  <span className="text-muted">Encargado de:</span>{' '}
                  <Link to={`/formacion/grupos/${ficha.encargaGrupoId}`}>{ficha.encargaGrupo}</Link>
                </span>
              )}
              {ficha.username && (
                <span>
                  <span className="text-muted">Cuenta:</span> @{ficha.username}
                  {ficha.roles.length > 0 && <span className="text-muted"> · {ficha.roles.join(', ')}</span>}
                </span>
              )}
            </div>
          )}
          <div className="row g-3">
            <div className="col-12 col-md-4">{campo('dni', 'DNI', { inputMode: 'numeric', maxLength: 8, placeholder: '8 dígitos' })}</div>
            <div className="col-12 col-md-8">{campo('nombres', 'Nombres *', { maxLength: 100 })}</div>
            <div className="col-6">{campo('apellidoPaterno', 'Apellido paterno *', { maxLength: 80 })}</div>
            <div className="col-6">{campo('apellidoMaterno', 'Apellido materno', { maxLength: 80 })}</div>
            <div className="col-6 col-md-4">{campo('telefono', 'Teléfono', { inputMode: 'tel', maxLength: 30 })}</div>
            <div className="col-6 col-md-5">{campo('correo', 'Correo', { type: 'email', maxLength: 150 })}</div>
            <div className="col-12 col-md-3">{campo('fechaNacimiento', 'Nacimiento', { type: 'date', max: fechaLocalIso() })}</div>
            {esNueva && puedeAsignarGrupo && (
              <div className="col-12">
                <label className="form-label small fw-semibold" htmlFor="p-grupo">
                  Incorporar a un grupo
                </label>
                <select
                  id="p-grupo"
                  className="form-select form-select-sm"
                  value={grupoId}
                  onChange={(e) => setGrupoId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Ninguno por ahora</option>
                  {grupos.map((g) => (
                    <option key={g.grupoId} value={g.grupoId}>
                      {g.nombre} · {g.etapa}
                    </option>
                  ))}
                </select>
                <div className="form-text small">Toma la etapa del grupo. También puede hacerlo después desde Grupos.</div>
              </div>
            )}
          </div>
          {error && (
            <div className="r21-notice warn" role="alert">
              <i className="pi pi-exclamation-triangle"></i>
              <div className="r21-notice-body">{error}</div>
            </div>
          )}
        </form>
      ) : (
        <form
          id="form-persona-estado"
          onSubmit={modo === 'eliminar' ? eliminar : modo === 'quitar-grupo' ? quitarDelGrupo : cambiarEstado} className="d-flex flex-column gap-3">
          <p className="small mb-0">
            <strong>{ficha ? nombreCompleto(ficha) : ''}</strong>
            {ficha?.dni ? ` · DNI ${ficha.dni}` : ''}
          </p>
          {modo === 'desactivar' && (
            <ul className="small mb-0 ps-3 d-flex flex-column gap-1">
              <li>{ficha?.grupo ? `Sale del grupo ${ficha.grupo}.` : 'No integra ningún grupo.'}</li>
              <li>{ficha?.etapa ? `Su etapa «${ficha.etapa}» queda como «Retirado».` : 'No tiene etapa vigente.'}</li>
              {ficha?.username && <li>Su cuenta @{ficha.username} queda inactiva y deja de ser encargado.</li>}
              <li>Su historial y sus asistencias se conservan.</li>
            </ul>
          )}
          {modo === 'quitar-grupo' && (
            <ul className="small mb-0 ps-3 d-flex flex-column gap-1">
              <li>Sale de {ficha?.grupo}.</li>
              <li>Si obtuvo su etapa al entrar a ese grupo, queda sin etapa; si ya la tenía, la conserva.</li>
              <li>Queda constancia en su historial y en los ex integrantes del grupo.</li>
            </ul>
          )}
          {modo === 'reactivar' && (
            <p className="small text-muted mb-0">
              Vuelve a estar disponible. Para que asista, incorpórela a un grupo desde <strong>Grupos → Agregar</strong>
              {ficha?.username ? '; su cuenta la reactiva un administrador' : ''}.
            </p>
          )}
          {modo === 'eliminar' ? (
            <p className="small mb-0">
              No tiene etapas, grupos, asistencias ni cuenta, así que se elimina por completo. Úselo solo para registros
              creados por error.
            </p>
          ) : (
            <div>
              <label className="form-label small fw-semibold" htmlFor="p-motivo">
                Motivo *
              </label>
              <textarea
                id="p-motivo"
                className="form-control form-control-sm"
                rows={2}
                maxLength={300}
                value={motivo}
                placeholder={
                  modo === 'desactivar'
                    ? 'Ej.: renuncia a la compañía'
                    : modo === 'quitar-grupo'
                      ? 'Ej.: se registró en el grupo equivocado'
                      : 'Ej.: retoma la instrucción'
                }
                onChange={(e) => setMotivo(e.target.value)}
              />
              <div className="form-text small">Queda registrado en la auditoría.</div>
            </div>
          )}
          {error && (
            <div className="r21-notice warn" role="alert">
              <i className="pi pi-exclamation-triangle"></i>
              <div className="r21-notice-body">{error}</div>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
