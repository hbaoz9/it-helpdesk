import { Logger } from '@nestjs/common';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

export interface Win32InputCommand {
  kind:
    | 'MOVE'
    | 'LEFT_CLICK'
    | 'RIGHT_CLICK'
    | 'DOUBLE_CLICK'
    | 'KEY'
    | 'TEXT';
  xRatio?: number;
  yRatio?: number;
  key?: string;
  text?: string;
}

const SPECIAL_KEYS_MAP: Record<string, string> = {
  ENTER: '{ENTER}',
  BACKSPACE: '{BACKSPACE}',
  TAB: '{TAB}',
  ESCAPE: '{ESC}',
  UP: '{UP}',
  DOWN: '{DOWN}',
  LEFT: '{LEFT}',
  RIGHT: '{RIGHT}',
  DELETE: '{DELETE}',
  HOME: '{HOME}',
  END: '{END}',
  SPACE: ' ',
};

function escapeSendKeysLiteral(raw: string): string {
  // Escape special characters interpreted by System.Windows.Forms.SendKeys
  return raw.replace(/([+^%~(){}[\]])/g, '{$1}');
}

export class Win32InputBridge {
  private static readonly logger = new Logger(Win32InputBridge.name);
  private static psProcess: ChildProcessWithoutNullStreams | null = null;
  private static initialized = false;

  private static ensureProcess(): ChildProcessWithoutNullStreams | null {
    if (process.platform !== 'win32') {
      return null;
    }

    if (this.psProcess && !this.psProcess.killed) {
      return this.psProcess;
    }

    try {
      const child = spawn(
        'powershell.exe',
        ['-NoProfile', '-NoLogo', '-NonInteractive', '-Command', '-'],
        {
          stdio: 'pipe',
          windowsHide: true,
        },
      );

      child.on('error', (err) => {
        this.logger.warn(`Win32 PowerShell bridge error: ${err.message}`);
        this.psProcess = null;
        this.initialized = false;
      });

      child.on('exit', () => {
        this.psProcess = null;
        this.initialized = false;
      });

      const bootstrapScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class SmartDeskWin32 {
  [DllImport("user32.dll")]
  public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")]
  public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
}
"@
`;
      child.stdin.write(`${bootstrapScript}\n`);
      this.psProcess = child;
      this.initialized = true;
      return child;
    } catch (error) {
      this.logger.warn(
        `Unable to start Win32InputBridge: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    }
  }

  static execute(cmd: Win32InputCommand): boolean {
    const proc = this.ensureProcess();
    if (!proc || !this.initialized) {
      return false;
    }

    try {
      const lines: string[] = [];

      if (
        typeof cmd.xRatio === 'number' &&
        typeof cmd.yRatio === 'number' &&
        Number.isFinite(cmd.xRatio) &&
        Number.isFinite(cmd.yRatio)
      ) {
        const clampedX = Math.max(0, Math.min(1, cmd.xRatio));
        const clampedY = Math.max(0, Math.min(1, cmd.yRatio));
        lines.push(
          `$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $x = [int]($b.Width * ${clampedX.toFixed(4)}); $y = [int]($b.Height * ${clampedY.toFixed(4)}); [SmartDeskWin32]::SetCursorPos($x, $y) | Out-Null`,
        );
      }

      if (cmd.kind === 'LEFT_CLICK') {
        lines.push(
          '[SmartDeskWin32]::mouse_event(0x0002, 0, 0, 0, 0); Start-Sleep -Milliseconds 15; [SmartDeskWin32]::mouse_event(0x0004, 0, 0, 0, 0)',
        );
      } else if (cmd.kind === 'RIGHT_CLICK') {
        lines.push(
          '[SmartDeskWin32]::mouse_event(0x0008, 0, 0, 0, 0); Start-Sleep -Milliseconds 15; [SmartDeskWin32]::mouse_event(0x0010, 0, 0, 0, 0)',
        );
      } else if (cmd.kind === 'DOUBLE_CLICK') {
        lines.push(
          '[SmartDeskWin32]::mouse_event(0x0002, 0, 0, 0, 0); [SmartDeskWin32]::mouse_event(0x0004, 0, 0, 0, 0); Start-Sleep -Milliseconds 40; [SmartDeskWin32]::mouse_event(0x0002, 0, 0, 0, 0); [SmartDeskWin32]::mouse_event(0x0004, 0, 0, 0, 0)',
        );
      } else if (cmd.kind === 'KEY' && cmd.key) {
        const mapped = SPECIAL_KEYS_MAP[cmd.key.toUpperCase()];
        if (mapped) {
          const b64 = Buffer.from(mapped, 'utf8').toString('base64');
          lines.push(
            `$k = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64}')); [System.Windows.Forms.SendKeys]::SendWait($k)`,
          );
        }
      } else if (cmd.kind === 'TEXT' && cmd.text) {
        const escaped = escapeSendKeysLiteral(cmd.text);
        const b64 = Buffer.from(escaped, 'utf8').toString('base64');
        lines.push(
          `$t = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64}')); [System.Windows.Forms.SendKeys]::SendWait($t)`,
        );
      }

      if (lines.length > 0) {
        proc.stdin.write(`${lines.join('; ')}\n`);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
