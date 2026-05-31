import { useCallback, useEffect, useRef } from 'react';

/**
 * Returns a debounced version of `callback`. Pending calls are FLUSHED on
 * unmount: if the component (e.g. an edit dialog) closes before the timer
 * fires, the latest call still runs, so in-flight edits aren't silently lost.
 * The callback is read through a ref so the latest closure always runs without
 * resetting the timer on every render.
 */
export function useDebounce<T extends (...args: any[]) => void>(
    callback: T,
    delay: number
): T {
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const callbackRef = useRef(callback);
    const pendingArgsRef = useRef<Parameters<T> | null>(null);

    callbackRef.current = callback;

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                if (pendingArgsRef.current) {
                    callbackRef.current(...pendingArgsRef.current);
                    pendingArgsRef.current = null;
                }
            }
        };
    }, []);

    return useCallback(
        (...args: Parameters<T>) => {
            pendingArgsRef.current = args;
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                timeoutRef.current = undefined;
                pendingArgsRef.current = null;
                callbackRef.current(...args);
            }, delay);
        },
        [delay]
    ) as T;
}
