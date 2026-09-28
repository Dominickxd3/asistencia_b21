import { useEffect, useState, type FormEvent } from 'react';
import { mensajeError } from '../../core/http/http';
import { Modal } from '../../shared/components/Modal';
import { fechaLocalIso } from '../../shared/utils/format';
import type { CatalogosGrupo, GrupoDetalle, GrupoForm } from './grupos.models';

const PREFIJO_CODIGO: Record<string, string> = {
  POSTULANTE: 'POST',
  ASPIRANTE_COMPANIA: 'ASP',
  ASPIRANTE_ESBAS: 'ESBAS',
};
const PREFIJO_NOMBRE: Record<string, string> = {
  POSTULANTE: 'Postulantes',
  ASPIRANTE_COMPANIA: 'Aspirantes',
  ASPIRANTE_ESBAS: 'ESBAS',
};
const CON_OBLIGATORIAS = ['POSTULANTE', 'ASPIRANTE_COMPANIA'];
const DIAS = [
  { numero: 1, nombre: 'Lunes' },
  { numero: 2, nombre: 'Martes' },
  { numero: 3, nombre: 'Miércoles' },
  { numero: 4, nombre: 'Jueves' },
  { numero: 5, nombre: 'Viernes' },
  { numero: 6, nombre: 'Sábado' },
  { numero: 7, nombre: 'Domingo' },
];
const HORARIO_PREDETERMINADO = [
  { diaSemana: 3, horaInicio: '19:30' },
  { diaSemana: 5, horaInicio: '19:30' },
  { diaSemana: 7, horaInicio: '07:30' },
];

