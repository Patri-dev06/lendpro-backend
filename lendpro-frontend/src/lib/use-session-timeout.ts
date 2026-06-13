import { useCallback, useEffect, useRef, useState } from "react";

const ACTIVITY_EVENTS = [
  "mousemove", "mousedown", "keydown", "scroll", "touchstart",
] as const;

export interface UseSessionTimeoutOptions {
  /** Total inactivity allowed before logout. Default: 30 minutes. */
  timeoutMs?: number;
  /** How long before expiry to show the warning dialog. Default: 2 minutes. */
  warnBeforeMs?: number;
  onTimeout: () => void;
}

export function useSessionTimeout({
  timeoutMs = 30 * 60 * 1000,
  warnBeforeMs = 2 * 60 * 1000,
  onTimeout,
}: UseSessionTimeoutOptions) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(warnBeforeMs / 1000));

  // Refs so activity handler never has stale closures
  const showWarningRef  = useRef(false);
  const warnTimerRef    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const expireTimerRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const countdownRef    = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const onTimeoutRef    = useRef(onTimeout);
  onTimeoutRef.current  = onTimeout;

  const clearAll = useCallback(() => {
    clearTimeout(warnTimerRef.current);
    clearTimeout(expireTimerRef.current);
    clearInterval(countdownRef.current);
  }, []);

  const start = useCallback(() => {
    clearAll();
    showWarningRef.current = false;
    setShowWarning(false);

    // Fire warning at (timeout - warnBefore)
    warnTimerRef.current = setTimeout(() => {
      showWarningRef.current = true;
      setShowWarning(true);
      setSecondsLeft(Math.floor(warnBeforeMs / 1000));

      countdownRef.current = setInterval(() => {
        setSecondsLeft((s) => Math.max(0, s - 1));
      }, 1000);
    }, timeoutMs - warnBeforeMs);

    // Hard logout at timeout
    expireTimerRef.current = setTimeout(() => {
      clearAll();
      onTimeoutRef.current();
    }, timeoutMs);
  }, [clearAll, timeoutMs, warnBeforeMs]);

  // "Stay signed in" resets all timers
  const extend = useCallback(() => start(), [start]);

  useEffect(() => {
    start();

    // Reset timers on any activity — but only when the warning isn't visible.
    // Once the warning is up, activity alone doesn't dismiss it (user must click).
    const onActivity = () => { if (!showWarningRef.current) start(); };

    ACTIVITY_EVENTS.forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true })
    );

    return () => {
      clearAll();
      ACTIVITY_EVENTS.forEach((e) =>
        window.removeEventListener(e, onActivity)
      );
    };
  }, [start, clearAll]);

  return { showWarning, secondsLeft, extend };
}
