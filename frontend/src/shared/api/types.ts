export type RoleCode = 'REQUESTER' | 'TECHNICIAN' | 'SUPERVISOR' | 'ADMIN';
export type TicketStatus =
  | 'NEW'
  | 'TRIAGED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_REQUESTER'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REJECTED';
export type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4';
export type ImpactLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type SlaHealthStatus = 'MET' | 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'EXCLUDED';
export type RemoteSessionStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';
export type DeviceVerificationStatus = 'PENDING' | 'VERIFIED' | 'REVOKED';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  roles: RoleCode[];
}

export interface Category {
  id: string;
  name: string;
  active: boolean;
}

export interface TicketRecord {
  id: string;
  code: string;
  type: 'INCIDENT' | 'SERVICE_REQUEST';
  title: string;
  description: string;
  impact: ImpactLevel;
  urgency: UrgencyLevel;
  priority: TicketPriority;
  status: TicketStatus;
  category: { id: string; name: string };
  requester: { id: string; fullName: string; email?: string };
  assignee: { id: string; fullName: string } | null;
  createdAt: string;
  updatedAt: string;
  resolutionNote: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  remoteSupportRequested?: boolean;
  preferredDeviceId?: string | null;
  version: number;
}

export interface TicketActivity {
  id: string;
  type: 'STATUS' | 'COMMENT';
  visibility?: 'PUBLIC' | 'INTERNAL';
  content: string | null;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus | null;
  createdAt: string;
  actor: { id: string; fullName: string } | null;
}

export interface AdminUserRecord {
  id: string;
  email: string;
  fullName: string;
  active: boolean;
  roles: RoleCode[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminCategoryRecord {
  id: string;
  name: string;
  active: boolean;
  ticketCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSlaPolicyRecord {
  id: string;
  priority: TicketPriority;
  responseMinutes: number;
  resolutionMinutes: number;
  revision: number;
  active: boolean;
  updatedAt: string;
}

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

export interface SupervisorTechnicianSummary {
  id: string;
  fullName: string;
  email: string;
  activeAssignedCount: number;
  assignedCount: number;
  inProgressCount: number;
  waitingRequesterCount: number;
  resolvedCount: number;
  closedCount: number;
}

export interface SupervisorDashboardSummary {
  totalTickets: number;
  unassignedCount: number;
  triageQueueCount: number;
  byStatus: Record<TicketStatus, number>;
  byPriority: Record<TicketPriority, number>;
  sla: {
    onTrack: number;
    atRisk: number;
    breached: number;
    met: number;
    excluded: number;
    unknown: number;
  };
  workloadByTechnician: SupervisorTechnicianSummary[];
}

export interface TechnicianTicketSummary {
  total: number;
  inProgress: number;
  waitingRequester: number;
  resolved: number;
  highPriority: number;
  requesterReplies: number;
}

export interface RustdeskClientConfig {
  idServerHost: string;
  relayServerHost: string | null;
  publicKey: string | null;
  approvalTtlMinutes: number;
  clientGuideUrl: string | null;
  enabled: boolean;
  consentBoundaryNotice?: string;
}

export interface UserDeviceRecord {
  id: string;
  ownerId: string;
  label: string;
  rustdeskId: string;
  osName: string | null;
  verificationStatus: DeviceVerificationStatus;
  active: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RemoteSupportSessionRecord {
  id: string;
  ticketId: string;
  ticketCode: string;
  ticketTitle: string;
  deviceId: string;
  deviceLabel: string;
  rustdeskId: string;
  deviceOsName: string | null;
  requester: { id: string; fullName: string; email?: string };
  technician: { id: string; fullName: string; email?: string };
  status: RemoteSessionStatus;
  requestNote: string | null;
  rejectionReason: string | null;
  cancelReason: string | null;
  resultSummary: string | null;
  requestedAt: string;
  approvedAt: string | null;
  approvalExpiresAt: string | null;
  rejectedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  connectUri: string | null;
  cliCommand: string | null;
}

export interface TicketRemoteSupportContext {
  ticketId: string;
  ticketCode: string;
  ticketStatus: TicketStatus;
  remoteSupportRequested: boolean;
  preferredDeviceId: string | null;
  preferredDevice: UserDeviceRecord | null;
  requesterDevices: UserDeviceRecord[];
  sessions: RemoteSupportSessionRecord[];
  rustdeskConfig: RustdeskClientConfig;
  consentBoundaryNotice?: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  ticketId: string | null;
  eventKey: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  ticket?: { id: string; code: string; title: string } | null;
}

export interface AdminDeviceRecord {
  id: string;
  label: string;
  rustdeskId: string;
  osName: string | null;
  verificationStatus: DeviceVerificationStatus;
  active: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    fullName: string;
    email: string;
  };
  sessionCount: number;
}

export interface AdminRustdeskConfigRecord {
  id: string;
  singletonKey: string;
  idServerHost: string;
  relayServerHost: string | null;
  publicKey: string | null;
  approvalTtlMinutes: number;
  clientGuideUrl: string | null;
  enabled: boolean;
  updatedById: string | null;
  updatedAt: string;
}

export interface AdminAuditLogRecord {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string | null;
  beforeJson: string | null;
  afterJson: string | null;
  createdAt: string;
  actor: { id: string; fullName: string; email: string } | null;
  ticket: { id: string; code: string; title: string } | null;
}

export type RemoteInputKind =
  | 'LASER'
  | 'MOVE'
  | 'LEFT_CLICK'
  | 'RIGHT_CLICK'
  | 'DOUBLE_CLICK'
  | 'KEY'
  | 'TEXT';

export interface RemoteInputEventRecord {
  id: string;
  kind: RemoteInputKind;
  xRatio?: number;
  yRatio?: number;
  key?: string;
  text?: string;
  actorName: string;
  executedOnOs: boolean;
  createdAt: number;
}

export interface WebRtcIceCandidateRecord {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

export interface WebRtcSignalSnapshotRecord {
  offerGeneration: number;
  sdpOffer: { type: 'offer'; sdp: string } | null;
  sdpAnswer: { type: 'answer'; sdp: string } | null;
  requesterIceCandidates: WebRtcIceCandidateRecord[];
  technicianIceCandidates: WebRtcIceCandidateRecord[];
  p2pConnected: boolean;
  renegotiateRequested: boolean;
}

export interface LiveSessionStateRecord {
  sessionId: string;
  streaming: boolean;
  remoteControlEnabled: boolean;
  executeOnHostOs: boolean;
  frameDataUrl: string | null;
  frameWidth: number;
  frameHeight: number;
  frameUpdatedAt: number | null;
  laserPointer: {
    xRatio: number;
    yRatio: number;
    kind: RemoteInputKind;
    actorName: string;
    updatedAt: number;
  } | null;
  webrtc: WebRtcSignalSnapshotRecord;
  recentInputs: RemoteInputEventRecord[];
  pendingInputs: RemoteInputEventRecord[];
}
