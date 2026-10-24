import type { LockedSection } from "./route";

/**
 * All on-page UI lives in one shadow root, so LeetCode's CSS can't break it,
 * our CSS can't leak into LeetCode, and it is created exactly once.
 */

export interface ViewState {
  /** Countdown pill in the corner with pause/restart controls; null hides it. */
  badge: {
    state: "locked" | "paused" | "unlocked";
    text: string;
    /** Pause/resume and restart buttons; hidden once solutions unlock. */
    showControls: boolean;
  } | null;
  /** "Start solving" card shown once per problem; null hides it. */
  startCard: { thinkTime: number; resetCode: boolean } | null;
  /** Full-page lock over a locked section; null hides it. */
  lock: {
    section: LockedSection;
    /** True when the problem's timer hasn't been started yet. */
    notStarted: boolean;
    remainingText: string;
    paused: boolean;
    canRevealEarly: boolean;
  } | null;
}

export interface UiHandlers {
  onStart: () => void;
  onBack: () => void;
  onRevealEarly: () => void;
  onTogglePause: () => void;
  onRestart: () => void;
}

const HOST_ID = "lcbp-root";

const STYLES = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: Inter, system-ui, -apple-system, sans-serif; }
  [hidden] { display: none !important; }

  .backdrop {
    position: fixed; inset: 0; z-index: 2147483646;
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
  }
  .backdrop.soft { background: rgba(0, 0, 0, .45); }
  .backdrop.hard { background: rgba(0, 0, 0, .82); backdrop-filter: blur(10px); }

  .card {
    width: min(440px, 100%);
    background: #111827; color: #f9fafb;
    padding: 28px; border-radius: 18px; text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, .45);
  }
  .card h1 { margin: 0 0 10px; font-size: 22px; }
  .card p { margin: 0 0 18px; color: #9ca3af; font-size: 14px; line-height: 1.5; }
  .time { font-size: 40px; font-weight: 700; margin: 6px 0 20px; font-variant-numeric: tabular-nums; }

  .actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
  button {
    border: none; border-radius: 10px; padding: 11px 20px;
    font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .primary { background: #22c55e; color: #052e16; }
  .primary:hover { background: #4ade80; }
  .ghost { background: transparent; color: #9ca3af; border: 1px solid #374151; }
  .ghost:hover { color: #f9fafb; border-color: #6b7280; }
  .ghost.confirming { color: #fca5a5; border-color: #ef4444; }

  .badge {
    position: fixed; right: 16px; bottom: 16px; z-index: 2147483645;
    display: flex; align-items: center; gap: 6px;
    padding: 5px 6px 5px 14px; border-radius: 999px;
    background: #111827; color: #f9fafb; border: 1px solid #374151;
    font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums;
    box-shadow: 0 6px 20px rgba(0, 0, 0, .3);
  }
  .badge.unlocked { border-color: #22c55e; color: #86efac; padding-right: 14px; }
  .badge.paused { border-color: #f59e0b; color: #fcd34d; }
  .badge-text { padding: 3px 0; white-space: nowrap; }
  .icon-btn {
    min-width: 28px; height: 28px; padding: 0 8px; border-radius: 999px;
    background: #1f2937; color: #e5e7eb; border: 1px solid #374151;
    font-size: 13px; font-weight: 600; line-height: 1;
  }
  .icon-btn:hover { background: #374151; color: #fff; }
  .icon-btn.confirming { border-color: #ef4444; color: #fca5a5; }
`;

export class PracticeUi {
  private host: HTMLElement;
  private badge: HTMLDivElement;
  private badgeText: HTMLSpanElement;
  private pauseButton: HTMLButtonElement;
  private restartButton: HTMLButtonElement;
  private confirmingRestart: ReturnType<typeof setTimeout> | null = null;
  private startLayer: HTMLDivElement;
  private startText: HTMLParagraphElement;
  private lockLayer: HTMLDivElement;
  private lockTitle: HTMLHeadingElement;
  private lockText: HTMLParagraphElement;
  private lockTime: HTMLDivElement;
  private revealButton: HTMLButtonElement;
  private confirmingReveal = false;

  constructor(handlers: UiHandlers) {
    this.host = document.createElement("div");
    this.host.id = HOST_ID;
    const root = this.host.attachShadow({ mode: "open" });

    root.innerHTML = `
      <style>${STYLES}</style>

      <div class="badge" role="timer" hidden>
        <span class="badge-text" data-ref="badge-text"></span>
        <button class="icon-btn" data-action="pause"></button>
        <button class="icon-btn" data-action="restart" title="Restart timer: put the full think time back">↺</button>
      </div>

      <div class="backdrop soft" data-layer="start" hidden>
        <div class="card" role="dialog" aria-modal="true" aria-labelledby="lcbp-start-title">
          <h1 id="lcbp-start-title">🧠 Blind Practice</h1>
          <p data-ref="start-text"></p>
          <div class="actions">
            <button class="primary" data-action="start">Start solving</button>
          </div>
        </div>
      </div>

      <div class="backdrop hard" data-layer="lock" hidden>
        <div class="card" role="dialog" aria-modal="true" aria-labelledby="lcbp-lock-title">
          <h1 id="lcbp-lock-title" data-ref="lock-title"></h1>
          <p data-ref="lock-text"></p>
          <div class="time" data-ref="lock-time"></div>
          <div class="actions">
            <button class="primary" data-action="back">Back to the problem</button>
            <button class="ghost" data-action="reveal" hidden>Reveal anyway</button>
          </div>
        </div>
      </div>
    `;

    const q = <T extends Element>(selector: string) => root.querySelector(selector) as T;
    this.badge = q(".badge");
    this.badgeText = q('[data-ref="badge-text"]');
    this.pauseButton = q('[data-action="pause"]');
    this.restartButton = q('[data-action="restart"]');
    this.startLayer = q('[data-layer="start"]');
    this.startText = q('[data-ref="start-text"]');
    this.lockLayer = q('[data-layer="lock"]');
    this.lockTitle = q('[data-ref="lock-title"]');
    this.lockText = q('[data-ref="lock-text"]');
    this.lockTime = q('[data-ref="lock-time"]');
    this.revealButton = q('[data-action="reveal"]');

    q<HTMLButtonElement>('[data-action="start"]').addEventListener("click", handlers.onStart);
    this.pauseButton.addEventListener("click", handlers.onTogglePause);
    this.restartButton.addEventListener("click", () => {
      // Two-step, so a stray click can't throw away the time already spent.
      if (!this.confirmingRestart) {
        this.setConfirmingRestart(true);
        return;
      }
      this.setConfirmingRestart(false);
      handlers.onRestart();
    });
    q<HTMLButtonElement>('[data-action="back"]').addEventListener("click", handlers.onBack);
    this.revealButton.addEventListener("click", () => {
      // Two-step confirm instead of window.confirm(), which blocks the page.
      if (!this.confirmingReveal) {
        this.setConfirming(true);
        return;
      }
      this.setConfirming(false);
      handlers.onRevealEarly();
    });
  }

  /** The element that owns all our UI; events inside it must never be blocked. */
  get element(): HTMLElement {
    return this.host;
  }

  render(view: ViewState): void {
    this.ensureMounted();

    // Badge
    setHidden(this.badge, !view.badge);
    if (view.badge) {
      const { state, text, showControls } = view.badge;
      setText(this.badgeText, text);
      this.badge.classList.toggle("unlocked", state === "unlocked");
      this.badge.classList.toggle("paused", state === "paused");
      setHidden(this.pauseButton, !showControls);
      setHidden(this.restartButton, !showControls);
      setText(this.pauseButton, state === "paused" ? "▶" : "⏸");
      const pauseLabel = state === "paused" ? "Resume timer" : "Pause timer";
      if (this.pauseButton.title !== pauseLabel) {
        this.pauseButton.title = pauseLabel;
        this.pauseButton.setAttribute("aria-label", pauseLabel);
      }
      if (!showControls) this.setConfirmingRestart(false);
    }

    // Start card (never shown on top of the lock screen)
    const showStart = !!view.startCard && !view.lock;
    setHidden(this.startLayer, !showStart);
    if (view.startCard) {
      setText(
        this.startText,
        `Editorial, Solutions, your past Submissions and Discussion stay locked for ` +
          `${view.startCard.thinkTime} minute${view.startCard.thinkTime === 1 ? "" : "s"} ` +
          `after you start. The problem and the editor stay usable.` +
          (view.startCard.resetCode
            ? " Your saved code for this problem will be replaced with the default template."
            : ""),
      );
    }

    // Lock screen
    setHidden(this.lockLayer, !view.lock);
    if (!view.lock) {
      this.setConfirming(false);
      return;
    }
    const { section, notStarted, remainingText, paused, canRevealEarly } = view.lock;
    setText(this.lockTitle, `🔒 ${section} is locked`);
    setText(
      this.lockText,
      notStarted
        ? "Start the problem first. The timer begins when you click “Start solving”."
        : paused
          ? "Your timer is paused. It unlocks after this much more solving time:"
          : "Keep thinking. It unlocks in:",
    );
    setHidden(this.lockTime, notStarted);
    setText(this.lockTime, remainingText);
    setHidden(this.revealButton, !canRevealEarly || notStarted);
  }

  destroy(): void {
    this.host.remove();
  }

  private ensureMounted(): void {
    // Mount on <html>, not <body>: LeetCode's React app owns <body>'s subtree.
    if (!this.host.isConnected) document.documentElement.appendChild(this.host);
  }

  private setConfirmingRestart(confirming: boolean): void {
    if (this.confirmingRestart) clearTimeout(this.confirmingRestart);
    this.confirmingRestart = confirming ? setTimeout(() => this.setConfirmingRestart(false), 4000) : null;
    this.restartButton.classList.toggle("confirming", confirming);
    setText(this.restartButton, confirming ? "Restart?" : "↺");
    this.restartButton.setAttribute("aria-label", confirming ? "Click again to restart the timer" : "Restart timer");
  }

  private setConfirming(confirming: boolean): void {
    this.confirmingReveal = confirming;
    this.revealButton.classList.toggle("confirming", confirming);
    setText(this.revealButton, confirming ? "Click again to reveal" : "Reveal anyway");
  }
}

function setHidden(el: HTMLElement, hidden: boolean): void {
  if (el.hidden !== hidden) el.hidden = hidden;
}

function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}
