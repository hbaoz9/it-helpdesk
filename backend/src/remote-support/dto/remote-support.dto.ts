import { BadRequestException } from '@nestjs/common';
import type { RemoteSessionStatus } from '../../generated/prisma/client.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RUSTDESK_ID_REGEX = /^[0-9A-Za-z_-]{6,20}$/;

const VALID_SESSION_STATUSES: ReadonlyArray<RemoteSessionStatus> = [
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

export type RemoteInputKind =
  | 'LASER'
  | 'MOVE'
  | 'LEFT_CLICK'
  | 'RIGHT_CLICK'
  | 'DOUBLE_CLICK'
  | 'KEY'
  | 'TEXT';

const VALID_INPUT_KINDS: ReadonlyArray<RemoteInputKind> = [
  'LASER',
  'MOVE',
  'LEFT_CLICK',
  'RIGHT_CLICK',
  'DOUBLE_CLICK',
  'KEY',
  'TEXT',
];

function normalizeRustdeskId(raw: string): string {
  return raw.replace(/\s+/g, '').trim();
}

export class CreateDeviceDto {
  label!: string;
  rustdeskId!: string;
  osName?: string;

  static validate(input: unknown): CreateDeviceDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid device registration payload');
    }

    const record = input as Record<string, unknown>;

    if (
      typeof record.label !== 'string' ||
      record.label.trim().length < 2 ||
      record.label.trim().length > 120
    ) {
      throw new BadRequestException(
        'Device label must be between 2 and 120 characters',
      );
    }

    if (typeof record.rustdeskId !== 'string') {
      throw new BadRequestException('rustdeskId is required');
    }

    const normalizedId = normalizeRustdeskId(record.rustdeskId);
    if (!RUSTDESK_ID_REGEX.test(normalizedId)) {
      throw new BadRequestException(
        'rustdeskId must be 6 to 20 alphanumeric characters (spaces are stripped automatically)',
      );
    }

    const dto = new CreateDeviceDto();
    dto.label = record.label.trim();
    dto.rustdeskId = normalizedId;

    if (record.osName !== undefined && record.osName !== null) {
      if (typeof record.osName !== 'string' || record.osName.trim().length > 60) {
        throw new BadRequestException('osName must not exceed 60 characters');
      }
      const trimmedOs = record.osName.trim();
      if (trimmedOs.length > 0) {
        dto.osName = trimmedOs;
      }
    }

    return dto;
  }
}

export class UpdateDeviceDto {
  label?: string;
  rustdeskId?: string;
  osName?: string | null;
  active?: boolean;

  static validate(input: unknown): UpdateDeviceDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid device update payload');
    }

    const record = input as Record<string, unknown>;
    const dto = new UpdateDeviceDto();
    let hasField = false;

    if (record.label !== undefined) {
      if (
        typeof record.label !== 'string' ||
        record.label.trim().length < 2 ||
        record.label.trim().length > 120
      ) {
        throw new BadRequestException(
          'Device label must be between 2 and 120 characters',
        );
      }
      dto.label = record.label.trim();
      hasField = true;
    }

    if (record.rustdeskId !== undefined) {
      if (typeof record.rustdeskId !== 'string') {
        throw new BadRequestException('rustdeskId must be a string');
      }
      const normalizedId = normalizeRustdeskId(record.rustdeskId);
      if (!RUSTDESK_ID_REGEX.test(normalizedId)) {
        throw new BadRequestException(
          'rustdeskId must be 6 to 20 alphanumeric characters',
        );
      }
      dto.rustdeskId = normalizedId;
      hasField = true;
    }

    if (record.osName !== undefined) {
      if (record.osName === null || record.osName === '') {
        dto.osName = null;
        hasField = true;
      } else if (
        typeof record.osName === 'string' &&
        record.osName.trim().length <= 60
      ) {
        dto.osName = record.osName.trim();
        hasField = true;
      } else {
        throw new BadRequestException('osName must not exceed 60 characters');
      }
    }

    if (record.active !== undefined) {
      if (typeof record.active !== 'boolean') {
        throw new BadRequestException('active must be a boolean');
      }
      dto.active = record.active;
      hasField = true;
    }

    if (!hasField) {
      throw new BadRequestException('At least one device field must be updated');
    }

    return dto;
  }
}

export class FlagTicketRemoteSupportDto {
  remoteSupportRequested!: boolean;
  preferredDeviceId?: string | null;

