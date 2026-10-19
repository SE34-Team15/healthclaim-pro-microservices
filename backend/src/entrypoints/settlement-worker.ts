import { NestFactory } from '@nestjs/core';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { SettlementModule } from '../settlement/settlement.module';
import { RedisModule } from '../common/redis/redis.module';
import { RabbitMQModule } from '../common/rabbitmq/rabbitmq.module';

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
    StorageModule,
    SettlementModule,
  ],
})
class StandaloneSettlementWorkerModule {}

async function bootstrap() {
  const logger = new Logger('SettlementWorker');
  const app = await NestFactory.createApplicationContext(StandaloneSettlementWorkerModule);

  logger.log('[SettlementWorker] Asynchronous settlement consumer service started.');
  logger.log('[SettlementWorker] Listening for domain events: "claim.settled" ...');

  // Keep process alive
  process.on('SIGINT', async () => {
    logger.log('[SettlementWorker] Gracefully shutting down worker context...');
    await app.close();
    process.exit(0);
  });
}

bootstrap();
