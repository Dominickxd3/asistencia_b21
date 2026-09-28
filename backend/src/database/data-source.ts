import { DataSource } from 'typeorm';
import { SqlServerConnectionOptions } from 'typeorm/driver/sqlserver/SqlServerConnectionOptions';
import { config } from 'dotenv';

config();

// eslint-disable-next-line @typescript-eslint/no-var-requires
const msnodesqlv8 = require('mssql/msnodesqlv8');

const DB_HOST = process.env.DB_HOST ?? 'localhost';
const DB_PORT = (process.env.DB_PORT ?? '').trim();
const DB_NAME = process.env.DB_NAME ?? 'rimac21';

/**
 * Cadena ODBC explícita. Por defecto mssql usa en Windows el driver «SQL Server
 * Native Client 11.0», que ya no se instala con SQL Server 2022; aquí se elige
 * con DB_ODBC_DRIVER. Sin DB_PORT se usa «servidor\instancia» tal cual (en el
 * mismo equipo conecta por memoria compartida, sin habilitar TCP ni SQL Browser).
 */
const connectionString = [
  `Driver={${process.env.DB_ODBC_DRIVER || 'ODBC Driver 17 for SQL Server'}}`,
  `Server=${DB_PORT ? `${DB_HOST},${DB_PORT}` : DB_HOST}`,
  `Database=${DB_NAME}`,
  'Trusted_Connection=yes',
  'TrustServerCertificate=yes',
].join(';');

export const dataSourceOptions: SqlServerConnectionOptions = {
  type: 'mssql',
  driver: msnodesqlv8,
  host: DB_HOST,
  database: DB_NAME,
  extra: { connectionString },
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
