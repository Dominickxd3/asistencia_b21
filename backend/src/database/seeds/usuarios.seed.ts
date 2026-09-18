import { hash } from 'argon2';
import { DataSource } from 'typeorm';
import { Persona } from '../../modules/persons/entities/persona.entity';
import { Usuario, UsuarioRol } from '../../modules/users/entities/usuario.entity';
import { Rol } from '../../modules/roles/entities/rol.entity';
import { RoleCode } from '../../common/constants/roles.constants';
import { ROLE_PERMISSION_MATRIX } from './role-permissions.data';

export const COMPANIA_ID = 1;

interface UsuarioSeed {
  username: string;
  password: string;
  dni: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  rol: RoleCode;
}

/** Claves solo para desarrollo. Cambiar antes de produccion. */
export const USUARIOS_SEED: UsuarioSeed[] = [
  { username: 'admin', password: 'R21#Admin2026', dni: '70000001', nombres: 'Administrador', apellidoPaterno: 'Sistema', apellidoMaterno: 'Rimac21', rol: RoleCode.ADMIN },
  { username: 'jefe.instruccion', password: 'R21#Jefe2026', dni: '70000002', nombres: 'Carlos', apellidoPaterno: 'Quispe', apellidoMaterno: 'Mamani', rol: RoleCode.JEFE_INSTRUCCION },
  { username: 'encargado.postulantes', password: 'R21#Enc2026', dni: '70000003', nombres: 'Pedro', apellidoPaterno: 'Huamán', apellidoMaterno: 'Ríos', rol: RoleCode.ENCARGADO_GRUPO },
];

export async function seedUsuarios(ds: DataSource): Promise<Map<string, Usuario>> {
  const roles = await ds.getRepository(Rol).find();
  const rolPorCodigo = new Map(roles.map((r) => [r.codigo, r]));
  const creados = new Map<string, Usuario>();

  for (const seed of USUARIOS_SEED) {
    let usuario = await ds.getRepository(Usuario).findOne({ where: { username: seed.username } });
    if (!usuario) {
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
        passwordHash: await hash(seed.password),
        estadoCuenta: 'ACTIVA',
      });
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
        fechaInicio: new Date().toISOString().slice(0, 10),
        estado: 'ACTIVO',
      });
    }
    console.log(`usuario OK: ${usuario.username} (${seed.rol})`);
  }

  return creados;
}
