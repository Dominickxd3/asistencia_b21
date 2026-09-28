import { useEffect, useMemo, useState } from 'react';
import { environment } from '../../environments/environment';
import { http, mensajeError } from '../../core/http/http';
import { geoService } from '../../core/services/geo.service';
import { EmptyState } from '../../shared/components/EmptyState';
import { GeoBadge } from '../../shared/components/GeoBadge';
import { PageHeader } from '../../shared/components/PageHeader';
import { useNotificar } from '../../shared/components/Notificaciones';
import { formatoFecha } from '../../shared/utils/format';
import {
  areaMetros2,
  perimetroMetros,
  seAutointersecta,
  type Coordenada,
} from '../../shared/utils/geocerca';
import { MapaGeocerca, type Enfoque, type PuntoPrueba } from './MapaGeocerca';
import './configuracion-sede.scss';

interface Vertice extends Coordenada {
  orden?: number;
}

interface Sede {
  id: number;
  nombre: string;
  direccion: string | null;
  tipoGeocerca: string;
  validacionActiva: boolean;
  toleranciaMetros: number;
  precisionMaximaMetros: number;
  politicaFueraZona: string;
  esPrincipal: boolean;
  estado: string;
  centro: Coordenada | null;
  vertices: Vertice[];
  areaMetros2: number | null;
  fechaActualizacion: string | null;
  registrosFuera30d: number;
  registrosPrecisionInsuficiente30d: number;
}

interface ConfigForm {
  nombre: string;
  direccion: string;
  validacionActiva: boolean;
  toleranciaMetros: number;
  precisionMaximaMetros: number;
  politicaFueraZona: string;
  esPrincipal: boolean;
  estado: string;
}

interface Evaluacion extends PuntoPrueba {
  sedeNombre: string | null;
  distanciaMetros: number | null;
  toleranciaMetros: number | null;
}

interface RegistroGeo {
  id: number;
  tipoEvento: string;
  estado: string;
  latitud: number | null;
  longitud: number | null;
  precisionMetros: number | null;
  distanciaMetros: number | null;
  fechaServidor: string;
  persona: string;
  registradoPor: string | null;
  grupo: string | null;
  fechaJornada: string | null;
}

interface ResultadoDireccion extends Coordenada {
  id: string;
  nombre: string;
  limites: number[] | null;
}

const base = `${environment.apiUrl}/sedes`;

function aFormulario(s: Sede): ConfigForm {
  return {
    nombre: s.nombre,
    direccion: s.direccion ?? '',
    validacionActiva: s.validacionActiva,
    toleranciaMetros: s.toleranciaMetros,
    precisionMaximaMetros: s.precisionMaximaMetros,
    politicaFueraZona: s.politicaFueraZona,
    esPrincipal: s.esPrincipal,
    estado: s.estado,
  };
}

