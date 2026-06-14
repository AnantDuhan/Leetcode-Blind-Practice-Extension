const KEYWORDS = [
  "Editorial",
  "Solutions",
  "Submissions",
  "AI",
  "Discuss"
];

export function hideBlockedElements() {
    const allElements = document.querySelectorAll("*");

    allElements.forEach((element) => {
        const text = element.textContent?.trim();

        if(!text) return;

        if(KEYWORDS.includes(text)) {
            const target = element as HTMLElement;
            target.innerHTML = "🚫 Hidden by Blind Practice";
        }
    });
}