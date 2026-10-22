import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PoliciesModule } from './policies/policies.module';
import { AuditModule } from './audit/audit.module';
import { RulesModule } from './rules/rules.module';
import { ActuarialModule } from './actuarial/actuarial.module';
import { ClaimsModule } from './claims/claims.module';
import { StorageModule } from './storage/storage.module';
import { DepartmentsModule } from './departments/departments.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './common/redis/redis.module';
import { RabbitMQModule } from './common/rabbitmq/rabbitmq.module';
import { MailModule } from './common/mail/mail.module';
import { SettlementModule } from './settlement/settlement.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    EventEmitterModule.forRoot(),
    RedisModule,
    RabbitMQModule,
    MailModule,
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    PoliciesModule,
    RulesModule,
    ActuarialModule,
    ClaimsModule,
    StorageModule,
    DepartmentsModule,
    AnalyticsModule,
    HealthModule,
    SettlementModule,
  ],
})
export class AppModule {}
