import { DataSource, In } from 'typeorm';
import { Rol, Permiso, RolPermiso } from '../../modules/roles/entities/rol.entity';
import { ROLE_PERMISSION_MATRIX } from './role-permissions.data';

/** Asigna permisos a roles segun la matriz. Idempotente. */
export async function seedRolPermisos(ds: DataSource): Promise<void> {
  const roles = await ds.getRepository(Rol).find();
  const permisos = await ds.getRepository(Permiso).find();
  const permisoPorCodigo = new Map(permisos.map((p) => [p.codigo, p]));

  for (const [rolCodigo, codigos] of Object.entries(ROLE_PERMISSION_MATRIX)) {
    const rol = roles.find((r) => r.codigo === rolCodigo);
    if (!rol) continue;
    const idsObjetivo = codigos
      .map((c) => permisoPorCodigo.get(c)?.id)
      .filter((id): id is number => id !== undefined);

    const actuales = await ds.getRepository(RolPermiso).find({ where: { rolId: rol.id } });
    const actualesIds = new Set(actuales.map((rp) => rp.permisoId));

    const faltantes = idsObjetivo.filter((id) => !actualesIds.has(id));
    if (faltantes.length > 0) {
      await ds.getRepository(RolPermiso).save(
        faltantes.map((permisoId) => ({ rolId: rol.id, permisoId })),
      );
      console.log(`rol ${rolCodigo}: +${faltantes.length} permisos`);
    }

    const sobrantes = actuales.filter((rp) => !idsObjetivo.includes(rp.permisoId));
    if (sobrantes.length > 0) {
      await ds.getRepository(RolPermiso).delete({
        rolId: rol.id,
        permisoId: In(sobrantes.map((s) => s.permisoId)),
      });
      console.log(`rol ${rolCodigo}: -${sobrantes.length} permisos`);
    }
  }
}
