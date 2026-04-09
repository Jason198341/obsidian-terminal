import { Plugin, WorkspaceLeaf } from "obsidian";
import { TerminalView, TERMINAL_VIEW_TYPE } from "./terminal-view";

export default class ObsidianTerminalPlugin extends Plugin {
  async onload() {
    // Register the terminal view type
    this.registerView(
      TERMINAL_VIEW_TYPE,
      (leaf) => new TerminalView(leaf)
    );

    // Ribbon icon
    this.addRibbonIcon("terminal", "Open Terminal", () => {
      this.openTerminal();
    });

    // Command: focus existing or open new
    this.addCommand({
      id: "open-terminal",
      name: "Open Terminal",
      hotkeys: [{ modifiers: ["Mod"], key: "`" }],
      callback: () => this.openTerminal(),
    });

    // Command: always open a new terminal tab
    this.addCommand({
      id: "open-terminal-new",
      name: "Open New Terminal Tab",
      callback: () => this.openTerminal(true),
    });

    // Command: restart the active terminal
    this.addCommand({
      id: "restart-terminal",
      name: "Restart Terminal",
      callback: () => this.restartActiveTerminal(),
    });
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(TERMINAL_VIEW_TYPE);
  }

  // ─── Open / Focus ─────────────────────────────────────────────────────────

  async openTerminal(forceNew = false): Promise<void> {
    const { workspace } = this.app;

    // Reuse existing leaf unless forceNew
    if (!forceNew) {
      const existing = workspace.getLeavesOfType(TERMINAL_VIEW_TYPE);
      if (existing.length > 0) {
        workspace.revealLeaf(existing[0]);
        return;
      }
    }

    // Create a new leaf in the bottom split
    let leaf: WorkspaceLeaf;
    const bottomLeaf = workspace.getLeavesOfType("empty").find(
      (l) => (l as any).parent?.type === "tabs"
    );

    if (bottomLeaf) {
      leaf = bottomLeaf;
    } else {
      // Split the current active leaf horizontally (creates bottom pane)
      leaf = workspace.getLeaf("split", "horizontal");
    }

    await leaf.setViewState({
      type: TERMINAL_VIEW_TYPE,
      active: true,
    });

    workspace.revealLeaf(leaf);
  }

  // ─── Restart ──────────────────────────────────────────────────────────────

  private restartActiveTerminal(): void {
    const leaves = this.app.workspace.getLeavesOfType(TERMINAL_VIEW_TYPE);
    if (leaves.length === 0) {
      this.openTerminal();
      return;
    }
    const view = leaves[0].view as TerminalView;
    view.restart();
  }
}
