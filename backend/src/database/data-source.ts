import { DataSource } from 'typeorm';
import { SqlServerConnectionOptions } from 'typeorm/driver/sqlserver/SqlServerConnectionOptions';
import { config } from 'dotenv';

config();

// eslint-disable-next-line @typescript-eslint/no-var-requires
const msnodesqlv8 = require('mssql/msnodesqlv8');

export const dataSourceOptions: SqlServerConnectionOptions = {
  type: 'mssql',
  driver: msnodesqlv8,
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '1433', 10),
  database: process.env.DB_NAME ?? 'rimac21',
  // msnodesqlv8 (Windows Auth) usa trustedConnection; el tipo de TypeORM
  // solo contempla las opciones de tedious, por eso el cast.
  options: {
    trustedConnection: true,
    trustServerCertificate: true,
  } as SqlServerConnectionOptions['options'],
  entities: [__dirname + '/../modules/**/*.entity{.ts,.js}'],
  // El esquema (Rimac21Instruccion) es administrado externamente con scripts SQL
  // en /database/scripts. TypeORM opera en modo solo-lectura estructural:
  // sin synchronize y sin migraciones automaticas.
  synchronize: false,
  migrationsRun: false,
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
};

export const AppDataSource = new DataSource(dataSourceOptions);
