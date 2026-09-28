import { DataSource } from "typeorm";
import { Persona } from "../../modules/persons/entities/persona.entity";
import { EtapaFormacion } from "../../modules/persons/entities/catalogos.entity";
import { Sede } from "../../modules/sedes/entities/sede.entity";
import { PersonaEtapa } from "../../modules/persons/entities/persona-etapa.entity";
import { GrupoFormacion } from "../../modules/groups/entities/grupo-formacion.entity";
import { GrupoIntegrante } from "../../modules/groups/entities/grupo-integrante.entity";
import { GrupoEncargado } from "../../modules/groups/entities/grupo-encargado.entity";
import {
  Programacion,
  ProgramacionDetalle,
} from "../../modules/sessions/entities/programacion.entity";
import { Jornada } from "../../modules/sessions/entities/jornada.entity";
import { Usuario } from "../../modules/users/entities/usuario.entity";
import { COMPANIA_ID } from "./usuarios.seed";
import { fechaLocalIso } from "../../common/utils/fecha.util";

function hoy(): string {
  return fechaLocalIso();
}

/** Dia de semana 1=lunes ... 7=domingo (convencion de la BD) */
function diaSemanaHoy(): number {
  return ((new Date().getDay() + 6) % 7) + 1;
}

const GRUPOS_SEED = [
  {
    codigo: "POST-2026-II",
    nombre: "Postulantes 2026-II",
    etapaCodigo: "POSTULANTE",
    integrantes: [
      ["Aldair", "Escobar", "Torres"],
      ["Bruno", "Salazar", "Vega"],
      ["César", "Paredes", "Luna"],
      ["Diego", "Fuentes", "Rojas"],
      ["Erick", "Tello", "Campos"],
      ["Fabián", "Rojas", "León"],
    ],
  },
  {
    codigo: "ASP-2026-I",
    nombre: "Aspirantes 2026-I",
    etapaCodigo: "ASPIRANTE_COMPANIA",
    integrantes: [
      ["Gian", "Córdova", "Paz"],
      ["Hugo", "Vargas", "Soto"],
      ["Iván", "Ramírez", "Cruz"],
      ["Jorge", "Medina", "Flores"],
    ],
  },
  {
    codigo: "ESBAS-2026-I",
    nombre: "ESBAS 2026-I",
    etapaCodigo: "ASPIRANTE_ESBAS",
    integrantes: [
      ["Kevin", "Norabuena", "Díaz"],
      ["Luis", "Palacios", "Guerra"],
      ["Marco", "Quintana", "Ponce"],
    ],
  },
];

/** La voluntaria puede coexistir con la obligatoria como jornada independiente. */
const HORARIO_VOLUNTARIO = Array.from({ length: 7 }, (_, i) => ({
  dia: i + 1,
  tipo: "VOLUNTARIA",
  inicio: "08:00:00",
  fin: "18:30:00",
}));
const HORARIO_OBLIGATORIO = [
  { dia: 3, tipo: "OBLIGATORIA", inicio: "19:30:00", fin: "22:30:00" },
  { dia: 5, tipo: "OBLIGATORIA", inicio: "19:30:00", fin: "22:30:00" },
  { dia: 7, tipo: "OBLIGATORIA", inicio: "07:30:00", fin: "11:30:00" },
];

