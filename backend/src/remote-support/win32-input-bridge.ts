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

const MOUSE_ACTION_CODES: Record<string, number> = {
  MOVE: 0,
  LEFT_CLICK: 1,
  RIGHT_CLICK: 2,
  DOUBLE_CLICK: 3,
};

function escapeSendKeysLiteral(raw: string): string {
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

      // Pre-compile native C# wrapper calling user32.dll GetSystemMetrics, SetCursorPos, and mouse_event directly (<0.2ms execution)
      const bootstrapScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @"
using System;
using System.Threading;
using System.Runtime.InteropServices;
public static class SmartDeskWin32 {
  [DllImport("user32.dll")]
  public static extern int GetSystemMetrics(int nIndex);
  [DllImport("user32.dll")]
  public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")]
  public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);

  public static void ExecMouse(double xRatio, double yRatio, int actionCode) {
    int w = GetSystemMetrics(0);
    int h = GetSystemMetrics(1);
    if (w > 0 && h > 0 && xRatio >= 0 && yRatio >= 0) {
      int x = (int)Math.Round(w * Math.Max(0.0, Math.Min(1.0, xRatio)));
      int y = (int)Math.Round(h * Math.Max(0.0, Math.Min(1.0, yRatio)));
      SetCursorPos(x, y);
    }
    if (actionCode == 1) {
      mouse_event(0x0002, 0, 0, 0, 0);
      mouse_event(0x0004, 0, 0, 0, 0);
    } else if (actionCode == 2) {
      mouse_event(0x0008, 0, 0, 0, 0);
      mouse_event(0x0010, 0, 0, 0, 0);
    } else if (actionCode == 3) {
      mouse_event(0x0002, 0, 0, 0, 0);
      mouse_event(0x0004, 0, 0, 0, 0);
      Thread.Sleep(25);
      mouse_event(0x0002, 0, 0, 0, 0);
      mouse_event(0x0004, 0, 0, 0, 0);
    }
  }
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
      if (cmd.kind in MOUSE_ACTION_CODES) {
        const actionCode = MOUSE_ACTION_CODES[cmd.kind] ?? 0;
        const x =
          typeof cmd.xRatio === 'number' && Number.isFinite(cmd.xRatio)
            ? cmd.xRatio.toFixed(4)
            : '-1';
        const y =
          typeof cmd.yRatio === 'number' && Number.isFinite(cmd.yRatio)
            ? cmd.yRatio.toFixed(4)
            : '-1';
        proc.stdin.write(`[SmartDeskWin32]::ExecMouse(${x}, ${y}, ${actionCode})\n`);
        return true;
      }

      if (cmd.kind === 'KEY' && cmd.key) {
        const mapped = SPECIAL_KEYS_MAP[cmd.key.toUpperCase()];
        if (mapped) {
          const b64 = Buffer.from(mapped, 'utf8').toString('base64');
          proc.stdin.write(
            `$k = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64}')); [System.Windows.Forms.SendKeys]::SendWait($k)\n`,
          );
          return true;
        }
      } else if (cmd.kind === 'TEXT' && cmd.text) {
        const escaped = escapeSendKeysLiteral(cmd.text);
        const b64 = Buffer.from(escaped, 'utf8').toString('base64');
        proc.stdin.write(
          `$t = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64}')); [System.Windows.Forms.SendKeys]::SendWait($t)\n`,
        );
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }
}
