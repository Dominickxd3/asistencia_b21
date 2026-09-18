import { DataSource } from 'typeorm';
import { Persona } from '../../modules/persons/entities/persona.entity';
import { EtapaFormacion, Sede } from '../../modules/persons/entities/catalogos.entity';
import { PersonaEtapa } from '../../modules/persons/entities/persona-etapa.entity';
import { GrupoFormacion } from '../../modules/groups/entities/grupo-formacion.entity';
import { GrupoIntegrante } from '../../modules/groups/entities/grupo-integrante.entity';
import { GrupoEncargado } from '../../modules/groups/entities/grupo-encargado.entity';
import { Programacion, ProgramacionDetalle } from '../../modules/sessions/entities/programacion.entity';
import { Jornada } from '../../modules/sessions/entities/jornada.entity';
import { Usuario } from '../../modules/users/entities/usuario.entity';
import { COMPANIA_ID } from './usuarios.seed';

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Dia de semana 1=lunes ... 7=domingo (convencion de la BD) */
function diaSemanaHoy(): number {
  return ((new Date().getDay() + 6) % 7) + 1;
}

const GRUPOS_SEED = [
  {
    codigo: 'POST-2026-II', nombre: 'Postulantes 2026-II', etapaCodigo: 'POSTULANTE',
    integrantes: [
      ['Aldair', 'Escobar', 'Torres'], ['Bruno', 'Salazar', 'Vega'],
      ['César', 'Paredes', 'Luna'], ['Diego', 'Fuentes', 'Rojas'],
      ['Erick', 'Tello', 'Campos'], ['Fabián', 'Rojas', 'León'],
    ],
  },
  {
    codigo: 'ASP-2026-I', nombre: 'Aspirantes 2026-I', etapaCodigo: 'ASPIRANTE_COMPANIA',
    integrantes: [
      ['Gian', 'Córdova', 'Paz'], ['Hugo', 'Vargas', 'Soto'],
      ['Iván', 'Ramírez', 'Cruz'], ['Jorge', 'Medina', 'Flores'],
    ],
  },
  {
    codigo: 'ESBAS-2026-I', nombre: 'ESBAS 2026-I', etapaCodigo: 'ASPIRANTE_ESBAS',
    integrantes: [
      ['Kevin', 'Norabuena', 'Díaz'], ['Luis', 'Palacios', 'Guerra'],
      ['Marco', 'Quintana', 'Ponce'],
    ],
  },
];

/** Postulantes/aspirantes: lunes voluntario; mie, vie y dom obligatorio */
const HORARIO = [
  { dia: 1, tipo: 'VOLUNTARIA' },
  { dia: 3, tipo: 'OBLIGATORIA' },
  { dia: 5, tipo: 'OBLIGATORIA' },
  { dia: 7, tipo: 'OBLIGATORIA' },
];

export async function seedFormacionDemo(
  ds: DataSource,
  encargado: Usuario | undefined,
  jefe: Usuario | undefined,
): Promise<void> {
  const personaRepo = ds.getRepository(Persona);
  const grupoRepo = ds.getRepository(GrupoFormacion);

  const sede = await ds.getRepository(Sede).findOne({ where: { companiaId: COMPANIA_ID } });
  if (!sede) {
    await ds.getRepository(Sede).save({
      companiaId: COMPANIA_ID,
      nombre: 'Cuartel Central Rímac 21',
      latitud: null,
      longitud: null,
      radioGeocercaMetros: 150,
      politicaFueraZona: 'ADVERTIR',
      estado: 'ACTIVO',
    });
    console.log('sede OK: Cuartel Central Rímac 21');
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
      periodo: '2026-II',
      fechaInicio: '2026-08-03',
      fechaFin: null,
      estado: 'ACTIVO',
      creadoPorUsuarioId: jefe?.id ?? null,
    });

    const programacion = await ds.getRepository(Programacion).save({
      grupoId: grupo.id,
      fechaInicio: '2026-08-03',
      fechaFin: null,
      estado: 'ACTIVO',
      creadoPorUsuarioId: jefe?.id ?? null,
    });

    const detalles = await ds.getRepository(ProgramacionDetalle).save(
      HORARIO.map((h) => ({
        programacionId: programacion.id,
        diaSemana: h.dia,
        horaInicio: '19:00:00',
        horaFin: '22:00:00',
        tipoJornada: h.tipo,
        estado: 'ACTIVO',
      })),
    );

    let secuenciaDni = 1000;
    for (const [nombres, apePat, apeMat] of g.integrantes) {
      const persona = await personaRepo.save({
        companiaId: COMPANIA_ID,
        dni: `71${String(secuenciaDni++).padStart(4, '0')}${etapa.orden}`, // DNI demo unico
        nombres, apellidoPaterno: apePat, apellidoMaterno: apeMat,
        estado: 'ACTIVO',
      });
      await ds.getRepository(PersonaEtapa).save({
        personaId: persona.id,
        etapaId: etapa.id,
        grupoId: grupo.id,
        fechaInicio: '2026-08-03',
        fechaFin: null,
        estado: 'ACTIVO',
        registradoPorUsuarioId: jefe?.id ?? null,
      });
      await ds.getRepository(GrupoIntegrante).save({
        grupoId: grupo.id,
        personaId: persona.id,
        fechaInicio: '2026-08-03',
        estado: 'ACTIVO',
        creadoPorUsuarioId: jefe?.id ?? null,
      });
    }

    if (encargado && g.codigo === 'POST-2026-II') {
      await ds.query(
        `INSERT INTO grupo_encargados
           (grupo_id, usuario_id, fecha_inicio, fecha_fin, estado, asignado_por_usuario_id,
            motivo_finalizacion, fecha_creacion)
         VALUES (@0, @1, GETDATE(), NULL, 'ACTIVO', @2, NULL, GETDATE())`,
        [grupo.id, encargado.id, jefe?.id ?? null],
      );
    }

    // Jornada de hoy si el horario del grupo incluye el dia actual
    const detalleHoy = detalles.find((d) => d.diaSemana === diaHoy);
    if (detalleHoy) {
      const fechaHoy = hoy();
      const existe = await ds.getRepository(Jornada).findOne({
        where: { grupoId: grupo.id, fecha: fechaHoy },
      });
      if (!existe) {
        await ds.getRepository(Jornada).save({
          grupoId: grupo.id,
          programacionDetalleId: detalleHoy.id,
          fecha: fechaHoy,
          // horas como cadena ISO para evitar el desfase del driver
          inicioProgramada: `${fechaHoy}T${detalleHoy.horaInicio}` as unknown as Date,
          finProgramada: `${fechaHoy}T${detalleHoy.horaFin}` as unknown as Date,
          tipoJornada: detalleHoy.tipoJornada,
          origen: 'PROGRAMADA',
          estado: 'PROGRAMADA',
        });
      }
    }

    console.log(`grupo OK: ${grupo.nombre} (${g.integrantes.length} integrantes)`);
  }
}
