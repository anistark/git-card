import { useCallback, useEffect, useState } from 'react';
import type { Profile } from '../lib/profile';
import { isValidLogin } from '../lib/profile';
import { fetchPublicProfile, PublicApiError, type Step } from '../lib/public-api';

export type StepState = 'start' | 'done' | 'failed';

export type ProfileState =
  | { status: 'empty' }
  | { status: 'loading'; login: string; steps: Partial<Record<Step, StepState>> }
  | { status: 'error'; login: string; error: PublicApiError | Error }
  | { status: 'ready'; profile: Profile; warnings: string[] };

/** Read a query parameter once. Pages are static, so the URL is the only input. */
export function useParam(name: string): string | null {
  const [value] = useState(() => (typeof location === 'undefined' ? null : new URLSearchParams(location.search).get(name)));
  return value;
}

export function useProfile(login: string | null): [ProfileState, () => void] {
  const [reloads, setReloads] = useState(0);
  const [state, setState] = useState<ProfileState>(() => (login ? { status: 'loading', login, steps: {} } : { status: 'empty' }));

  useEffect(() => {
    if (!login) return setState({ status: 'empty' });
    if (!isValidLogin(login)) {
      return setState({ status: 'error', login, error: new PublicApiError(`"${login}" is not a valid GitHub username.`, 'not-found') });
    }
    const ctrl = new AbortController();
    setState({ status: 'loading', login, steps: {} });
    fetchPublicProfile(login, {
      signal: ctrl.signal,
      onStep: (step, s) => setState((prev) => (prev.status === 'loading' ? { ...prev, steps: { ...prev.steps, [step]: s } } : prev)),
    })
      .then(({ profile, warnings }) => setState({ status: 'ready', profile, warnings }))
      .catch((error: Error) => {
        if (error.name !== 'AbortError') setState({ status: 'error', login, error });
      });
    return () => ctrl.abort();
  }, [login, reloads]);

  const reload = useCallback(() => {
    if (!login) return;
    try {
      localStorage.removeItem(`gc:profile:v1:${login.toLowerCase()}`);
    } catch {
      // Storage blocked: there is no cache to clear.
    }
    setReloads((n) => n + 1);
  }, [login]);

  return [state, reload];
}