/** Periodo por defecto: 2026-I (ene–jun) o 2026-II (jul–dic) */
function periodoActual(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${hoy.getMonth() < 6 ? 'I' : 'II'}`;
}

function formDesde(grupo: GrupoDetalle | null, catalogos: CatalogosGrupo | null): GrupoForm {
  if (grupo) {
    return {
      etapaId: grupo.etapaId,
      codigo: grupo.codigo,
      nombre: grupo.nombre,
      periodo: grupo.periodo,
      fechaInicio: grupo.fechaInicio,
      fechaFin: grupo.fechaFin ?? '',
      programacionObligatoria: grupo.programacionObligatoria,
    };
  }
  const primeraEtapa = catalogos?.etapas[0];
  return {
    etapaId: catalogos?.etapas[0]?.id ?? '',
    codigo: '',
    nombre: '',
    periodo: periodoActual(),
    fechaInicio: fechaLocalIso(),
    fechaFin: '',
    programacionObligatoria:
      primeraEtapa && CON_OBLIGATORIAS.includes(primeraEtapa.codigo)
        ? HORARIO_PREDETERMINADO
        : [],
  };
}

interface Props {
  visible: boolean;
  /** null = nuevo grupo */
  grupo: GrupoDetalle | null;
  catalogos: CatalogosGrupo | null;
  onCerrar: () => void;
  onGuardar: (form: GrupoForm) => Promise<void>;
}

export function GrupoFormModal({ visible, grupo, catalogos, onCerrar, onGuardar }: Props) {
  const esNuevo = grupo === null;
  const [form, setForm] = useState<GrupoForm>(() => formDesde(grupo, catalogos));
  // Mientras el usuario no los edite, código y nombre se sugieren desde etapa + periodo
  const [codigoManual, setCodigoManual] = useState(!esNuevo);
  const [nombreManual, setNombreManual] = useState(!esNuevo);
  const [enviado, setEnviado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setForm(formDesde(grupo, catalogos));
    setCodigoManual(!esNuevo);
    setNombreManual(!esNuevo);
    setEnviado(false);
    setError(null);
  }, [visible, grupo, catalogos, esNuevo]);

  const etapa = catalogos?.etapas.find((e) => e.id === form.etapaId) ?? null;
  const admiteObligatorias = etapa ? CON_OBLIGATORIAS.includes(etapa.codigo) : false;

  useEffect(() => {
    if (!etapa) return;
    setForm((f) => ({
      ...f,
      codigo: codigoManual ? f.codigo : `${PREFIJO_CODIGO[etapa.codigo] ?? 'GRP'}-${f.periodo.trim().toUpperCase()}`,
      nombre: nombreManual ? f.nombre : `${PREFIJO_NOMBRE[etapa.codigo] ?? etapa.nombre} ${f.periodo.trim()}`,
    }));
  }, [etapa, form.periodo, codigoManual, nombreManual]);

  const errores = {
    etapaId: form.etapaId === '' ? 'Seleccione la etapa' : null,
    codigo: !form.codigo.trim()
      ? 'Indique un código'
      : !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(form.codigo.trim())
        ? 'Solo letras, números, punto y guiones, sin espacios'
        : null,
    nombre: !form.nombre.trim() ? 'Indique un nombre' : null,
    periodo: !form.periodo.trim() ? 'Indique el periodo' : null,
    fechaInicio: !form.fechaInicio ? 'Indique la fecha de inicio' : null,
    fechaFin:
      form.fechaFin && form.fechaInicio && form.fechaFin < form.fechaInicio
        ? 'No puede ser anterior al inicio'
        : null,
    programacionObligatoria:
      admiteObligatorias && form.programacionObligatoria.length === 0
        ? 'Seleccione al menos un día obligatorio'
        : null,
  };
  const valido = Object.values(errores).every((e) => e === null);
  const err = (campo: keyof typeof errores) => (enviado ? errores[campo] : null);

  async function guardar(e: FormEvent): Promise<void> {
    e.preventDefault();
    setEnviado(true);
    if (!valido || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      await onGuardar(form);
    } catch (ex) {
      setError(mensajeError(ex, 'No se pudo guardar el grupo'));
    } finally {
      setGuardando(false);
    }
  }

  const etapaBloqueada = !esNuevo && !grupo?.etapaEditable;

  return (
    <Modal
      titulo={esNuevo ? 'Nuevo grupo' : `Editar ${grupo?.nombre}`}
      visible={visible}
      onCerrar={onCerrar}
      bloqueado={guardando}
      ancho="lg"
      acciones={
        <>
          <button type="button" className="btn btn-sm btn-r21-outline" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" form="form-grupo" className="btn btn-sm btn-r21" disabled={guardando}>
            {guardando && <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>}
            {esNuevo ? 'Crear grupo' : 'Guardar cambios'}
          </button>
        </>
      }
    >
      <form id="form-grupo" onSubmit={guardar} noValidate className="r21-grupo-form">
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label small fw-semibold" htmlFor="g-etapa">
              Etapa de formación *
            </label>
            <select
              id="g-etapa"
              className={`form-select form-select-sm${err('etapaId') ? ' is-invalid' : ''}`}
              value={form.etapaId}
              disabled={etapaBloqueada}
              onChange={(e) => {
                const etapaId = e.target.value ? Number(e.target.value) : '';
                const codigo = catalogos?.etapas.find((item) => item.id === etapaId)?.codigo;
                const obligatoria = codigo ? CON_OBLIGATORIAS.includes(codigo) : false;
                setForm({
                  ...form,
                  etapaId,
                  programacionObligatoria: obligatoria
                    ? form.programacionObligatoria.length > 0
                      ? form.programacionObligatoria
                      : HORARIO_PREDETERMINADO
                    : [],
                });
              }}
            >
              {catalogos?.etapas.map((et) => (
                <option key={et.id} value={et.id}>
                  {et.nombre}
                </option>
              ))}
            </select>
            {etapaBloqueada && (
              <div className="form-text small">
                <i className="pi pi-lock me-1"></i>
                No editable: el grupo ya tiene integrantes o asistencias. Para cambiar de etapa a una persona use
                «Promover».
              </div>
            )}
            {err('etapaId') && <div className="r21-field-error">{err('etapaId')}</div>}
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label small fw-semibold" htmlFor="g-periodo">
              Periodo *
            </label>
            <input
              id="g-periodo"
              className={`form-control form-control-sm${err('periodo') ? ' is-invalid' : ''}`}
              maxLength={30}
              placeholder="2026-II"
              value={form.periodo}
              onChange={(e) => setForm({ ...form, periodo: e.target.value })}
            />
            {err('periodo') && <div className="r21-field-error">{err('periodo')}</div>}
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label small fw-semibold" htmlFor="g-codigo">
              Código *
            </label>
            <input
              id="g-codigo"
              className={`form-control form-control-sm text-uppercase${err('codigo') ? ' is-invalid' : ''}`}
              maxLength={60}
              value={form.codigo}
              onChange={(e) => {
                // Se muestra en mayúsculas por CSS y se normaliza al guardar: transformar aquí
                // movería el cursor al final al editar en medio del código
                setCodigoManual(true);
                setForm({ ...form, codigo: e.target.value });
              }}
            />
            {err('codigo') && <div className="r21-field-error">{err('codigo')}</div>}
          </div>
          <div className="col-12">
            <label className="form-label small fw-semibold" htmlFor="g-nombre">
              Nombre *
            </label>
            <input
              id="g-nombre"
              className={`form-control form-control-sm${err('nombre') ? ' is-invalid' : ''}`}
              maxLength={150}
              value={form.nombre}
              onChange={(e) => {
                setNombreManual(true);
                setForm({ ...form, nombre: e.target.value });
              }}
            />
            {err('nombre') && <div className="r21-field-error">{err('nombre')}</div>}
          </div>
          <div className="col-6">
            <label className="form-label small fw-semibold" htmlFor="g-inicio">
              Inicio *
            </label>
            <input
              id="g-inicio"
              type="date"
              className={`form-control form-control-sm${err('fechaInicio') ? ' is-invalid' : ''}`}
              value={form.fechaInicio}
              onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
            />
            {err('fechaInicio') && <div className="r21-field-error">{err('fechaInicio')}</div>}
          </div>
          <div className="col-6">
            <label className="form-label small fw-semibold" htmlFor="g-fin">
              Fin previsto
            </label>
            <input
              id="g-fin"
              type="date"
              className={`form-control form-control-sm${err('fechaFin') ? ' is-invalid' : ''}`}
              value={form.fechaFin}
              min={form.fechaInicio || undefined}
              onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
            />
            {err('fechaFin') && <div className="r21-field-error">{err('fechaFin')}</div>}
          </div>
        </div>

        {admiteObligatorias && (
          <fieldset className="mt-3">
            <legend className="form-label small fw-semibold mb-1">Días de asistencia obligatoria *</legend>
            <div className="form-text mt-0 mb-2">
              Seleccione los días y la hora de entrada. La salida es libre hasta las 23:59 y los cambios rigen desde
              el día siguiente.
            </div>
            <div className="row g-2">
              {DIAS.map((dia) => {
                const horario = form.programacionObligatoria.find((h) => h.diaSemana === dia.numero);
                return (
                  <div className="col-12 col-sm-6 col-lg-4" key={dia.numero}>
                    <div className="border rounded px-3 py-2 d-flex align-items-center gap-2 h-100">
                      <input
                        className="form-check-input mt-0"
                        type="checkbox"
                        id={`g-dia-${dia.numero}`}
                        checked={Boolean(horario)}
                        onChange={(e) => {
                          const programacionObligatoria = e.target.checked
                            ? [...form.programacionObligatoria, { diaSemana: dia.numero, horaInicio: '19:30' }]
                            : form.programacionObligatoria.filter((h) => h.diaSemana !== dia.numero);
                          setForm({
                            ...form,
                            programacionObligatoria: programacionObligatoria.sort(
                              (a, b) => a.diaSemana - b.diaSemana,
                            ),
                          });
                        }}
                      />
                      <label className="small fw-semibold flex-grow-1" htmlFor={`g-dia-${dia.numero}`}>
                        {dia.nombre}
                      </label>
                      <input
                        type="time"
                        className="form-control form-control-sm"
                        style={{ width: 105 }}
                        aria-label={`Hora de entrada del ${dia.nombre}`}
                        value={horario?.horaInicio ?? '19:30'}
                        disabled={!horario}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            programacionObligatoria: form.programacionObligatoria.map((h) =>
                              h.diaSemana === dia.numero ? { ...h, horaInicio: e.target.value } : h,
                            ),
                          })
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {err('programacionObligatoria') && (
              <div className="r21-field-error mt-1">{err('programacionObligatoria')}</div>
            )}
          </fieldset>
        )}

        {esNuevo && etapa && (
          <div className="r21-notice info mt-3">
            <i className="pi pi-calendar"></i>
            <div className="r21-notice-body">
              Se generará la programación indicada:{' '}
              {CON_OBLIGATORIAS.includes(etapa.codigo) ? (
                <>
                  jornadas <strong>obligatorias</strong> en los días seleccionados, y contexto{' '}
                  <strong>voluntario</strong> disponible durante todo el día, sin horario fijo.
                </>
              ) : (
                <>
                  solo contexto <strong>voluntario</strong> disponible durante todo el día, sin horario fijo (la etapa ESBAS no tiene jornadas
                  obligatorias).
                </>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="r21-notice warn mt-3" role="alert">
            <i className="pi pi-exclamation-triangle"></i>
            <div className="r21-notice-body">{error}</div>
          </div>
        )}
      </form>
    </Modal>
  );
}
