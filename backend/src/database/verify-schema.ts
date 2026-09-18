import { AppDataSource } from './data-source';

/**
 * Verifica que cada entidad TypeORM coincida con el esquema real
 * consultando una fila (o cero) de cada tabla mapeada.
 */
async function verify() {
  await AppDataSource.initialize();
  const metas = AppDataSource.entityMetadatas;
  let failures = 0;

  for (const meta of metas) {
    try {
      await AppDataSource.getRepository(meta.target)
        .createQueryBuilder('e')
        .take(1)
        .getMany();
      console.log(`OK   ${meta.tableName}`);
    } catch (err: any) {
      failures++;
      console.log(`FAIL ${meta.tableName}: ${err.message?.split('\n')[0]}`);
    }
  }

  await AppDataSource.destroy();
  if (failures > 0) {
    console.log(`\n${failures} entidad(es) con problemas de mapeo`);
    process.exit(1);
  }
  console.log(`\nTodas las entidades (${metas.length}) coinciden con la BD`);
}

verify();
