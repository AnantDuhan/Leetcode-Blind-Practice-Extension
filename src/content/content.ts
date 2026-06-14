import { createOverlay } from "./overlay";
import { startDomObserver } from "./domObserver";
import { watchRouteChange } from "./leetcodeObserver";

function initialize() {
  createOverlay();
  startDomObserver();
}

initialize();

watchRouteChange(() => {

  if (location.href.includes("/problems/")) {
    initialize();
  }
});