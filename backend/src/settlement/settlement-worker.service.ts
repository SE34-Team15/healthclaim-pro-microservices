import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ClaimSettledEvent,
  DomainQueue,
  DomainRoutingKey,
} from '@healthclaim/shared';

export interface SettlementVoucherArtifact {
  voucherId: string;
  claimId: string;
  claimNumber: string;
  claimantName: string;
  claimantEmail: string;
  approvedAmount: number;
  settlementReference: string;
  payoutMethod: string;
  settledAt: string;
  issuedAt: string;
  issuerSignature: string;
}

@Injectable()
export class SettlementWorkerService implements OnModuleInit {
  private readonly logger = new Logger(SettlementWorkerService.name);
  private processedVouchersCount = 0;

  constructor(
    private readonly rabbitMQ: RabbitMQService,
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.subscribeToSettlementEvents();
  }

  private async subscribeToSettlementEvents(): Promise<void> {
    this.logger.log(`Initializing Settlement Worker consumer on queue: "${DomainQueue.SETTLEMENT_PAYOUT}"`);

    await this.rabbitMQ.subscribe<ClaimSettledEvent>(
      DomainQueue.SETTLEMENT_PAYOUT,
      [DomainRoutingKey.CLAIM_SETTLED],
      async (event, ack, nack) => {
        try {
          await this.processSettlement(event);
          ack();
        } catch (err: any) {
          this.logger.error(`Failed to process settlement for claim ${event.claimNumber}: ${err.message}`);
          nack(false);
        }
      },
    );
  }

  /**
   * Generates itemized settlement voucher, archives to S3/MinIO, and logs transaction notification.
   */
  async processSettlement(event: ClaimSettledEvent): Promise<SettlementVoucherArtifact> {
    this.logger.log(`Processing asynchronous settlement for claim: ${event.claimNumber} (Amount: $${event.approvedAmount})`);

    const voucher: SettlementVoucherArtifact = {
      voucherId: `VCH-${Date.now()}-${event.claimNumber}`,
      claimId: event.claimId,
      claimNumber: event.claimNumber,
      claimantName: event.claimantName,
      claimantEmail: event.claimantEmail,
      approvedAmount: event.approvedAmount,
      settlementReference: event.settlementReference,
      payoutMethod: event.payoutMethod,
      settledAt: event.settledAt,
      issuedAt: new Date().toISOString(),
      issuerSignature: `HEALTHCLAIM-PRO-SEAL-${Buffer.from(event.settlementReference).toString('base64').substring(0, 16)}`,
    };

    // 1. Archive voucher artifact to MinIO S3 Object Storage
    const voucherPayload = Buffer.from(JSON.stringify(voucher, null, 2), 'utf-8');
    const storageKey = `vouchers/settlement-${event.claimNumber}.json`;
    await this.storageService.storeFile(voucherPayload, storageKey, { contentType: 'application/json' });

    // 2. Record Immutable Audit Trail
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: event.userId,
          action: 'GENERATE_SETTLEMENT_VOUCHER',
          targetResource: 'SETTLEMENT_VOUCHER',
          targetResourceId: voucher.voucherId,
          details: {
            claimId: event.claimId,
            claimNumber: event.claimNumber,
            approvedAmount: event.approvedAmount,
            storageKey,
            payoutMethod: event.payoutMethod,
            notificationDispatchedTo: event.claimantEmail,
          },
        },
      });
    } catch (auditErr: any) {
      this.logger.warn(`Settlement audit trail recording notice: ${auditErr.message}`);
    }

    this.processedVouchersCount++;
    this.logger.log(`Settlement voucher ${voucher.voucherId} archived successfully to storage key: "${storageKey}"`);
    return voucher;
  }

  getProcessedCount(): number {
    return this.processedVouchersCount;
  }
}
