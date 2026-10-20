'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type HealthState = 'idle' | 'checking' | 'healthy' | 'offline';

const RETRY_DELAYS = [0, 1000, 2500, 5000];

export default function InteractionHealthMonitor() {
  const [state, setState] = useState<HealthState>('idle');
  const [message, setMessage] = useState('');
  const activated = useRef(false);
  const checking = useRef(false);
  const lastHealthy = useRef(true);
  const hideTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const checkHealth = useCallback(async () => {
    if (checking.current || document.visibilityState === 'hidden') return;
    checking.current = true;
    setState('checking');

    try {
      let healthy = false;
      for (const delay of RETRY_DELAYS) {
        if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
        try {
          const response = await fetch('/api/health', {
            method: 'GET',
            cache: 'no-store',
            headers: { accept: 'application/json' },
            signal: AbortSignal.timeout(5000),
          });
          if (response.ok) {
            const payload = await response.json().catch(() => null);
            if (payload?.ok === true) {
              healthy = true;
              break;
            }
          }
        } catch {
          // Retry transient network failures with a bounded backoff.
        }
      }

      if (healthy) {
        setState('healthy');
        if (!lastHealthy.current) {
          setMessage('Connection restored. You can continue.');
          if (hideTimer.current) window.clearTimeout(hideTimer.current);
          hideTimer.current = window.setTimeout(() => {
            setMessage('');
            setState('idle');
          }, 4500);
        } else {
          setMessage('');
          setState('idle');
        }
        lastHealthy.current = true;
      } else {
        lastHealthy.current = false;
        setState('offline');
        setMessage('IIA is temporarily unreachable. Your text remains on this page; please try again shortly.');
      }
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    const activate = () => {
      if (activated.current) return;
      activated.current = true;
      void checkHealth();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && activated.current) void checkHealth();
    };

    window.addEventListener('focusin', activate, { passive: true });
    window.addEventListener('pointerdown', activate, { passive: true, once: true });
    window.addEventListener('keydown', activate, { passive: true, once: true });
    const onOffline = () => {
      lastHealthy.current = false;
      setState('offline');
      setMessage('Your device appears offline. Your text remains on this page; IIA will check again when the connection returns.');
    };
    const onOnline = () => {
      if (activated.current) void checkHealth();
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focusin', activate);
      window.removeEventListener('pointerdown', activate);
      window.removeEventListener('keydown', activate);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [checkHealth]);

  if (!message) return null;

  return (
    <div
      role={state === 'offline' ? 'alert' : 'status'}
      aria-live="polite"
      style={{
        position: 'fixed',
        zIndex: 10000,
        left: '50%',
        bottom: 'max(16px, env(safe-area-inset-bottom))',
        transform: 'translateX(-50%)',
        width: 'min(92vw, 560px)',
        padding: '12px 16px',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,.18)',
        background: state === 'offline' ? '#7f1d1d' : '#14532d',
        color: '#fff',
        boxShadow: '0 8px 30px rgba(0,0,0,.2)',
        fontSize: 14,
        lineHeight: 1.45,
      }}
    >
      <div>{message}</div>
      {state === 'offline' && (
        <button
          type="button"
          onClick={() => void checkHealth()}
          style={{
            marginTop: 8,
            padding: '7px 11px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,.65)',
            background: 'transparent',
            color: '#fff',
            font: 'inherit',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Retry connection
        </button>
      )}
    </div>
  );
}