export async function seedFormacionDemo(
  ds: DataSource,
  encargado: Usuario | undefined,
  jefe: Usuario | undefined,
): Promise<void> {
  const personaRepo = ds.getRepository(Persona);
  const grupoRepo = ds.getRepository(GrupoFormacion);

  const sede = await ds
    .getRepository(Sede)
    .findOne({ where: { companiaId: COMPANIA_ID } });
  if (!sede) {
    // Centro real de referencia para abrir el mapa; no sustituye al perímetro dibujado.
    await ds.getRepository(Sede).save({
      companiaId: COMPANIA_ID,
      nombre: "Rímac 21",
      direccion: "Jr. Trujillo 836, Rímac, Lima",
      latitud: -12.03618,
      longitud: -77.02826,
      radioGeocercaMetros: null,
      tipoGeocerca: "POLYGON",
      validacionActiva: true,
      toleranciaMetros: 0,
      precisionMaximaMetros: 100,
      politicaFueraZona: "BLOQUEAR",
      esPrincipal: true,
      estado: "ACTIVO",
    });
    console.log("sede OK: Rímac 21 (geocerca pendiente de dibujar)");
  }

  const etapas = await ds.getRepository(EtapaFormacion).find();
  const etapaPorCodigo = new Map(etapas.map((e) => [e.codigo, e]));
  const diaHoy = diaSemanaHoy();

  for (const g of GRUPOS_SEED) {
    let grupo = await grupoRepo.findOne({ where: { codigo: g.codigo } });
    if (grupo) {
      console.log(`grupo ya existe: ${g.codigo} (omitido)`);
      continue;
    }
    const etapa = etapaPorCodigo.get(g.etapaCodigo);
    if (!etapa) throw new Error(`Etapa no encontrada: ${g.etapaCodigo}`);

    grupo = await grupoRepo.save({
      companiaId: COMPANIA_ID,
      etapaId: etapa.id,
      codigo: g.codigo,
      nombre: g.nombre,
      periodo: "2026-II",
      fechaInicio: "2026-08-03",
      fechaFin: null,
      estado: "ACTIVO",
      creadoPorUsuarioId: jefe?.id ?? null,
    });

    const programacion = await ds.getRepository(Programacion).save({
      grupoId: grupo.id,
      fechaInicio: "2026-08-03",
      fechaFin: null,
      estado: "ACTIVO",
      creadoPorUsuarioId: jefe?.id ?? null,
    });

    const horario = g.etapaCodigo === "ASPIRANTE_ESBAS"
      ? HORARIO_VOLUNTARIO
      : [...HORARIO_VOLUNTARIO, ...HORARIO_OBLIGATORIO];
    // INSERT directo: el driver transforma incorrectamente cadenas TIME al
    // guardarlas mediante repository.save() en algunos entornos Windows.
    const detalles: ProgramacionDetalle[] = [];
    for (const h of horario) {
      const [insertado] = await ds.query(
        `INSERT INTO programacion_detalles
           (programacion_id, dia_semana, hora_inicio, hora_fin, tipo_jornada, estado)
         OUTPUT INSERTED.programacion_detalle_id AS id
         VALUES (@0, @1, @2, @3, @4, 'ACTIVO')`,
        [programacion.id, h.dia, h.inicio, h.fin, h.tipo],
      );
      detalles.push({
        id: Number(insertado.id),
        programacionId: programacion.id,
        diaSemana: h.dia,
        horaInicio: h.inicio,
        horaFin: h.fin,
        tipoJornada: h.tipo,
        estado: "ACTIVO",
      } as ProgramacionDetalle);
    }

    let secuenciaDni = 1000;
    for (const [nombres, apePat, apeMat] of g.integrantes) {
      const persona = await personaRepo.save({
        companiaId: COMPANIA_ID,
        dni: `71${String(secuenciaDni++).padStart(4, "0")}${etapa.orden}`, // DNI demo unico
        nombres,
        apellidoPaterno: apePat,
        apellidoMaterno: apeMat,
        estado: "ACTIVO",
      });
      await ds.getRepository(PersonaEtapa).save({
        personaId: persona.id,
        etapaId: etapa.id,
        grupoId: grupo.id,
        fechaInicio: "2026-08-03",
        fechaFin: null,
        estado: "ACTIVO",
        registradoPorUsuarioId: jefe?.id ?? null,
      });
      await ds.getRepository(GrupoIntegrante).save({
        grupoId: grupo.id,
        personaId: persona.id,
        fechaInicio: "2026-08-03",
        estado: "ACTIVO",
        creadoPorUsuarioId: jefe?.id ?? null,
      });
    }

    if (encargado && g.codigo === "POST-2026-II") {
      await ds.query(
        `INSERT INTO grupo_encargados
           (grupo_id, usuario_id, fecha_inicio, fecha_fin, estado, asignado_por_usuario_id,
            motivo_finalizacion, fecha_creacion)
         VALUES (@0, @1, GETDATE(), NULL, 'ACTIVO', @2, NULL, GETDATE())`,
        [grupo.id, encargado.id, jefe?.id ?? null],
      );
    }

    // Jornada de hoy si el horario del grupo incluye el dia actual
    const detallesHoy = detalles.filter((d) => d.diaSemana === diaHoy);
    if (detallesHoy.length > 0) {
      const fechaHoy = hoy();
      for (const detalleHoy of detallesHoy) {
        const existe = await ds.getRepository(Jornada).findOne({
          where: { grupoId: grupo.id, fecha: fechaHoy, tipoJornada: detalleHoy.tipoJornada },
        });
        if (existe) continue;
        // INSERT directo con cadenas ISO: repository.save() las desplaza +5 h
        await ds.query(
          `INSERT INTO jornadas
             (grupo_id, programacion_detalle_id, fecha, fecha_hora_inicio_programada,
              fecha_hora_fin_programada, tipo_jornada, origen, estado, fecha_creacion)
           VALUES (@0, @1, @2, @3, @4, @5, 'PROGRAMADA', 'PROGRAMADA', GETDATE())`,
          [
            grupo.id,
            detalleHoy.id,
            fechaHoy,
            `${fechaHoy}T${detalleHoy.horaInicio}`,
            `${fechaHoy}T${detalleHoy.horaFin}`,
            detalleHoy.tipoJornada,
          ],
        );
      }
    }

    console.log(
      `grupo OK: ${grupo.nombre} (${g.integrantes.length} integrantes)`,
    );
  }
}
