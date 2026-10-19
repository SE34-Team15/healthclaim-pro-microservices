import { NestFactory } from '@nestjs/core';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaModule } from '../prisma/prisma.module';
import { RulesModule } from '../rules/rules.module';
import { HealthModule } from '../health/health.module';
import { RedisModule } from '../common/redis/redis.module';
import { RabbitMQModule } from '../common/rabbitmq/rabbitmq.module';
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
    HealthModule,
  ],
})
class StandaloneRuleEngineModule {}

async function bootstrap() {
  const logger = new Logger('RuleEngineService');
  const app = await NestFactory.create<NestExpressApplication>(StandaloneRuleEngineModule);

  const port = process.env.PORT || 3002;
  const apiPrefix = process.env.API_PREFIX || '/api/v1';

  app.setGlobalPrefix(apiPrefix.replace(/^\//, ''));
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.listen(port);
  logger.log(`[RuleEngineService] Microservice running at http://localhost:${port}`);
}

bootstrap();