  static validate(input: unknown): FlagTicketRemoteSupportDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid remote support flag payload');
    }

    const record = input as Record<string, unknown>;
    if (typeof record.remoteSupportRequested !== 'boolean') {
      throw new BadRequestException(
        'remoteSupportRequested must be a boolean',
      );
    }

    const dto = new FlagTicketRemoteSupportDto();
    dto.remoteSupportRequested = record.remoteSupportRequested;

    if (
      record.preferredDeviceId !== undefined &&
      record.preferredDeviceId !== null &&
      record.preferredDeviceId !== ''
    ) {
      if (
        typeof record.preferredDeviceId !== 'string' ||
        !UUID_REGEX.test(record.preferredDeviceId.trim())
      ) {
        throw new BadRequestException('preferredDeviceId must be a valid UUID');
      }
      dto.preferredDeviceId = record.preferredDeviceId.trim();
    } else if (
      record.preferredDeviceId === null ||
      record.preferredDeviceId === '' ||
      !record.remoteSupportRequested
    ) {
      dto.preferredDeviceId = null;
    }

    return dto;
  }
}

export class RequestRemoteSessionDto {
  deviceId!: string;
  requestNote?: string;

  static validate(input: unknown): RequestRemoteSessionDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid remote session request payload');
    }

    const record = input as Record<string, unknown>;
    if (
      typeof record.deviceId !== 'string' ||
      !UUID_REGEX.test(record.deviceId.trim())
    ) {
      throw new BadRequestException('deviceId must be a valid UUID');
    }

    const dto = new RequestRemoteSessionDto();
    dto.deviceId = record.deviceId.trim();

    if (record.requestNote !== undefined && record.requestNote !== null) {
      if (
        typeof record.requestNote !== 'string' ||
        record.requestNote.trim().length > 500
      ) {
        throw new BadRequestException(
          'requestNote must not exceed 500 characters',
        );
      }
      const trimmed = record.requestNote.trim();
      if (trimmed.length > 0) {
        dto.requestNote = trimmed;
      }
    }

    return dto;
  }
}

export class RejectRemoteSessionDto {
  reason?: string;

  static validate(input: unknown): RejectRemoteSessionDto {
    const dto = new RejectRemoteSessionDto();
    if (input === undefined || input === null) {
      return dto;
    }
    if (typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid rejection payload');
    }

    const record = input as Record<string, unknown>;
    if (record.reason !== undefined && record.reason !== null) {
      if (
        typeof record.reason !== 'string' ||
        record.reason.trim().length > 500
      ) {
        throw new BadRequestException(
          'Rejection reason must not exceed 500 characters',
        );
      }
      const trimmed = record.reason.trim();
      if (trimmed.length > 0) {
        dto.reason = trimmed;
      }
    }

    return dto;
  }
}

export class CancelRemoteSessionDto {
  reason?: string;

  static validate(input: unknown): CancelRemoteSessionDto {
    const dto = new CancelRemoteSessionDto();
    if (input === undefined || input === null) {
      return dto;
    }
    if (typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid cancellation payload');
    }

    const record = input as Record<string, unknown>;
    if (record.reason !== undefined && record.reason !== null) {
      if (
        typeof record.reason !== 'string' ||
        record.reason.trim().length > 500
      ) {
        throw new BadRequestException(
          'Cancellation reason must not exceed 500 characters',
        );
      }
      const trimmed = record.reason.trim();
      if (trimmed.length > 0) {
        dto.reason = trimmed;
      }
    }

    return dto;
  }
}

export class CompleteRemoteSessionDto {
  resultSummary!: string;

  static validate(input: unknown): CompleteRemoteSessionDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid session completion payload');
    }

    const record = input as Record<string, unknown>;
    if (
      typeof record.resultSummary !== 'string' ||
      record.resultSummary.trim().length < 3 ||
      record.resultSummary.trim().length > 2000
    ) {
      throw new BadRequestException(
        'resultSummary must be between 3 and 2000 characters',
      );
    }

    const dto = new CompleteRemoteSessionDto();
    dto.resultSummary = record.resultSummary.trim();
    return dto;
  }
}

export class RemoteSessionsQueryDto {
  ticketId?: string;
  status?: RemoteSessionStatus;
  page = 1;
  limit = 50;

  static validate(input: unknown): RemoteSessionsQueryDto {
    const dto = new RemoteSessionsQueryDto();
    if (input === undefined || input === null) {
      return dto;
    }
    if (typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid session query parameters');
    }

    const record = input as Record<string, unknown>;
    if (record.ticketId !== undefined && record.ticketId !== '') {
      if (
        typeof record.ticketId !== 'string' ||
        !UUID_REGEX.test(record.ticketId.trim())
      ) {
        throw new BadRequestException('ticketId must be a valid UUID');
      }
      dto.ticketId = record.ticketId.trim();
    }

    if (record.status !== undefined && record.status !== '') {
      if (
        typeof record.status !== 'string' ||
        !VALID_SESSION_STATUSES.includes(record.status as RemoteSessionStatus)
      ) {
        throw new BadRequestException('Invalid remote session status filter');
      }
      dto.status = record.status as RemoteSessionStatus;
    }

    if (record.page !== undefined && record.page !== '') {
      const parsed = Number(record.page);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
        throw new BadRequestException('page must be an integer between 1 and 1000');
      }
      dto.page = parsed;
    }

