import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Public } from '../modules/auth/decorators/auth.decorators';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    const dbOk = this.dataSource.isInitialized;
    let dbName: string | null = null;
    if (dbOk) {
      const result = await this.dataSource.query('SELECT DB_NAME() AS db');
      dbName = result[0]?.db ?? null;
    }
    return {
      status: dbOk ? 'ok' : 'degraded',
      database: dbName,
      timestamp: new Date().toISOString(),
    };
  }
}
