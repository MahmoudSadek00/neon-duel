import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { call, socket } from './net';
import { setAudioSettings, sfx, unlockAudio } from './audio';
import type { ClientRoomState, GuessEntry, Profile } from '../../../shared/types';

export type Screen = 'menu' | 'profile' | 'howto' | 'settings' | 'create' | 'join' | 'quick';
export interface Settings { master: number; sfx: number; music: number; muted: boolean; motion: 'system' | 'reduced' | 'full' }
export interface Toast { id: number; text: string; tone: 'info' | 'error' | 'good' }

const SETTINGS_KEY = 'neonduel.settings';
const defaults: Settings = { master: 0.8, sfx: 0.8, music: 0.3, muted: false, motion: 'system' };
function loadSettings(): Settings {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return defaults; }
}

interface Store {
  connected: boolean;
  profile: Profile | null;
  room: ClientRoomState | null;
  screen: Screen;
  go: (s: Screen) => void;
  settings: Settings;
  setSettings: (s: Settings) => void;
  reducedMotion: boolean;
  toasts: Toast[];
  toast: (text: string, tone?: Toast['tone']) => void;
  lastGuess: GuessEntry | null;
  clockOffset: number;
  refreshProfile: () => Promise<void>;
  saveProfile: (name: string, avatar: string) => Promise<void>;
  act: <T>(event: string, payload?: Record<string, unknown>) => Promise<T | undefined>;
}

const Ctx = createContext<Store>(null!);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(socket.connected);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [room, setRoom] = useState<ClientRoomState | null>(null);
  const [screen, setScreen] = useState<Screen>('menu');
  const [settings, setSettingsState] = useState<Settings>(loadSettings);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lastGuess, setLastGuess] = useState<GuessEntry | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [systemReduced, setSystemReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const toastId = useRef(0);
  const prevRoom = useRef<ClientRoomState | null>(null);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const refreshProfile = useCallback(async () => {
    try { setProfile(await call<Profile>('profile:get')); } catch { /* offline */ }
  }, []);

  const saveProfile = useCallback(async (name: string, avatar: string) => {
    setProfile(await call<Profile>('profile:update', { name, avatar }));
  }, []);

  const act = useCallback(async <T,>(event: string, payload: Record<string, unknown> = {}) => {
    try { return await call<T>(event, payload); } catch (e) {
      sfx.error();
      toast((e as Error).message, 'error');
      return undefined;
    }
  }, [toast]);

  const setSettings = useCallback((s: Settings) => {
    setSettingsState(s);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }, []);

  useEffect(() => { setAudioSettings(settings); }, [settings]);

  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setSystemReduced(mq.matches);
    mq.addEventListener('change', on);
    // browsers only allow audio after a gesture
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const onConnect = () => { setConnected(true); refreshProfile(); };
    const onDisconnect = () => setConnected(false);
    const onState = (s: ClientRoomState | null) => {
      const prev = prevRoom.current;
      if (s) setClockOffset(s.serverNow - Date.now());
      if (prev && s && !prev.opponent && s.opponent) { sfx.join(); toast(`${s.opponent.name} joined the room`, 'good'); }
      if (prev && s && prev.opponent?.connected && s.opponent && !s.opponent.connected) toast(`${s.opponent.name} lost connection — waiting for them to return`, 'info');
      if (prev && s && prev.opponent && !prev.opponent.connected && s.opponent?.connected) toast(`${s.opponent.name} reconnected`, 'good');
      if (prev && !s && prev.phase !== 'finished') toast('You left the room.', 'info');
      prevRoom.current = s;
      setRoom(s);
      // only fall back to the menu when the player actually left a room (keeps ?room= invite links on the Join screen)
      if (!s && prev) setScreen((sc) => (sc === 'quick' ? sc : 'menu'));
    };
    const onGuess = (g: GuessEntry) => setLastGuess(g);
    const onTimeout = () => toast('Time ran out — your turn was skipped.', 'error');
    const onEnd = () => refreshProfile();
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onState);
    socket.on('guess:result', onGuess);
    socket.on('turn:timeout', onTimeout);
    socket.on('match:end', onEnd);
    if (socket.connected) onConnect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onState);
      socket.off('guess:result', onGuess);
      socket.off('turn:timeout', onTimeout);
      socket.off('match:end', onEnd);
    };
  }, [refreshProfile, toast]);

  const reducedMotion = settings.motion === 'reduced' || (settings.motion === 'system' && systemReduced);
  useEffect(() => { document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full'; }, [reducedMotion]);

  const value = useMemo<Store>(() => ({
    connected, profile, room, screen, go: setScreen, settings, setSettings, reducedMotion, toasts, toast,
    lastGuess, clockOffset, refreshProfile, saveProfile, act,
  }), [connected, profile, room, screen, settings, setSettings, reducedMotion, toasts, toast, lastGuess, clockOffset, refreshProfile, saveProfile, act]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