    if (record.limit !== undefined && record.limit !== '') {
      const parsed = Number(record.limit);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
        throw new BadRequestException('limit must be an integer between 1 and 100');
      }
      dto.limit = parsed;
    }

    return dto;
  }
}

export class NotificationsQueryDto {
  unreadOnly = false;
  page = 1;
  limit = 20;

  static validate(input: unknown): NotificationsQueryDto {
    const dto = new NotificationsQueryDto();
    if (input === undefined || input === null) {
      return dto;
    }
    if (typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid notification query parameters');
    }

    const record = input as Record<string, unknown>;
    if (record.unreadOnly !== undefined && record.unreadOnly !== '') {
      if (record.unreadOnly === true || record.unreadOnly === 'true') {
        dto.unreadOnly = true;
      } else if (record.unreadOnly === false || record.unreadOnly === 'false') {
        dto.unreadOnly = false;
      } else {
        throw new BadRequestException('unreadOnly must be true or false');
      }
    }

    if (record.page !== undefined && record.page !== '') {
      const parsed = Number(record.page);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
        throw new BadRequestException('page must be an integer between 1 and 1000');
      }
      dto.page = parsed;
    }

    if (record.limit !== undefined && record.limit !== '') {
      const parsed = Number(record.limit);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
        throw new BadRequestException('limit must be an integer between 1 and 100');
      }
      dto.limit = parsed;
    }

    return dto;
  }
}

export class PushLiveFrameDto {
  frameDataUrl!: string;
  width!: number;
  height!: number;

  static validate(input: unknown): PushLiveFrameDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid live screen frame payload');
    }

    const record = input as Record<string, unknown>;
    if (
      typeof record.frameDataUrl !== 'string' ||
      (!record.frameDataUrl.startsWith('data:image/jpeg;base64,') &&
        !record.frameDataUrl.startsWith('data:image/webp;base64,') &&
        !record.frameDataUrl.startsWith('data:image/png;base64,')) ||
      record.frameDataUrl.length > 1_800_000
    ) {
      throw new BadRequestException(
        'frameDataUrl must be a valid base64 data:image URL under 1.8MB',
      );
    }

    const width = Number(record.width ?? 1280);
    const height = Number(record.height ?? 720);
    if (
      !Number.isFinite(width) ||
      width < 64 ||
      width > 7680 ||
      !Number.isFinite(height) ||
      height < 64 ||
      height > 4320
    ) {
      throw new BadRequestException('Invalid frame dimensions');
    }

    const dto = new PushLiveFrameDto();
    dto.frameDataUrl = record.frameDataUrl;
    dto.width = Math.round(width);
    dto.height = Math.round(height);
    return dto;
  }
}

export class UpdateLiveControlSettingsDto {
  streaming?: boolean;
  remoteControlEnabled?: boolean;
  executeOnHostOs?: boolean;

  static validate(input: unknown): UpdateLiveControlSettingsDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid live control settings payload');
    }

    const record = input as Record<string, unknown>;
    const dto = new UpdateLiveControlSettingsDto();
    let hasField = false;

    if (record.streaming !== undefined) {
      if (typeof record.streaming !== 'boolean') {
        throw new BadRequestException('streaming must be a boolean');
      }
      dto.streaming = record.streaming;
      hasField = true;
    }

    if (record.remoteControlEnabled !== undefined) {
      if (typeof record.remoteControlEnabled !== 'boolean') {
        throw new BadRequestException('remoteControlEnabled must be a boolean');
      }
      dto.remoteControlEnabled = record.remoteControlEnabled;
      hasField = true;
    }

    if (record.executeOnHostOs !== undefined) {
      if (typeof record.executeOnHostOs !== 'boolean') {
        throw new BadRequestException('executeOnHostOs must be a boolean');
      }
      dto.executeOnHostOs = record.executeOnHostOs;
      hasField = true;
    }

    if (!hasField) {
      throw new BadRequestException('At least one live setting must be provided');
    }

    return dto;
  }
}

export class SendRemoteInputDto {
  kind!: RemoteInputKind;
  xRatio?: number;
  yRatio?: number;
  key?: string;
  text?: string;

