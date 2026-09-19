import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { PersonsModule } from './modules/persons/persons.module';
import { GroupsModule } from './modules/groups/groups.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { FormationModule } from './modules/formation/formation.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NoFutureDatesInterceptor } from './common/interceptors/no-future-dates.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    AuthModule,
    RealtimeModule,
    PersonsModule,
    GroupsModule,
    SessionsModule,
    AttendanceModule,
    DashboardModule,
    TrackingModule,
    FormationModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: NoFutureDatesInterceptor },
  ],
})
export class AppModule {}
