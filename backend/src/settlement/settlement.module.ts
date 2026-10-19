import { Module } from '@nestjs/common';
import { SettlementWorkerService } from './settlement-worker.service';
import { StorageModule } from '../storage/storage.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [StorageModule, PrismaModule],
  providers: [SettlementWorkerService],
  exports: [SettlementWorkerService],
})
export class SettlementModule {}