  static validate(input: unknown): SendRemoteInputDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid remote input payload');
    }

    const record = input as Record<string, unknown>;
    if (
      typeof record.kind !== 'string' ||
      !VALID_INPUT_KINDS.includes(record.kind as RemoteInputKind)
    ) {
      throw new BadRequestException(
        `kind must be one of: ${VALID_INPUT_KINDS.join(', ')}`,
      );
    }

    const dto = new SendRemoteInputDto();
    dto.kind = record.kind as RemoteInputKind;

    if (record.xRatio !== undefined && record.xRatio !== null) {
      const x = Number(record.xRatio);
      if (!Number.isFinite(x) || x < 0 || x > 1) {
        throw new BadRequestException('xRatio must be between 0 and 1');
      }
      dto.xRatio = x;
    }

    if (record.yRatio !== undefined && record.yRatio !== null) {
      const y = Number(record.yRatio);
      if (!Number.isFinite(y) || y < 0 || y > 1) {
        throw new BadRequestException('yRatio must be between 0 and 1');
      }
      dto.yRatio = y;
    }

    if (record.key !== undefined && record.key !== null) {
      if (typeof record.key !== 'string' || record.key.trim().length > 30) {
        throw new BadRequestException('key must be a string up to 30 chars');
      }
      dto.key = record.key.trim().toUpperCase();
    }

    if (record.text !== undefined && record.text !== null) {
      if (
        typeof record.text !== 'string' ||
        record.text.length === 0 ||
        record.text.length > 200
      ) {
        throw new BadRequestException('text must be between 1 and 200 characters');
      }
      dto.text = record.text;
    }

    return dto;
  }
}

export interface WebRtcIceCandidateInput {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

export class WebRtcSignalDto {
  sdpOffer?: { type: 'offer'; sdp: string };
  sdpAnswer?: { type: 'answer'; sdp: string };
  iceCandidate?: WebRtcIceCandidateInput;
  p2pConnected?: boolean;
  requestRenegotiate?: boolean;

  static validate(input: unknown): WebRtcSignalDto {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid WebRTC signal payload');
    }

    const record = input as Record<string, unknown>;
    const dto = new WebRtcSignalDto();
    let hasField = false;

    if (record.sdpOffer !== undefined && record.sdpOffer !== null) {
      if (typeof record.sdpOffer !== 'object') {
        throw new BadRequestException('sdpOffer must be an object');
      }
      const offer = record.sdpOffer as Record<string, unknown>;
      if (
        offer.type !== 'offer' ||
        typeof offer.sdp !== 'string' ||
        offer.sdp.length === 0 ||
        offer.sdp.length > 100_000
      ) {
        throw new BadRequestException('Invalid sdpOffer description');
      }
      dto.sdpOffer = { type: 'offer', sdp: offer.sdp };
      hasField = true;
    }

    if (record.sdpAnswer !== undefined && record.sdpAnswer !== null) {
      if (typeof record.sdpAnswer !== 'object') {
        throw new BadRequestException('sdpAnswer must be an object');
      }
      const answer = record.sdpAnswer as Record<string, unknown>;
      if (
        answer.type !== 'answer' ||
        typeof answer.sdp !== 'string' ||
        answer.sdp.length === 0 ||
        answer.sdp.length > 100_000
      ) {
        throw new BadRequestException('Invalid sdpAnswer description');
      }
      dto.sdpAnswer = { type: 'answer', sdp: answer.sdp };
      hasField = true;
    }

    if (record.iceCandidate !== undefined && record.iceCandidate !== null) {
      if (typeof record.iceCandidate !== 'object') {
        throw new BadRequestException('iceCandidate must be an object');
      }
      const cand = record.iceCandidate as Record<string, unknown>;
      if (
        typeof cand.candidate !== 'string' ||
        cand.candidate.length > 10_000
      ) {
        throw new BadRequestException('Invalid ICE candidate string');
      }
      dto.iceCandidate = {
        candidate: cand.candidate,
        sdpMid: typeof cand.sdpMid === 'string' ? cand.sdpMid : null,
        sdpMLineIndex:
          typeof cand.sdpMLineIndex === 'number' ? cand.sdpMLineIndex : null,
      };
      hasField = true;
    }

    if (record.p2pConnected !== undefined) {
      if (typeof record.p2pConnected !== 'boolean') {
        throw new BadRequestException('p2pConnected must be a boolean');
      }
      dto.p2pConnected = record.p2pConnected;
      hasField = true;
    }

    if (record.requestRenegotiate !== undefined) {
      if (typeof record.requestRenegotiate !== 'boolean') {
        throw new BadRequestException('requestRenegotiate must be a boolean');
      }
      dto.requestRenegotiate = record.requestRenegotiate;
      hasField = true;
    }

    if (!hasField) {
      throw new BadRequestException('At least one WebRTC signal field is required');
    }

    return dto;
  }
}
