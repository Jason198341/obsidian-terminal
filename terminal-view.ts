import { ItemView, WorkspaceLeaf } from "obsidian";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { spawn } from "child_process";
import type { ChildProcessWithoutNullStreams } from "child_process";
import * as os from "os";

export const TERMINAL_VIEW_TYPE = "obsidian-terminal";

export class TerminalView extends ItemView {
  private term: Terminal | null = null;
  private fitAddon: FitAddon | null = null;
  private shell: ChildProcessWithoutNullStreams | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private termWrapper: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return TERMINAL_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Terminal";
  }

  getIcon(): string {
    return "terminal";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("obsidian-terminal-container");

    this.termWrapper = container.createEl("div", {
      cls: "obsidian-terminal-wrapper",
    });

    // Create terminal
    this.term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      lineHeight: 1.3,
      fontFamily:
        '"Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, "Courier New", monospace',
      theme: {
        background: "#0d1117",
        foreground: "#c9d1d9",
        cursor: "#58a6ff",
        cursorAccent: "#0d1117",
        selectionBackground: "#264f7866",
        black: "#0d1117",
        red: "#ff7b72",
        green: "#3fb950",
        yellow: "#d29922",
        blue: "#58a6ff",
        magenta: "#bc8cff",
        cyan: "#39c5cf",
        white: "#b1bac4",
        brightBlack: "#6e7681",
        brightRed: "#ffa198",
        brightGreen: "#56d364",
        brightYellow: "#e3b341",
        brightBlue: "#79c0ff",
        brightMagenta: "#d2a8ff",
        brightCyan: "#56d4dd",
        brightWhite: "#f0f6fc",
      },
      allowTransparency: true,
      convertEol: true,
      scrollback: 5000,
      allowProposedApi: true,
    });

    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);
    this.term.open(this.termWrapper);

    // Fit after short delay so DOM dimensions are stable
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.fitAddon?.fit();
        this.spawnShell();
      });
    });

    // Auto-resize on panel resize
    this.resizeObserver = new ResizeObserver(() => {
      this.fitAddon?.fit();
    });
    this.resizeObserver.observe(this.termWrapper);
  }

  // ─── Shell Detection ───────────────────────────────────────────────────────

  private getShell(): { cmd: string; args: string[] } {
    if (process.platform === "win32") {
      // Prefer bash (MSYS2 / Git Bash) if available in PATH
      const pathEnv = (process.env.PATH ?? "") + (process.env.Path ?? "");
      const hasBash =
        pathEnv.toLowerCase().includes("git") ||
        pathEnv.toLowerCase().includes("msys") ||
        pathEnv.toLowerCase().includes("mingw") ||
        pathEnv.toLowerCase().includes("cygwin");

      if (hasBash) {
        return { cmd: "bash.exe", args: ["--login", "-i"] };
      }
      // Fallback: PowerShell
      return {
        cmd: "powershell.exe",
        args: ["-NoLogo", "-NoExit"],
      };
    }
    // macOS / Linux
    return { cmd: process.env.SHELL ?? "/bin/bash", args: ["--login", "-i"] };
  }

  // ─── Shell Spawn ───────────────────────────────────────────────────────────

  private spawnShell(): void {
    if (!this.term) return;

    // Vault root as CWD
    const adp = (this.app.vault.adapter as any);
    const vaultPath: string =
      adp.basePath ?? adp.getBasePath?.() ?? os.homedir();

    const { cmd, args } = this.getShell();

    this.term.write(
      `\x1b[36m⬡ Obsidian Terminal\x1b[0m  \x1b[90m${vaultPath}\x1b[0m\r\n` +
      `\x1b[90m${"─".repeat(52)}\x1b[0m\r\n`
    );

    try {
      this.shell = spawn(cmd, args, {
        cwd: vaultPath,
        env: {
          ...process.env,
          TERM: "xterm-256color",
          COLORTERM: "truecolor",
          FORCE_COLOR: "3",
        },
        windowsHide: true,
      }) as ChildProcessWithoutNullStreams;
    } catch (err: any) {
      this.term.write(
        `\r\n\x1b[31m✗ 셸 시작 실패: ${err?.message}\x1b[0m\r\n` +
        `\x1b[33m  시도한 명령: ${cmd} ${args.join(" ")}\x1b[0m\r\n`
      );
      return;
    }

    // Shell stdout/stderr → xterm
    this.shell.stdout.on("data", (data: Buffer) => {
      this.term?.write(data);
    });
    this.shell.stderr.on("data", (data: Buffer) => {
      this.term?.write(data);
    });

    // Shell exit
    this.shell.on("close", (code: number | null) => {
      this.term?.write(
        `\r\n\x1b[33m[프로세스 종료 (코드: ${code ?? "?"})] ` +
        `패널을 닫고 다시 열면 새 터미널이 시작됩니다.\x1b[0m\r\n`
      );
    });

    // Shell spawn error (binary not found etc.)
    this.shell.on("error", (err: Error) => {
      this.term?.write(
        `\r\n\x1b[31m✗ 오류: ${err.message}\x1b[0m\r\n` +
        `\x1b[33m  cmd: ${cmd} ${args.join(" ")}\x1b[0m\r\n`
      );
    });

    // xterm input → shell stdin
    this.term.onData((data: string) => {
      if (this.shell?.stdin?.writable) {
        this.shell.stdin.write(data);
      }
    });
  }

  // ─── Restart ───────────────────────────────────────────────────────────────

  public restart(): void {
    if (this.shell && !this.shell.killed) {
      this.shell.kill();
    }
    this.shell = null;
    this.term?.reset();
    this.spawnShell();
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  async onClose(): Promise<void> {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.shell && !this.shell.killed) {
      this.shell.kill();
    }
    this.shell = null;

    this.term?.dispose();
    this.term = null;
    this.fitAddon = null;
    this.termWrapper = null;
  }
}
