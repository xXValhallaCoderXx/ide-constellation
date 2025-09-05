/**
 * Simple debounce utility used for active editor change events.
 * FR5: Debounce ensures rapid editor switches only dispatch the final highlight update.
 * @param fn Function to debounce.
 * @param delay Delay in milliseconds.
 */
export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
    let handle: NodeJS.Timeout | null = null;
    const debounced = (...args: Parameters<T>) => {
        if (handle) { clearTimeout(handle); }
        handle = setTimeout(() => fn(...args), delay);
    };
    (debounced as any).cancel = () => { if (handle) { clearTimeout(handle); handle = null; } };
    return debounced as T & { cancel: () => void };
}