export function ConfiguracionSedePage() {
  const notificar = useNotificar();
  const [sedes, setSedes] = useState<Sede[] | null>(null);
  const [sedeId, setSedeId] = useState<number | null>(null);
  const [form, setForm] = useState<ConfigForm | null>(null);
  const [vertices, setVertices] = useState<Coordenada[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [enfoque, setEnfoque] = useState<Enfoque | null>(null);
  const [prueba, setPrueba] = useState<Evaluacion | null>(null);
  const [probando, setProbando] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null);
  const [consultaDireccion, setConsultaDireccion] = useState('');
  const [buscandoDireccion, setBuscandoDireccion] = useState(false);
  const [resultadosDireccion, setResultadosDireccion] = useState<ResultadoDireccion[]>([]);
  const [referencia, setReferencia] = useState<Coordenada | null>(null);
  const [registros, setRegistros] = useState<RegistroGeo[]>([]);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [errorRegistros, setErrorRegistros] = useState<string | null>(null);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [nueva, setNueva] = useState({ nombre: '', direccion: '' });

  const sede = sedes?.find((s) => s.id === sedeId) ?? null;
  const invalido = vertices.length >= 4 && seAutointersecta(vertices);
  const area = vertices.length >= 3 ? areaMetros2(vertices) : 0;
  const perimetro = vertices.length >= 2 ? perimetroMetros(vertices) : 0;

  async function cargar(seleccionar?: number) {
    try {
      const lista = await http.get<Sede[]>(base);
      setSedes(lista);
      setSedeId((actual) => seleccionar ?? actual ?? lista[0]?.id ?? null);
    } catch (err) {
      setSedes([]);
      notificar.error('No se pudieron cargar las sedes', mensajeError(err));
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  useEffect(() => {
    if (!sede) return;
    setForm(aFormulario(sede));
    setVertices(sede.vertices.map(({ latitud, longitud }) => ({ latitud, longitud })));
    setSeleccionado(null);
    setPrueba(null);
    setConsultaDireccion(sede.direccion ?? '');
    setResultadosDireccion([]);
    setReferencia(sede.centro);
    if (sede.centro) setEnfoque({ coordenada: sede.centro, zoom: 19, clave: Date.now() });
  }, [sedeId, sedes]);

  useEffect(() => {
    if (!sedeId) return;
    setErrorRegistros(null);
    http
      .get<{ items: RegistroGeo[]; total: number }>(`${base}/registros-geograficos`, {
        params: { sedeId },
      })
      .then((r) => {
        setRegistros(r.items);
        setTotalRegistros(Number(r.total));
      })
      .catch((err) => {
        setRegistros([]);
        setErrorRegistros(mensajeError(err, 'No se pudieron consultar los registros geográficos'));
      });
  }, [sedeId]);

  const cambiosConfig = useMemo(
    () => !!sede && !!form && JSON.stringify(form) !== JSON.stringify(aFormulario(sede)),
    [form, sede],
  );
  const cambiosMapa = useMemo(
    () =>
      !!sede &&
      JSON.stringify(vertices) !==
        JSON.stringify(sede.vertices.map(({ latitud, longitud }) => ({ latitud, longitud }))),
    [vertices, sede],
  );

  function cambiar<K extends keyof ConfigForm>(campo: K, valor: ConfigForm[K]) {
    setForm((f) => (f ? { ...f, [campo]: valor } : f));
  }

  async function guardarConfiguracion() {
    if (!sedeId || !form) return;
    setGuardando(true);
    try {
      await http.patch(`${base}/${sedeId}`, form);
      await cargar(sedeId);
      notificar.exito('Configuración guardada');
    } catch (err) {
      notificar.error('No se pudo guardar', mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  async function guardarGeocerca() {
    if (!sedeId || vertices.length < 3 || invalido || area < 20) return;
    setGuardando(true);
    try {
      await http.put(`${base}/${sedeId}/geocerca`, { vertices });
      await cargar(sedeId);
      notificar.exito('Perímetro guardado', `${vertices.length} vértices · ${Math.round(area)} m²`);
    } catch (err) {
      notificar.error('No se pudo guardar el perímetro', mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  async function usarUbicacion(probar: boolean) {
    if (!sedeId) return;
    setProbando(true);
    const captura = await geoService.capturar(15_000);
    if (!captura.geo) {
      setErrorUbicacion(captura.codigo === 'PERMISO' ? captura.error : null);
      notificar.aviso('Ubicación no disponible', captura.error ?? undefined);
      setProbando(false);
      return;
    }
    setErrorUbicacion(null);
    setEnfoque({ coordenada: captura.geo, zoom: 20, clave: Date.now() });
    if (probar) {
      try {
        const resultado = await http.post<Evaluacion>(`${base}/${sedeId}/evaluar`, captura.geo);
        setPrueba(resultado);
      } catch (err) {
        notificar.error('No se pudo probar la ubicación', mensajeError(err));
      }
    }
    setProbando(false);
  }

  async function buscarDireccion() {
    const q = consultaDireccion.trim();
    if (q.length < 3) return;
    setBuscandoDireccion(true);
    setResultadosDireccion([]);
    try {
      const resultados = await http.get<ResultadoDireccion[]>(`${base}/buscar-direcciones`, {
        params: { q },
      });
      setResultadosDireccion(resultados);
      if (resultados.length === 0) {
        notificar.aviso(
          'Dirección no encontrada',
          'Pruebe sin el número, por ejemplo: Jirón Trujillo, Rímac, Lima.',
        );
      }
    } catch (err) {
      notificar.error('No se pudo buscar la dirección', mensajeError(err));
    } finally {
      setBuscandoDireccion(false);
    }
  }

  function elegirDireccion(resultado: ResultadoDireccion) {
    const punto = { latitud: resultado.latitud, longitud: resultado.longitud };
    setReferencia(punto);
    setEnfoque({ coordenada: punto, zoom: 19, clave: Date.now() });
    setResultadosDireccion([]);
  }

  async function crearSede() {
    if (!nueva.nombre.trim()) return;
    setGuardando(true);
    try {
      const creada = await http.post<Sede>(base, {
        nombre: nueva.nombre.trim(),
        direccion: nueva.direccion.trim(),
      });
      setNueva({ nombre: '', direccion: '' });
      setMostrarNueva(false);
      await cargar(creada.id);
      notificar.exito('Sede creada');
    } catch (err) {
      notificar.error('No se pudo crear la sede', mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <PageHeader titulo="Sede y geocerca" subtitulo="Configuración geográfica de asistencia">
        <button className="btn btn-sm btn-r21-outline" onClick={() => setMostrarNueva((v) => !v)}>
          <i className="pi pi-plus" /> Nueva sede
        </button>
      </PageHeader>

      {mostrarNueva && (
        <div className="r21-card r21-card-body">
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <label className="form-label small fw-semibold">Nombre</label>
              <input
                className="form-control"
                value={nueva.nombre}
                onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })}
              />
            </div>
            <div className="col-md-5">
              <label className="form-label small fw-semibold">Dirección</label>
              <input
                className="form-control"
                value={nueva.direccion}
                onChange={(e) => setNueva({ ...nueva, direccion: e.target.value })}
              />
            </div>
            <div className="col-md-3 d-flex gap-2">
              <button
                className="btn btn-r21"
                disabled={guardando || !nueva.nombre.trim()}
                onClick={() => void crearSede()}
              >
                Crear
              </button>
              <button className="btn btn-r21-outline" onClick={() => setMostrarNueva(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {sedes === null ? (
        <div className="r21-card r21-card-body text-center text-muted">Cargando…</div>
      ) : sedes.length === 0 ? (
        <div className="r21-card r21-card-body">
          <EmptyState mensaje="No hay sedes configuradas" icono="pi pi-map-marker" />
        </div>
      ) : (
        <>
          <div className="r21-sede-selector">
            {sedes.map((s) => (
              <button
                key={s.id}
                className={s.id === sedeId ? 'activo' : ''}
                onClick={() => setSedeId(s.id)}
              >
                <span>{s.nombre}</span>
                {s.esPrincipal && <small>Principal</small>}
              </button>
            ))}
          </div>

          {form && sede && (
            <div className="row g-3">
              <div className="col-12 col-xl-4">
                <section className="r21-card h-100">
                  <div className="r21-card-header">
                    <h2>Configuración</h2>
                    <span className="r21-badge neutro">{sede.tipoGeocerca}</span>
                  </div>
                  <div className="r21-card-body d-flex flex-column gap-3">
                    <div>
                      <label className="form-label small fw-semibold">Nombre</label>
                      <input
                        className="form-control"
                        value={form.nombre}
                        onChange={(e) => cambiar('nombre', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label small fw-semibold">Dirección</label>
                      <input
                        className="form-control"
                        value={form.direccion}
                        onChange={(e) => cambiar('direccion', e.target.value)}
                      />
                    </div>
                    <div className="row g-2">
                      <div className="col-6">
                        <label className="form-label small fw-semibold">Tolerancia (m)</label>
                        <input
                          type="number"
                          min="0"
                          max="200"
                          className="form-control"
                          value={form.toleranciaMetros}
                          onChange={(e) => cambiar('toleranciaMetros', Number(e.target.value))}
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label small fw-semibold">Precisión máxima (m)</label>
                        <input
                          type="number"
                          min="5"
                          max="5000"
                          className="form-control"
                          value={form.precisionMaximaMetros}
                          onChange={(e) => cambiar('precisionMaximaMetros', Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="form-label small fw-semibold">Regla de ubicación</label>
                      <select className="form-select" value={form.politicaFueraZona} disabled>
                        <option value="BLOQUEAR">Bloqueo estricto: solo dentro</option>
                      </select>
                      <div className="form-text">
                        Regla principal de asistencia: se exige ubicación precisa dentro del
                        perímetro.
                      </div>
                    </div>
                    <div className="form-check form-switch">
                      <input
                        id="geo-activa"
                        className="form-check-input"
                        type="checkbox"
                        checked={form.validacionActiva}
                        onChange={(e) => cambiar('validacionActiva', e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="geo-activa">
                        Validación geográfica activa
                      </label>
                      <div className="form-text">
                        Si se desactiva o no existe un perímetro válido, no se podrá marcar
                        asistencia.
                      </div>
                    </div>
                    <div className="alert alert-danger py-2 px-3 mb-0 small">
                      <i className="pi pi-lock me-2" />
                      Solo se podrá marcar entrada o salida desde dentro del polígono. Sin permiso
                      de ubicación, fuera del rango o con precisión insuficiente, el registro será
                      rechazado.
                    </div>
                    <div className="form-check form-switch">
                      <input
                        id="sede-principal"
                        className="form-check-input"
                        type="checkbox"
                        checked={form.esPrincipal}
                        disabled={form.esPrincipal}
                        onChange={(e) => cambiar('esPrincipal', e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="sede-principal">
                        Sede principal
                      </label>
                    </div>
                  </div>
                  <div className="r21-card-footer">
                    <span>
                      {sede.fechaActualizacion
                        ? `Actualizada ${formatoFecha(sede.fechaActualizacion, 'dd/MM/yyyy HH:mm')}`
                        : 'Sin actualizar'}
                    </span>
                    <button
                      className="btn btn-sm btn-r21"
                      disabled={guardando || !cambiosConfig}
                      onClick={() => void guardarConfiguracion()}
                    >
                      <i className="pi pi-save" /> Guardar
                    </button>
                  </div>
                </section>
              </div>

              <div className="col-12 col-xl-8">
                <section className="r21-card r21-geocerca-editor">
                  <div className="r21-card-header">
                    <div>
                      <h2>Perímetro de la sede</h2>
                      <p>Clic agrega · arrastra mueve · clic derecho elimina</p>
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-sm btn-r21-outline"
                        disabled={probando}
                        onClick={() => void usarUbicacion(false)}
                      >
                        <i className="pi pi-crosshairs" /> Centrar aquí
                      </button>
                      <button
                        className="btn btn-sm btn-r21-outline"
                        disabled={probando || vertices.length < 3}
                        onClick={() => void usarUbicacion(true)}
                      >
                        <i className="pi pi-map-marker" /> Probar ubicación
                      </button>
                    </div>
                  </div>
                  <div className="r21-buscador-mapa">
                    {errorUbicacion && (
                      <div className="alert alert-warning d-flex align-items-center justify-content-between gap-3 py-2 px-3 mb-2 small">
                        <span>
                          <i className="pi pi-exclamation-triangle me-2" />
                          {errorUbicacion}
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-warning text-nowrap"
                          onClick={() => window.location.reload()}
                        >
                          <i className="pi pi-refresh" /> Recargar y aplicar permiso
                        </button>
                      </div>
                    )}
                    <div className="input-group input-group-sm">
                      <span className="input-group-text">
                        <i className="pi pi-search" />
                      </span>
                      <input
                        className="form-control"
                        value={consultaDireccion}
                        placeholder="Buscar dirección o lugar en OpenStreetMap"
                        onChange={(e) => setConsultaDireccion(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void buscarDireccion();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-r21"
                        disabled={buscandoDireccion || consultaDireccion.trim().length < 3}
                        onClick={() => void buscarDireccion()}
                      >
                        {buscandoDireccion ? 'Buscando…' : 'Buscar en el mapa'}
                      </button>
                    </div>
                    {resultadosDireccion.length > 0 && (
                      <div className="r21-resultados-direccion">
                        {resultadosDireccion.map((r) => (
                          <button type="button" key={r.id} onClick={() => elegirDireccion(r)}>
                            <i className="pi pi-map-marker" />
                            <span>{r.nombre}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <small>
                      Búsqueda por OpenStreetMap. Seleccione un resultado y luego marque las
                      esquinas del terreno.
                    </small>
                  </div>
                  <MapaGeocerca
                    vertices={vertices}
                    onChange={setVertices}
                    seleccionado={seleccionado}
                    onSeleccionar={setSeleccionado}
                    enfoque={enfoque}
                    puntoPrueba={prueba}
                    puntoReferencia={referencia}
                  />
                  <div className="r21-geocerca-resumen">
                    <span>
                      <strong>{vertices.length}</strong> vértices
                    </span>
                    <span>
                      <strong>{Math.round(area)}</strong> m²
                    </span>
                    <span>
                      <strong>{Math.round(perimetro)}</strong> m perímetro
                    </span>
                    {invalido && (
                      <span className="text-danger">
                        <i className="pi pi-exclamation-triangle" /> El polígono se cruza
                      </span>
                    )}
                    {vertices.length > 0 && vertices.length < 3 && (
                      <span className="text-warning">Faltan {3 - vertices.length} vértices</span>
                    )}
                  </div>
                  {prueba && (
                    <div className="r21-prueba">
                      <GeoBadge
                        estado={prueba.estado}
                        precisionMetros={prueba.precisionMetros}
                        distanciaMetros={prueba.distanciaMetros}
                      />
                      <span>
                        {prueba.distanciaMetros != null
                          ? `${Math.round(prueba.distanciaMetros)} m del perímetro`
                          : 'Sin distancia calculada'}
                      </span>
                    </div>
                  )}
                  <div className="r21-card-footer">
                    <button
                      className="btn btn-sm btn-r21-outline"
                      disabled={!cambiosMapa}
                      onClick={() => {
                        setVertices(
                          sede.vertices.map(({ latitud, longitud }) => ({ latitud, longitud })),
                        );
                        setSeleccionado(null);
                      }}
                    >
                      Descartar cambios
                    </button>
                    <button
                      className="btn btn-sm btn-r21"
                      disabled={
                        guardando || !cambiosMapa || vertices.length < 3 || invalido || area < 20
                      }
                      onClick={() => void guardarGeocerca()}
                    >
                      <i className="pi pi-save" /> Guardar perímetro
                    </button>
                  </div>
                </section>
              </div>
            </div>
          )}

          <section className="r21-card">
            <div className="r21-card-header">
              <div>
                <h2>Registros que requieren revisión</h2>
                <p>Fuera de sede o con precisión insuficiente</p>
              </div>
              <span className="r21-badge warn">{totalRegistros} registros</span>
            </div>
            <div className="table-responsive">
              {errorRegistros ? (
                <div className="r21-card-body">
                  <EmptyState
                    mensaje="No se pudo cargar esta consulta"
                    descripcion={errorRegistros}
                    icono="pi pi-lock"
                  />
                </div>
              ) : registros.length === 0 ? (
                <div className="r21-card-body">
                  <EmptyState mensaje="No hay registros para revisar" icono="pi pi-check-circle" />
                </div>
              ) : (
                <table className="table table-hover align-middle">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Persona</th>
                      <th>Acción</th>
                      <th>Resultado</th>
                      <th>Grupo / jornada</th>
                      <th>Registrado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registros.map((r) => (
                      <tr key={r.id}>
                        <td className="text-nowrap">
                          {formatoFecha(r.fechaServidor, 'dd/MM/yyyy HH:mm')}
                        </td>
                        <td className="fw-semibold">{r.persona}</td>
                        <td>{r.tipoEvento}</td>
                        <td>
                          <GeoBadge
                            estado={r.estado}
                            precisionMetros={r.precisionMetros}
                            distanciaMetros={r.distanciaMetros}
                            compacto
                          />
                        </td>
                        <td>
                          {r.grupo ?? '—'}
                          {r.fechaJornada ? ` · ${r.fechaJornada}` : ''}
                        </td>
                        <td>{r.registradoPor ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
