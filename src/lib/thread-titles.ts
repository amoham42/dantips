export function makeShortTitle(text: string, max = 48) {
    const t = text.trim().replace(/\s+/g, " ");
    return t.length <= max ? t : t.slice(0, max).trimEnd() + "…";
}

const key = (threadId: string) => `thread-title:${threadId}`;

export function getStoredTitle(threadId: string) {
    if (typeof window === "undefined") return undefined;
    return localStorage.getItem(key(threadId)) ?? undefined;
}

export function setStoredTitle(threadId: string, title: string) {
    if (typeof window === "undefined") return;
    localStorage.setItem(key(threadId), title);
}