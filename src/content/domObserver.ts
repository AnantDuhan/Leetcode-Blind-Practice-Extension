import { hideBlockedElements } from "./blocker";

let observer: MutationObserver | null = null;

export function startDomObserver() {
    if(observer) {
        observer.disconnect();
    }

    observer = new MutationObserver(() => {
        hideBlockedElements();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    hideBlockedElements();
}