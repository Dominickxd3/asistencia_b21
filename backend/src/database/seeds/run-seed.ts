import { AppDataSource } from '../data-source';
import { seedRolPermisos } from './rol-permisos.seed';
import { seedUsuarios } from './usuarios.seed';
import { seedFormacionDemo } from './formacion-demo.seed';

async function run() {
  const ds = await AppDataSource.initialize();
  console.log('Conectado a', ds.options.database);

  // En producción solo se crean los permisos y la cuenta admin: nada de datos de demostración
  const incluirDemo = process.env.NODE_ENV !== 'production';
  await seedRolPermisos(ds);
  const usuarios = await seedUsuarios(ds, incluirDemo);
  if (incluirDemo) {
    await seedFormacionDemo(
      ds,
      usuarios.get('encargado.postulantes'),
      usuarios.get('jefe.instruccion'),
    );
  }

  await ds.destroy();
  console.log('Seed completado');
}

run().catch((err) => {
  console.error('Error en seed:', err.message);
  process.exit(1);
});
