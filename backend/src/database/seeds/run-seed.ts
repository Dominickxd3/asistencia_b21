import { AppDataSource } from '../data-source';
import { seedRolPermisos } from './rol-permisos.seed';
import { seedUsuarios } from './usuarios.seed';
import { seedFormacionDemo } from './formacion-demo.seed';

async function run() {
  const ds = await AppDataSource.initialize();
  console.log('Conectado a', ds.options.database);

  await seedRolPermisos(ds);
  const usuarios = await seedUsuarios(ds);
  await seedFormacionDemo(
    ds,
    usuarios.get('encargado.postulantes'),
    usuarios.get('jefe.instruccion'),
  );

  await ds.destroy();
  console.log('Seed completado');
}

run().catch((err) => {
  console.error('Error en seed:', err.message);
  process.exit(1);
});
