let problemStartTime = Date.now();

export function resetProblemStartTime() {
    problemStartTime = Date.now();
}

export function canReveal(requiredMinutes: number) {
    const elapsedMinutes = (Date.now() - problemStartTime) / 60000;
    return elapsedMinutes >= requiredMinutes;
}

export function getRemainingMinutes(requiredMinutes: number) {
    const elapsedMinutes = (Date.now() - problemStartTime) / 60000;
    return Math.max(0, Math.ceil(requiredMinutes - elapsedMinutes));
}