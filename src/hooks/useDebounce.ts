import { useCallback, useEffect, useRef } from 'react';

// Returns a stable debounced function whose latest-callback semantics hold even
// when consumers pass freshly-allocated callbacks each render. The previous
// `[callback, delay]` deps caused the returned function to churn identity on
// every render, defeating downstream memoization.
export function useDebounce<T extends (...args: any[]) => void>(
    callback: T,
    delay: number
): T {
    const timeoutRef = useRef<NodeJS.Timeout>();
    const callbackRef = useRef(callback);
    useEffect(() => { callbackRef.current = callback; }, [callback]);

    return useCallback(
        ((...args: Parameters<T>) => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => callbackRef.current(...args), delay);
        }) as T,
        [delay]
    );
}
