import { useCallback, useEffect, useRef } from 'react';

// Returns a stable debounced function whose latest-callback semantics hold even
// when consumers pass freshly-allocated callbacks each render (the callback is
// read through a ref, so the returned function's identity only depends on
// `delay`). Pending calls are also FLUSHED on unmount: if the component (e.g.
// an edit dialog) closes before the timer fires, the latest call still runs, so
// in-flight edits aren't silently lost.
export function useDebounce<T extends (...args: any[]) => void>(
    callback: T,
    delay: number
): T {
    const timeoutRef = useRef<NodeJS.Timeout>();
    const callbackRef = useRef(callback);
    const pendingArgsRef = useRef<Parameters<T> | null>(null);
    useEffect(() => { callbackRef.current = callback; }, [callback]);
    useEffect(() => () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            if (pendingArgsRef.current) {
                callbackRef.current(...pendingArgsRef.current);
                pendingArgsRef.current = null;
            }
        }
    }, []);

    return useCallback(
        ((...args: Parameters<T>) => {
            pendingArgsRef.current = args;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                timeoutRef.current = undefined;
                pendingArgsRef.current = null;
                callbackRef.current(...args);
            }, delay);
        }) as T,
        [delay]
    );
}
