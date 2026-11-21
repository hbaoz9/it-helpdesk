import type {
  TicketPriority,
  TicketStatus,
} from '../generated/prisma/client.js';

export type SlaHealthStatus = 'MET' | 'ON_TRACK' | 'AT_RISK' | 'BREACHED';

export interface SlaPolicyTarget {
  priority: TicketPriority;
  responseMinutes: number;
  resolutionMinutes: number;
}

export const SLA_WARNING_RATIO = 0.8;

export const SLA_POLICY_V1: Record<TicketPriority, SlaPolicyTarget> = {
  P1: {
    priority: 'P1',
    responseMinutes: 15,
    resolutionMinutes: 4 * 60,
  },
  P2: {
    priority: 'P2',
    responseMinutes: 60,
    resolutionMinutes: 8 * 60,
  },
  P3: {
    priority: 'P3',
    responseMinutes: 4 * 60,
    resolutionMinutes: 24 * 60,
  },
  P4: {
    priority: 'P4',
    responseMinutes: 8 * 60,
    resolutionMinutes: 72 * 60,
  },
};

export interface TicketSlaSnapshot {
  ticketId: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
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
  isCancelled: boolean,
  nowMs: number,
): SlaHealthStatus {
  if (isCancelled) {
    return 'MET';
  }
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
  firstResponseAt: Date | null = null,
  now: Date = new Date(),
): TicketSlaSnapshot {
  const target = SLA_POLICY_V1[ticket.priority];
  const createdAtMs = ticket.createdAt.getTime();
  const responseDueAtMs = createdAtMs + target.responseMinutes * 60_000;
  const resolutionDueAtMs = createdAtMs + target.resolutionMinutes * 60_000;
  const isRejected = ticket.status === 'REJECTED';

  const resolutionCompletedAt =
    ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
      ? (ticket.resolvedAt ?? ticket.closedAt ?? now)
      : null;

  const responseCompletedAt =
    firstResponseAt ??
    (resolutionCompletedAt && resolutionCompletedAt.getTime() >= createdAtMs
      ? resolutionCompletedAt
      : null);

  const responseStatus = evaluateMetricStatus(
    createdAtMs,
    responseDueAtMs,
    responseCompletedAt ? responseCompletedAt.getTime() : null,
    isRejected,
    now.getTime(),
  );

  const resolutionStatus = evaluateMetricStatus(
    createdAtMs,
    resolutionDueAtMs,
    resolutionCompletedAt ? resolutionCompletedAt.getTime() : null,
    isRejected,
    now.getTime(),
  );

  return {
    ticketId: ticket.id,
    priority: ticket.priority,
    status: ticket.status,
    createdAt: ticket.createdAt.toISOString(),
    responseTargetMinutes: target.responseMinutes,
    resolutionTargetMinutes: target.resolutionMinutes,
    responseDueAt: new Date(responseDueAtMs).toISOString(),
    resolutionDueAt: new Date(resolutionDueAtMs).toISOString(),
    firstResponseAt: firstResponseAt ? firstResponseAt.toISOString() : null,
    resolvedAt: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : null,
    responseStatus,
    resolutionStatus,
    overallStatus: combineSlaStatus(responseStatus, resolutionStatus),
  };
}
