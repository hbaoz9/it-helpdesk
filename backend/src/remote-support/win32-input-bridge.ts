/**
 * Browser-live remote control safety guard.
 *
 * Server-side OS input must never target the machine hosting the API. The
 * backend host is not necessarily the requester device (and is often the
 * technician's own development machine).
 *
 * Keep this integration point disabled until an authenticated, device-bound
 * requester-side agent is implemented and security-reviewed. Screen sharing
 * and the existing RustDesk Client integration remain separate.
 */
export interface Win32InputCommand {
  kind: 'MOVE' | 'LEFT_CLICK' | 'RIGHT_CLICK' | 'DOUBLE_CLICK' | 'KEY' | 'TEXT';
  xRatio?: number;
  yRatio?: number;
  key?: string;
  text?: string;
}

export class Win32InputBridge {
  static execute(_command: Win32InputCommand): boolean {
    // Deliberately do NOT execute any input on the backend host.
    return false;
  }
}
