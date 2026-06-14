export function startTimer(minutes: number) {
    let remaining = minutes * 60;

    const interval = setInterval(() => {
        remaining--;
        const timer = document.getElementById("lcbp-timer");

        if (!timer) {
        clearInterval(interval);
        return;
        }

        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        timer.textContent = `${mins.toString().padStart(2,"0")}:${secs.toString().padStart(2,"0")}`;
    }, 1000);
}