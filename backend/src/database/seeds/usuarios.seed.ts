import { randomBytes } from 'crypto';
import { hash } from 'argon2';
import { DataSource } from 'typeorm';
import { Persona } from '../../modules/persons/entities/persona.entity';
import { Usuario, UsuarioRol } from '../../modules/users/entities/usuario.entity';
import { Rol } from '../../modules/roles/entities/rol.entity';
import { RoleCode } from '../../common/constants/roles.constants';
import { ROLE_PERMISSION_MATRIX } from './role-permissions.data';
import { fechaLocalIso } from '../../common/utils/fecha.util';

export const COMPANIA_ID = 1;

interface UsuarioSeed {
  username: string;
  /** Variable de entorno con la contraseña inicial; si falta, se genera una aleatoria */
  passwordEnv: string;
  dni: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  rol: RoleCode;
  /** Solo para datos de demostración: no se crea en producción */
  soloDemo?: boolean;
}

/**
 * Cuentas iniciales. Ninguna contraseña vive en el código: se toma de la
 * variable indicada o se genera al crear la cuenta y se muestra una sola vez.
 */
export const USUARIOS_SEED: UsuarioSeed[] = [
  { username: 'admin', passwordEnv: 'SEED_ADMIN_PASSWORD', dni: '70000001', nombres: 'Administrador', apellidoPaterno: 'Sistema', apellidoMaterno: 'Rimac21', rol: RoleCode.ADMIN },
  { username: 'jefe.instruccion', passwordEnv: 'SEED_JEFE_PASSWORD', dni: '70000002', nombres: 'Carlos', apellidoPaterno: 'Quispe', apellidoMaterno: 'Mamani', rol: RoleCode.JEFE_INSTRUCCION, soloDemo: true },
  { username: 'encargado.postulantes', passwordEnv: 'SEED_ENCARGADO_PASSWORD', dni: '70000003', nombres: 'Pedro', apellidoPaterno: 'Huamán', apellidoMaterno: 'Ríos', rol: RoleCode.ENCARGADO_GRUPO, soloDemo: true },
];

/** Contraseña inicial fuerte (16 caracteres URL-safe) */
function passwordAleatoria(): string {
  return randomBytes(12).toString('base64url');
}

export async function seedUsuarios(ds: DataSource, incluirDemo: boolean): Promise<Map<string, Usuario>> {
  const roles = await ds.getRepository(Rol).find();
  const rolPorCodigo = new Map(roles.map((r) => [r.codigo, r]));
  const creados = new Map<string, Usuario>();

  for (const seed of USUARIOS_SEED) {
    if (seed.soloDemo && !incluirDemo) continue;
    let usuario = await ds.getRepository(Usuario).findOne({ where: { username: seed.username } });
    if (!usuario) {
      const definida = process.env[seed.passwordEnv];
      if (definida !== undefined && definida.length < 12) {
        throw new Error(`${seed.passwordEnv} debe tener al menos 12 caracteres`);
      }
      const password = definida ?? passwordAleatoria();
      const persona = await ds.getRepository(Persona).save({
        companiaId: COMPANIA_ID,
        dni: seed.dni,
        nombres: seed.nombres,
        apellidoPaterno: seed.apellidoPaterno,
        apellidoMaterno: seed.apellidoMaterno,
        estado: 'ACTIVO',
      });
      usuario = await ds.getRepository(Usuario).save({
        personaId: persona.id,
        username: seed.username,
        passwordHash: await hash(password),
        estadoCuenta: 'ACTIVA',
      });
      if (definida === undefined) {
        console.log(`  → contraseña inicial de ${seed.username}: ${password}  (anótela; no se volverá a mostrar)`);
      }
    }
    creados.set(seed.username, usuario);

    const rol = rolPorCodigo.get(seed.rol);
    if (!rol) throw new Error(`Rol no encontrado en BD: ${seed.rol}`);
    const yaTiene = await ds.getRepository(UsuarioRol).findOne({
      where: { usuarioId: usuario.id, rolId: rol.id, estado: 'ACTIVO' },
    });
    if (!yaTiene) {
      await ds.getRepository(UsuarioRol).save({
        usuarioId: usuario.id,
        rolId: rol.id,
        fechaInicio: fechaLocalIso(),
        estado: 'ACTIVO',
      });
    }
    console.log(`usuario OK: ${usuario.username} (${seed.rol})`);
  }

  return creados;
}
