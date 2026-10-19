import { NestFactory } from '@nestjs/core';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaModule } from '../prisma/prisma.module';
import { ClaimsModule } from '../claims/claims.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { DepartmentsModule } from '../departments/departments.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { HealthModule } from '../health/health.module';
import { RedisModule } from '../common/redis/redis.module';
import { RabbitMQModule } from '../common/rabbitmq/rabbitmq.module';
import { RulesModule } from '../rules/rules.module';
import { ActuarialModule } from '../actuarial/actuarial.module';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    EventEmitterModule.forRoot(),
    RedisModule,
    RabbitMQModule,
    PrismaModule,
    RulesModule,
    ActuarialModule,
    ClaimsModule,
    AuthModule,
    UsersModule,
    AuditModule,
    StorageModule,
    DepartmentsModule,
    AnalyticsModule,
    HealthModule,
  ],
})
class StandaloneClaimServiceModule {}

async function bootstrap() {
  const logger = new Logger('ClaimService');
  const app = await NestFactory.create<NestExpressApplication>(StandaloneClaimServiceModule);

  app.set('trust proxy', true);

  const port = process.env.PORT || 3001;
  const apiPrefix = process.env.API_PREFIX || '/api/v1';

  app.setGlobalPrefix(apiPrefix.replace(/^\//, ''));
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.listen(port);
  logger.log(`[ClaimService] Microservice running at http://localhost:${port}`);
}

bootstrap();
