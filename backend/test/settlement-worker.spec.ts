import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettlementWorkerService } from '../src/settlement/settlement-worker.service';
import { ClaimSettledEvent } from '@healthclaim/shared';

describe('SettlementWorkerService', () => {
  let worker: SettlementWorkerService;
  let mockRabbitMQ: any;
  let mockStorageService: any;
  let mockPrisma: any;

  beforeEach(() => {
    mockRabbitMQ = {
      subscribe: vi.fn(),
    };
    mockStorageService = {
      storeFile: vi.fn().mockResolvedValue(undefined),
    };
    mockPrisma = {
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    worker = new SettlementWorkerService(mockRabbitMQ, mockStorageService, mockPrisma);
  });

  it('should be defined and register rabbitmq subscription on module init', async () => {
    expect(worker).toBeDefined();
    await worker.onModuleInit();
    expect(mockRabbitMQ.subscribe).toHaveBeenCalled();
  });

  it('should process settlement event and archive voucher artifact', async () => {
    const event: ClaimSettledEvent = {
      eventId: 'evt-1',
      claimId: 'claim-123',
      claimNumber: 'CLM-2026-TEST',
      userId: 'user-456',
      claimantName: 'John Doe',
      claimantEmail: 'john@example.com',
      approvedAmount: 250.75,
      settlementReference: 'SETTLE-CLM-2026-TEST',
      payoutMethod: 'DIRECT_BANK_TRANSFER_MOCK',
      settledAt: new Date().toISOString(),
    };

    const voucher = await worker.processSettlement(event);

    expect(voucher).toBeDefined();
    expect(voucher.claimNumber).toBe('CLM-2026-TEST');
    expect(voucher.approvedAmount).toBe(250.75);
    expect(mockStorageService.storeFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      'vouchers/settlement-CLM-2026-TEST.json',
      { contentType: 'application/json' },
    );
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    expect(worker.getProcessedCount()).toBe(1);
  });

  it('should dispatch email notification when MailService is available', async () => {
    const mockMailService: any = {
      sendSettlementVoucherEmail: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-999' }),
    };

    const workerWithMail = new SettlementWorkerService(
      mockRabbitMQ,
      mockStorageService,
      mockPrisma,
      mockMailService,
    );

    const event: ClaimSettledEvent = {
      eventId: 'evt-2',
      claimId: 'claim-789',
      claimNumber: 'CLM-2026-MAIL',
      userId: 'user-789',
      claimantName: 'Alice Smith',
      claimantEmail: 'alice@example.com',
      approvedAmount: 888.0,
      settlementReference: 'SETTLE-CLM-2026-MAIL',
      payoutMethod: 'GIRO_DISBURSEMENT',
      settledAt: new Date().toISOString(),
    };

    await workerWithMail.processSettlement(event);

    expect(mockMailService.sendSettlementVoucherEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        claimNumber: 'CLM-2026-MAIL',
        claimantEmail: 'alice@example.com',
        approvedAmount: 888.0,
      }),
    );
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          details: expect.objectContaining({
            emailMessageId: 'msg-999',
          }),
        }),
      }),
    );
  });
});
