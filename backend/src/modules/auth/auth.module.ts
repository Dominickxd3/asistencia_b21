import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { SesionesService } from './services/sesiones.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { AuthzService } from '../roles/authz.service';
import { AuditModule } from '../audit/audit.module';
import { Usuario } from '../users/entities/usuario.entity';
import { Sesion } from './entities/sesion.entity';

@Global()
@Module({
  imports: [
    JwtModule.register({}),
    TypeOrmModule.forFeature([Usuario, Sesion]),
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    SesionesService,
    JwtAuthGuard,
    PermissionsGuard,
    AuthzService,
    // Guards globales: JWT -> identidad, Permissions -> autorizacion real en BD
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [AuthService, TokenService, SesionesService, JwtAuthGuard, PermissionsGuard, AuthzService],
})
export class AuthModule {}
