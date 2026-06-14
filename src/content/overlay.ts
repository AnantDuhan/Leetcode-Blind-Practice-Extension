import { canReveal, getRemainingMinutes } from "./strictMode";
import { startTimer } from "./timer";
import { loadSettings } from "../storage/settings";

export async function createOverlay() {
    if(document.getElementById("lcbp-overlay")) return;
    const settings = await loadSettings();
    const thinkTime = settings.strictMode ? settings.thinkTime : 0;

    const overlay = document.createElement("div");

    overlay.id = "lcbp-overlay";

    overlay.innerHTML = `
        <div id="lcbp-card">
        <h1>🧠 Blind Practice Mode</h1>

        <p>
            Previous solutions hidden.
        </p>

        <div id="lcbp-timer">
            ${thinkTime}:00
        </div>

        <button id="lcbp-continue">
            Unlock After ${thinkTime} Minutes
        </button>
        </div>
    `;

    document.body.appendChild(overlay);

    const button = document.getElementById("lcbp-continue") as HTMLButtonElement;

    setInterval(() => {
        const remaining = getRemainingMinutes(thinkTime);
        if (!button) return;

        button.textContent = remaining > 0 ? `Unlock After ${remaining}m` : "Start Solving";
    }, 1000);

    button.addEventListener("click", () => {
        const allowed = canReveal(thinkTime);
        if (!allowed) {
            const remaining = getRemainingMinutes(thinkTime );
            alert(`Strict Mode Active\n\n${remaining} minutes remaining.`);
            return;
        }
        overlay.remove();
    });
    console.log("Calling startTimer");
    startTimer(thinkTime);

    injectStyles();
}

function injectStyles() {
  const style = document.createElement("style");

  style.innerHTML = `
    #lcbp-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.75);
        backdrop-filter: blur(10px);
        z-index: 999999;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    #lcbp-card {
        width: 450px;
        background: #111827;
        color: white;
        padding: 32px;
        border-radius: 20px;
        text-align: center;
        box-shadow:
        0 0 40px rgba(0,0,0,.4);
    }

    #lcbp-card h1 {
        margin-bottom: 16px;
    }

    #lcbp-timer {
        font-size: 42px;
        font-weight: bold;
        margin: 20px 0;
    }

    #lcbp-continue {
        background: #22c55e;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 12px;
        cursor: pointer;
    }
  `;

  document.head.appendChild(style);
}