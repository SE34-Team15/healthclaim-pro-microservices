export const HEALTHCLAIM_EVENTS_EXCHANGE = 'healthclaim.events';

export const DomainRoutingKey = {
  CLAIM_SUBMITTED: 'claim.submitted',
  ELIGIBILITY_EVALUATED: 'eligibility.evaluated',
  BENEFIT_CALCULATED: 'benefit.calculated',
  CLAIM_SETTLED: 'claim.settled',
} as const;

export type DomainRoutingKeyType = (typeof DomainRoutingKey)[keyof typeof DomainRoutingKey];

export const DomainQueue = {
  CLAIM_SUBMISSION: 'healthclaim.claim.submission.queue',
  RULE_EVALUATION: 'healthclaim.rule.evaluation.queue',
  ACTUARIAL_CALCULATION: 'healthclaim.actuarial.calculation.queue',
  SETTLEMENT_PAYOUT: 'healthclaim.settlement.payout.queue',
  DEAD_LETTER: 'healthclaim.dead-letter.queue',
} as const;

export type DomainQueueType = (typeof DomainQueue)[keyof typeof DomainQueue];
