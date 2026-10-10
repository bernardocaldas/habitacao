// The game lives in a ref and is mutated in place by the simulation; `version` re-renders.
// The clock runs only while no decision, front page or dialog is open.
import { useCallback, useEffect, useRef, useState } from 'react';
import { SAVE_VERSION, newGame, randomSeed, teamsBusy, tick, openSites } from '../sim/sim';
import type { Difficulty, GameState } from '../sim/types';

const KEY = 'aguarda-parecer-v1';
export const SPEED_MS = [0, 2600, 1300, 600, 110] as const;
export type Speed = 0 | 1 | 2 | 3 | 4;

function load(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    return s.v === SAVE_VERSION ? s : null;
  } catch {
    return null;
  }
}

function save(s: GameState | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode or storage full: the game still runs */
  }
}

export function pref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(`aguarda-parecer-${key}`) ?? fallback;
  } catch {
    return fallback;
  }
}
export function setPref(key: string, v: string) {
  try {
    localStorage.setItem(`aguarda-parecer-${key}`, v);
  } catch {
    /* ignore */
  }
}

export function useGame() {
  const ref = useRef<GameState | null>(null);
  const [saved] = useState<GameState | null>(() => load());
  const [, setVersion] = useState(0);
  const [speed, setSpeedState] = useState<Speed>(0);
  const prevSpeed = useRef<Speed>(1);
  const [hold, setHold] = useState(false); // a dialog or a front page is open
  const [toast, setToast] = useState<{ id: number; text: string; project?: number }[]>([]);
  const seenNews = useRef(0);
  const [paper, setPaper] = useState<number | null>(null); // index into s.news of the open front page
  const [pauseForNews, setPauseForNews] = useState(() => pref('news', '1') === '1');

  const bump = useCallback(() => {
    setVersion((v) => v + 1);
    save(ref.current);
  }, []);

  const setSpeed = useCallback((sp: Speed) => {
    if (sp === 4 && speedRef.current !== 4) prevSpeed.current = (speedRef.current || 1) as Speed;
    setSpeedState(sp);
  }, []);
  const speedRef = useRef<Speed>(0);
  speedRef.current = speed;

  const start = useCallback((difficulty: Difficulty) => {
    ref.current = newGame(randomSeed(), difficulty);
    seenNews.current = 0;
    setPaper(null);
    setSpeedState(0);
    bump();
  }, [bump]);

  const resume = useCallback(() => {
    if (!saved) return;
    ref.current = saved;
    seenNews.current = saved.news.length;
    bump();
  }, [saved, bump]);

  const quit = useCallback(() => {
    ref.current = null;
    save(null);
    setSpeedState(0);
    setVersion((v) => v + 1);
  }, []);

  const step = useCallback(() => {
    const s = ref.current;
    if (!s || s.over || s.decisions.length) return;
    const freeBefore = teamsBusy(s) < s.teams && openSites(s).length > 0;
    tick(s);
    // Front pages: a major event opens the paper and, by default, stops the clock.
    for (let i = seenNews.current; i < s.news.length; i++) {
      if (s.news[i].major && pauseForNewsRef.current) { setPaper(i); seenNews.current = i + 1; break; }
      seenNews.current = i + 1;
    }
    if (speedRef.current === 4) {
      const freeAfter = teamsBusy(s) < s.teams && openSites(s).length > 0;
      if (s.decisions.length || s.over || (!freeBefore && freeAfter)) setSpeedState(prevSpeed.current);
    }
    bump();
  }, [bump]);
  const pauseForNewsRef = useRef(pauseForNews);
  pauseForNewsRef.current = pauseForNews;

  useEffect(() => {
    if (!speed || hold || paper != null) return;
    const id = window.setInterval(step, SPEED_MS[speed]);
    return () => window.clearInterval(id);
  }, [speed, hold, paper, step]);

  const act = useCallback(<T,>(f: (s: GameState) => T): T | undefined => {
    const s = ref.current;
    if (!s) return undefined;
    const r = f(s);
    bump();
    return r;
  }, [bump]);

  const pushToast = useCallback((text: string, project?: number) => {
    const id = Date.now() + Math.random();
    setToast((t) => [...t.slice(-3), { id, text, project }]);
    window.setTimeout(() => setToast((t) => t.filter((x) => x.id !== id)), 8000);
  }, []);

  return {
    s: ref.current,
    saved: saved && !saved.over ? saved : null,
    speed, setSpeed, hold, setHold,
    start, resume, quit, act, step,
    paper, setPaper,
    pauseForNews, setPauseForNews: (v: boolean) => { setPauseForNews(v); setPref('news', v ? '1' : '0'); },
    toast, pushToast,
  };
}

export type Game = ReturnType<typeof useGame>;
