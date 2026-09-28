import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Sede } from "./entities/sede.entity";
import {
  ConfigSedeDto,
  CrearSedeDto,
  RegistrosGeograficosQueryDto,
  VerticeDto,
} from "./dto/sede.dto";
import { GeocercaService, UbicacionDispositivo } from "./geocerca.service";
import { areaMetros2, centroide, seAutointersecta } from "./geocerca.util";
import { AuditoriaService } from "../audit/auditoria.service";

const COMPANIA_ID = 1;
const TAMANO_PAGINA = 25;
const CACHE_GEOCODIFICACION_MS = 7 * 24 * 60 * 60 * 1000;

interface ResultadoNominatim {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: string[];
}

/** Abreviaturas de vías usadas en Perú, que Nominatim no reconoce */
const ABREVIATURAS_VIA: [RegExp, string][] = [
  [/^(jr|jir)\.?\s+/i, "Jirón "],
  [/^av\.?\s+/i, "Avenida "],
  [/^(ca|cl)\.?\s+/i, "Calle "],
  [/^(psje|pje|pj)\.?\s+/i, "Pasaje "],
  [/^(prolong|prol)\.?\s+/i, "Prolongación "],
  [/^(urb)\.?\s+/i, "Urbanización "],
];

function normalizarDireccion(consulta: string): string {
  let q = consulta.trim().replace(/\bN[°º.]?\s*(?=\d)/gi, "").replace(/#/g, "");
  for (const [patron, nombre] of ABREVIATURAS_VIA) q = q.replace(patron, nombre);
  return q.replace(/\s+/g, " ").trim();
}

/** Administración de sedes y de su geocerca poligonal */
@Injectable()
export class SedesService {
  private readonly cacheDirecciones = new Map<
    string,
    { vence: number; resultados: unknown[] }
  >();
  private colaNominatim: Promise<void> = Promise.resolve();
  private ultimaConsultaNominatim = 0;

  constructor(
    @InjectRepository(Sede)
    private readonly sedeRepo: Repository<Sede>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly geocerca: GeocercaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Búsqueda manual de direcciones. Se usa un proxy para identificar la aplicación,
   * limitarla a una petición por segundo y cachear respuestas durante siete días.
   * No se usa como autocompletado ni se ejecuta en segundo plano.
   */
  async buscarDirecciones(consulta: string) {
    const q = normalizarDireccion(consulta);
    const clave = q.toLocaleLowerCase("es");
    const cache = this.cacheDirecciones.get(clave);
    if (cache && cache.vence > Date.now()) return cache.resultados;

    // OSM casi no tiene números de puerta en Lima: sin resultados, se reintenta
    // solo con la vía. La sede principal prioriza resultados cercanos.
    const sede = await this.sedeRepo.findOne({
      where: { companiaId: COMPANIA_ID, esPrincipal: true, estado: "ACTIVO" },
    });
    const centro =
      sede?.latitud != null && sede?.longitud != null
        ? { lat: sede.latitud, lon: sede.longitud }
        : null;
    const viewbox = centro
      ? [centro.lon - 0.15, centro.lat + 0.15, centro.lon + 0.15, centro.lat - 0.15].join(",")
      : null;

    let resultados = await this.consultarNominatim(q, viewbox);
    const sinNumero = q.replace(/\b\d+[a-z]?\b/gi, "").replace(/\s+/g, " ").trim();
    if (resultados.length === 0 && sinNumero !== q && sinNumero.length >= 3) {
      resultados = await this.consultarNominatim(sinNumero, viewbox);
    }
    if (centro) {
      // Distancia aproximada (equirectangular), suficiente para ordenar
      const dist = (r: { latitud: number; longitud: number }) =>
        Math.hypot(r.latitud - centro.lat, (r.longitud - centro.lon) * Math.cos((centro.lat * Math.PI) / 180));
      resultados.sort((a, b) => dist(a) - dist(b));
    }
    resultados = resultados.slice(0, 5);
    this.cacheDirecciones.set(clave, {
      vence: Date.now() + CACHE_GEOCODIFICACION_MS,
      resultados,
    });
    return resultados;
  }

  /** Una consulta a Nominatim, respetando el límite de una petición por segundo */
  private async consultarNominatim(q: string, viewbox: string | null) {
    let resolver!: () => void;
    const turno = new Promise<void>((resolve) => {
      resolver = resolve;
    });
    const anterior = this.colaNominatim;
    this.colaNominatim = turno;
    await anterior;

    try {
      const espera = Math.max(
        0,
        1_050 - (Date.now() - this.ultimaConsultaNominatim),
      );
      if (espera) await new Promise((resolve) => setTimeout(resolve, espera));

      const origen =
        process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org";
      const url = new URL("/search", origen);
      url.searchParams.set("q", q);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "10");
      url.searchParams.set("countrycodes", "pe");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("accept-language", "es");
      if (viewbox) url.searchParams.set("viewbox", viewbox);

      this.ultimaConsultaNominatim = Date.now();
      const respuesta = await fetch(url, {
        headers: {
          "User-Agent":
            process.env.NOMINATIM_USER_AGENT ?? "Rimac21-Asistencia/1.0",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!respuesta.ok)
        throw new Error(`Nominatim respondió ${respuesta.status}`);

      const datos = (await respuesta.json()) as ResultadoNominatim[];
      return (Array.isArray(datos) ? datos : []).map((r) => ({
        id: String(r.place_id),
        nombre: r.display_name,
        latitud: Number(r.lat),
        longitud: Number(r.lon),
        limites: r.boundingbox?.length === 4 ? r.boundingbox.map(Number) : null,
      }));
    } catch {
      throw new ServiceUnavailableException(
        "OpenStreetMap no pudo completar la búsqueda. Intente nuevamente en unos segundos.",
      );
    } finally {
      resolver();
    }
  }

  async listar() {
    const sedes = await this.sedeRepo.find({
      relations: { vertices: true },
      order: { esPrincipal: "DESC", id: "ASC" },
    });
    const conteos: { sedeId: number; fuera: number; insuficiente: number }[] =
      await this.ds.query(
        `SELECT sede_id AS sedeId,
              SUM(CASE WHEN estado_geografico = 'FUERA_ZONA' THEN 1 ELSE 0 END) AS fuera,
              SUM(CASE WHEN estado_geografico = 'PRECISION_INSUFICIENTE' THEN 1 ELSE 0 END) AS insuficiente
       FROM asistencia_ubicaciones
       WHERE sede_id IS NOT NULL AND fecha_captura >= DATEADD(day, -30, GETDATE())
       GROUP BY sede_id`,
      );
    return sedes.map((s) =>
      this.toView(
        s,
        conteos.find((c) => c.sedeId === s.id),
      ),
    );
  }

  async obtener(id: number) {
    const sede = await this.geocerca.cargarSede(id);
    if (!sede) throw new NotFoundException("Sede no encontrada");
    return this.toView(sede);
  }

  async crear(dto: CrearSedeDto, usuarioId: number) {
    const sede = await this.sedeRepo.save(
      this.sedeRepo.create({
        companiaId: COMPANIA_ID,
        nombre: dto.nombre.trim(),
        direccion: dto.direccion?.trim() || null,
        latitud: null,
        longitud: null,
        radioGeocercaMetros: null,
        tipoGeocerca: "POLYGON",
        validacionActiva: dto.validacionActiva ?? true,
        toleranciaMetros: dto.toleranciaMetros ?? 0,
        precisionMaximaMetros: dto.precisionMaximaMetros ?? 100,
        politicaFueraZona: dto.politicaFueraZona ?? "BLOQUEAR",
        esPrincipal: false,
        estado: dto.estado ?? "ACTIVO",
        fechaActualizacion: null,
      }),
    );
    if (dto.esPrincipal) await this.marcarPrincipal(sede.id);
    await this.auditoria.registrar({
      usuarioId,
      accion: "SEDE_CREATED",
      modulo: "sedes",
      entidad: "sedes",
      entidadId: sede.id,
      valorNuevo: dto,
    });
    return this.obtener(sede.id);
  }

  async actualizar(id: number, dto: ConfigSedeDto, usuarioId: number) {
    const sede = await this.sedeRepo.findOne({ where: { id } });
    if (!sede) throw new NotFoundException("Sede no encontrada");
    if (dto.estado === "INACTIVO" && sede.esPrincipal) {
      throw new UnprocessableEntityException(
        "No se puede desactivar la sede principal; marque otra como principal primero",
      );
    }
    const anterior = this.config(sede);

    if (dto.nombre !== undefined) sede.nombre = dto.nombre.trim();
    if (dto.direccion !== undefined)
      sede.direccion = dto.direccion.trim() || null;
    if (dto.validacionActiva !== undefined)
      sede.validacionActiva = dto.validacionActiva;
    if (dto.toleranciaMetros !== undefined)
      sede.toleranciaMetros = dto.toleranciaMetros;
    if (dto.precisionMaximaMetros !== undefined)
      sede.precisionMaximaMetros = dto.precisionMaximaMetros;
    if (dto.politicaFueraZona !== undefined)
      sede.politicaFueraZona = dto.politicaFueraZona;
    if (dto.estado !== undefined) sede.estado = dto.estado;
    sede.fechaActualizacion = new Date();
    await this.sedeRepo.save(sede);
    if (dto.esPrincipal) await this.marcarPrincipal(id);

    await this.auditoria.registrar({
      usuarioId,
      accion: "SEDE_UPDATED",
      modulo: "sedes",
      entidad: "sedes",
      entidadId: id,
      valorAnterior: anterior,
      valorNuevo: this.config(sede),
    });
    return this.obtener(id);
  }

  /** Reemplaza el perímetro completo (orden = orden del arreglo). */
  async guardarGeocerca(id: number, vertices: VerticeDto[], usuarioId: number) {
    const sede = await this.geocerca.cargarSede(id);
    if (!sede) throw new NotFoundException("Sede no encontrada");

    const limpios = vertices.filter(
      (v, i) =>
        i === 0 ||
        v.latitud !== vertices[i - 1].latitud ||
        v.longitud !== vertices[i - 1].longitud,
    );
    if (limpios.length < 3) {
      throw new UnprocessableEntityException(
        "El perímetro necesita al menos 3 vértices distintos",
      );
    }
    if (seAutointersecta(limpios)) {
      throw new UnprocessableEntityException(
        "El perímetro se cruza consigo mismo; revise el orden de los vértices",
      );
    }
    const area = areaMetros2(limpios);
    if (area < 20) {
      throw new UnprocessableEntityException(
        "El polígono es demasiado pequeño (menos de 20 m²)",
      );
    }

    const anteriores = sede.vertices.map((v) => ({
      latitud: v.latitud,
      longitud: v.longitud,
    }));
    const centro = centroide(limpios);

    await this.ds.transaction(async (em) => {
      await em.query(`DELETE FROM sede_geocerca_vertices WHERE sede_id = @0`, [
        id,
      ]);
      for (let i = 0; i < limpios.length; i++) {
        await em.query(
          `INSERT INTO sede_geocerca_vertices (sede_id, orden, latitud, longitud) VALUES (@0, @1, @2, @3)`,
          [id, i + 1, limpios[i].latitud, limpios[i].longitud],
        );
      }
      await em.query(
        `UPDATE sedes SET tipo_geocerca = 'POLYGON', latitud = @1, longitud = @2, fecha_actualizacion = GETDATE()
         WHERE sede_id = @0`,
        [
          id,
          Number(centro.latitud.toFixed(6)),
          Number(centro.longitud.toFixed(6)),
        ],
      );
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: "GEOFENCE_UPDATED",
      modulo: "sedes",
      entidad: "sedes",
      entidadId: id,
      valorAnterior: { vertices: anteriores },
      valorNuevo: { vertices: limpios, areaMetros2: Math.round(area) },
    });
    return this.obtener(id);
  }

  /** Prueba un punto contra la geocerca sin registrar nada (calibración con dispositivos reales) */
  async evaluarPunto(id: number, geo: UbicacionDispositivo) {
    const sede = await this.geocerca.cargarSede(id);
    if (!sede) throw new NotFoundException("Sede no encontrada");
    return this.geocerca.evaluar(sede, geo);
  }

  /** Movimientos de asistencia con su evidencia geográfica (por defecto, los que requieren revisión) */
  async registrosGeograficos(q: RegistrosGeograficosQueryDto) {
    const condiciones: string[] = [];
    const params: unknown[] = [];
    const param = (v: unknown) => {
      params.push(v);
      return `@${params.length - 1}`;
    };
    if (q.estado) condiciones.push(`u.estado_geografico = ${param(q.estado)}`);
    else
      condiciones.push(
        `u.estado_geografico IN ('FUERA_ZONA', 'PRECISION_INSUFICIENTE')`,
      );
    if (q.sedeId) condiciones.push(`u.sede_id = ${param(q.sedeId)}`);
    if (q.desde)
      condiciones.push(`CAST(u.fecha_captura AS date) >= ${param(q.desde)}`);
    if (q.hasta)
      condiciones.push(`CAST(u.fecha_captura AS date) <= ${param(q.hasta)}`);
    const where = `WHERE ${condiciones.join(" AND ")}`;
    const pagina = q.pagina ?? 1;

    const [{ total }] = await this.ds.query(
      `SELECT COUNT(*) AS total FROM asistencia_ubicaciones u ${where}`,
      params,
    );
    const items = await this.ds.query(
      `SELECT u.ubicacion_id AS id, u.tipo_evento AS tipoEvento, u.estado_geografico AS estado,
              u.latitud, u.longitud, u.precision_metros AS precisionMetros,
              u.distancia_sede_metros AS distanciaMetros, u.tolerancia_aplicada_metros AS toleranciaMetros,
              u.fecha_captura AS fechaServidor, u.fecha_captura_dispositivo AS fechaDispositivo,
              u.jornada_id AS jornadaId, s.nombre AS sede, g.nombre AS grupo,
              CONVERT(char(10), j.fecha, 126) AS fechaJornada,
              p.apellido_paterno + ' ' + ISNULL(p.apellido_materno + ' ', '') + p.nombres AS persona,
              pr.apellido_paterno + ' ' + pr.nombres AS registradoPor
       FROM asistencia_ubicaciones u
       JOIN asistencias a ON a.asistencia_id = u.asistencia_id
       JOIN personas p ON p.persona_id = a.persona_id
       LEFT JOIN sedes s ON s.sede_id = u.sede_id
       LEFT JOIN jornadas j ON j.jornada_id = u.jornada_id
       LEFT JOIN grupos_formacion g ON g.grupo_id = j.grupo_id
       LEFT JOIN usuarios ur ON ur.usuario_id = u.usuario_id
       LEFT JOIN personas pr ON pr.persona_id = ur.persona_id
       ${where}
       ORDER BY u.fecha_captura DESC, u.ubicacion_id DESC
       OFFSET ${(pagina - 1) * TAMANO_PAGINA} ROWS FETCH NEXT ${TAMANO_PAGINA} ROWS ONLY`,
      params,
    );
    const num = (v: unknown) =>
      v === null || v === undefined ? null : Number(v);
    return {
      total,
      pagina,
      tamano: TAMANO_PAGINA,
      items: items.map((r: any) => ({
        ...r,
        id: Number(r.id),
        jornadaId: num(r.jornadaId),
        latitud: num(r.latitud),
        longitud: num(r.longitud),
        precisionMetros: num(r.precisionMetros),
        distanciaMetros: num(r.distanciaMetros),
        toleranciaMetros: num(r.toleranciaMetros),
      })),
    };
  }

  private async marcarPrincipal(id: number): Promise<void> {
    await this.ds.query(
      `UPDATE sedes SET es_principal = CASE WHEN sede_id = @0 THEN 1 ELSE 0 END WHERE compania_id = @1`,
      [id, COMPANIA_ID],
    );
  }

  private config(s: Sede) {
    return {
      nombre: s.nombre,
      direccion: s.direccion,
      validacionActiva: s.validacionActiva,
      toleranciaMetros: s.toleranciaMetros,
      precisionMaximaMetros: s.precisionMaximaMetros,
      politicaFueraZona: s.politicaFueraZona,
      estado: s.estado,
    };
  }

  private toView(s: Sede, conteo?: { fuera: number; insuficiente: number }) {
    const vertices = [...(s.vertices ?? [])]
      .sort((a, b) => a.orden - b.orden)
      .map((v) => ({
        orden: v.orden,
        latitud: v.latitud,
        longitud: v.longitud,
      }));
    return {
      id: s.id,
      nombre: s.nombre,
      direccion: s.direccion,
      tipoGeocerca: s.tipoGeocerca,
      validacionActiva: s.validacionActiva,
      toleranciaMetros: s.toleranciaMetros,
      precisionMaximaMetros: s.precisionMaximaMetros,
      politicaFueraZona: s.politicaFueraZona,
      esPrincipal: s.esPrincipal,
      estado: s.estado,
      centro:
        s.latitud != null && s.longitud != null
          ? { latitud: s.latitud, longitud: s.longitud }
          : null,
      vertices,
      areaMetros2:
        vertices.length >= 3 ? Math.round(areaMetros2(vertices)) : null,
      fechaActualizacion: s.fechaActualizacion,
      registrosFuera30d: Number(conteo?.fuera ?? 0),
      registrosPrecisionInsuficiente30d: Number(conteo?.insuficiente ?? 0),
    };
  }
}
