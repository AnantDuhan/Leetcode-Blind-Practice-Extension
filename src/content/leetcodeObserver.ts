let currentUrl = location.href;

export function watchRouteChange(callback: (url: string) => void) {
    new MutationObserver(() => {
        if(currentUrl !== location.href) {
            currentUrl = location.href;
            callback(currentUrl);
        }
    }).observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );
};