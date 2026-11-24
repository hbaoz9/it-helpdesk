import { apiRequest } from './client';
import type {
  NotificationRecord,
  RemoteSupportSessionRecord,
  RustdeskClientConfig,
  TicketRemoteSupportContext,
  UserDeviceRecord,
} from './types';

export interface CreateDevicePayload {
  label: string;
  rustdeskId: string;
  osName?: string;
}

export interface UpdateDevicePayload {
  label?: string;
  rustdeskId?: string;
  osName?: string | null;
  active?: boolean;
}

export interface FlagTicketRemoteSupportPayload {
  remoteSupportRequested: boolean;
  preferredDeviceId?: string | null;
}

export interface RequestRemoteSessionPayload {
  deviceId: string;
  requestNote?: string;
}

export async function getRustdeskClientConfig(): Promise<RustdeskClientConfig> {
  const result = await apiRequest<{ config: RustdeskClientConfig }>(
    '/remote-support/config',
  );
  return result.config;
}

export async function getMyDevices(): Promise<UserDeviceRecord[]> {
  const result = await apiRequest<{ devices: UserDeviceRecord[] }>(
    '/remote-support/devices/my',
  );
  return result.devices;
}

export async function createMyDevice(
  payload: CreateDevicePayload,
): Promise<UserDeviceRecord> {
  const result = await apiRequest<{ device: UserDeviceRecord }>(
    '/remote-support/devices/my',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return result.device;
}

export async function updateMyDevice(
  id: string,
  payload: UpdateDevicePayload,
): Promise<UserDeviceRecord> {
  const result = await apiRequest<{ device: UserDeviceRecord }>(
    `/remote-support/devices/my/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
  return result.device;
}

export async function flagTicketRemoteSupport(
  ticketId: string,
  payload: FlagTicketRemoteSupportPayload,
): Promise<TicketRemoteSupportContext> {
  return apiRequest<TicketRemoteSupportContext>(
    `/remote-support/tickets/${ticketId}/flag`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
}

export async function getTicketRemoteSupportContext(
  ticketId: string,
): Promise<TicketRemoteSupportContext> {
  return apiRequest<TicketRemoteSupportContext>(
    `/remote-support/tickets/${ticketId}/sessions`,
  );
}

export async function requestRemoteSession(
  ticketId: string,
  payload: RequestRemoteSessionPayload,
): Promise<RemoteSupportSessionRecord> {
  const result = await apiRequest<{ session: RemoteSupportSessionRecord }>(
    `/remote-support/tickets/${ticketId}/sessions`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return result.session;
}

export async function approveRemoteSession(
  sessionId: string,
): Promise<RemoteSupportSessionRecord> {
  const result = await apiRequest<{ session: RemoteSupportSessionRecord }>(
    `/remote-support/sessions/${sessionId}/approve`,
    {
      method: 'POST',
    },
  );
  return result.session;
}

export async function rejectRemoteSession(
  sessionId: string,
  reason?: string,
): Promise<RemoteSupportSessionRecord> {
  const result = await apiRequest<{ session: RemoteSupportSessionRecord }>(
    `/remote-support/sessions/${sessionId}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  );
  return result.session;
}

export async function startRemoteSession(
  sessionId: string,
): Promise<RemoteSupportSessionRecord> {
  const result = await apiRequest<{ session: RemoteSupportSessionRecord }>(
    `/remote-support/sessions/${sessionId}/start`,
    {
      method: 'POST',
    },
  );
  return result.session;
}

export async function completeRemoteSession(
  sessionId: string,
  resultSummary: string,
): Promise<RemoteSupportSessionRecord> {
  const result = await apiRequest<{ session: RemoteSupportSessionRecord }>(
    `/remote-support/sessions/${sessionId}/complete`,
    {
      method: 'POST',
      body: JSON.stringify({ resultSummary }),
    },
  );
  return result.session;
}

export async function cancelRemoteSession(
  sessionId: string,
  reason?: string,
): Promise<RemoteSupportSessionRecord> {
  const result = await apiRequest<{ session: RemoteSupportSessionRecord }>(
    `/remote-support/sessions/${sessionId}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  );
  return result.session;
}

export async function getMyNotifications(
  unreadOnly = false,
  limit = 15,
): Promise<{
  notifications: NotificationRecord[];
  unreadCount: number;
  total: number;
}> {
  const qs = new URLSearchParams();
  if (unreadOnly) qs.set('unreadOnly', 'true');
  qs.set('limit', String(limit));
  return apiRequest<{
    notifications: NotificationRecord[];
    unreadCount: number;
    total: number;
  }>(`/remote-support/notifications?${qs.toString()}`);
}

export async function markNotificationRead(
  notificationId: string,
): Promise<NotificationRecord> {
  const result = await apiRequest<{ notification: NotificationRecord }>(
    `/remote-support/notifications/${notificationId}/read`,
    {
      method: 'PATCH',
    },
  );
  return result.notification;
}

export async function markAllNotificationsRead(): Promise<{
  updatedCount: number;
}> {
  return apiRequest<{ updatedCount: number }>(
    '/remote-support/notifications/read-all',
    {
      method: 'PATCH',
    },
  );
}
