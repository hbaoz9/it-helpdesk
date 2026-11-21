import type {
  TicketPriority,
  TicketStatus,
} from '../generated/prisma/client.js';

export type SlaHealthStatus = 'MET' | 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'EXCLUDED';

export interface PersistedSlaTarget {
  slaPolicy?: { priority: TicketPriority } | null;
  policyRevision: number;
  responseTargetMinutes: number;
  resolutionTargetMinutes: number;
  responseDueAt: Date;
  resolutionDueAt: Date;
  firstResponseAt: Date | null;
}

export const SLA_WARNING_RATIO = 0.8;

export interface TicketSlaSnapshot {
  ticketId: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  deadlineBasis: 'AT_TICKET_CREATION';
  policyPriority: TicketPriority | null;
  policyRevision: number;
  responseTargetMinutes: number;
  resolutionTargetMinutes: number;
  responseDueAt: string;
  resolutionDueAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  responseStatus: SlaHealthStatus;
  resolutionStatus: SlaHealthStatus;
  overallStatus: SlaHealthStatus;
}

function evaluateMetricStatus(
  createdAtMs: number,
  dueAtMs: number,
  completedAtMs: number | null,
  nowMs: number,
): SlaHealthStatus {
  if (completedAtMs !== null) {
    return completedAtMs <= dueAtMs ? 'MET' : 'BREACHED';
  }
  if (nowMs > dueAtMs) {
    return 'BREACHED';
  }
  const durationMs = dueAtMs - createdAtMs;
  const warningAtMs = createdAtMs + durationMs * SLA_WARNING_RATIO;
  if (nowMs >= warningAtMs) {
    return 'AT_RISK';
  }
  return 'ON_TRACK';
}

function combineSlaStatus(
  responseStatus: SlaHealthStatus,
  resolutionStatus: SlaHealthStatus,
): SlaHealthStatus {
  if (responseStatus === 'EXCLUDED' && resolutionStatus === 'EXCLUDED') {
    return 'EXCLUDED';
  }
  if (responseStatus === 'BREACHED' || resolutionStatus === 'BREACHED') {
    return 'BREACHED';
  }
  if (responseStatus === 'AT_RISK' || resolutionStatus === 'AT_RISK') {
    return 'AT_RISK';
  }
  if (responseStatus === 'ON_TRACK' || resolutionStatus === 'ON_TRACK') {
    return 'ON_TRACK';
  }
  return 'MET';
}

export function computeTicketSla(
  ticket: {
    id: string;
    priority: TicketPriority;
    status: TicketStatus;
    createdAt: Date;
    resolvedAt: Date | null;
    closedAt: Date | null;
  },
  target: PersistedSlaTarget,
  now: Date = new Date(),
): TicketSlaSnapshot {
  const createdAtMs = ticket.createdAt.getTime();
  const responseDueAtMs = target.responseDueAt.getTime();
  const resolutionDueAtMs = target.resolutionDueAt.getTime();

  const resolutionCompletedAt =
    ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
      ? ticket.resolvedAt
      : null;

  const responseCompletedAt = target.firstResponseAt;

  const responseStatus = ticket.status === 'REJECTED' ? 'EXCLUDED' : evaluateMetricStatus(
    createdAtMs,
    responseDueAtMs,
    responseCompletedAt ? responseCompletedAt.getTime() : null,
    now.getTime(),
  );

  const resolutionStatus = ticket.status === 'REJECTED' ? 'EXCLUDED' : evaluateMetricStatus(
    createdAtMs,
    resolutionDueAtMs,
    resolutionCompletedAt ? resolutionCompletedAt.getTime() : null,
    now.getTime(),
  );

  return {
    ticketId: ticket.id,
    priority: ticket.priority,
    status: ticket.status,
    createdAt: ticket.createdAt.toISOString(),
    deadlineBasis: 'AT_TICKET_CREATION',
    policyPriority: target.slaPolicy?.priority ?? null,
    policyRevision: target.policyRevision,
    responseTargetMinutes: target.responseTargetMinutes,
    resolutionTargetMinutes: target.resolutionTargetMinutes,
    responseDueAt: new Date(responseDueAtMs).toISOString(),
    resolutionDueAt: new Date(resolutionDueAtMs).toISOString(),
    firstResponseAt: target.firstResponseAt ? target.firstResponseAt.toISOString() : null,
    resolvedAt: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : null,
    responseStatus,
    resolutionStatus,
    overallStatus: combineSlaStatus(responseStatus, resolutionStatus),
  };
}
