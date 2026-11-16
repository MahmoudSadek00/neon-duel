import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { sfx } from '../lib/audio';
import { BackButton, Page } from '../components/ui';
import { DEFAULT_TURN_SECONDS, TURN_SECONDS_OPTIONS } from '../../../shared/rules';

export function CreateRoom() {
  const { go, act } = useStore();
  const [turn, setTurn] = useState<number>(DEFAULT_TURN_SECONDS);
  const [busy, setBusy] = useState(false);
  const create = async () => { setBusy(true); sfx.submit(); await act('room:create', { turnSeconds: turn }); setBusy(false); };
  return (
    <Page k="create">
      <BackButton onClick={() => go('menu')} />
      <div className="center">
        <section className="glass panel stack" style={{ width: 'min(460px, 100%)' }}>
          <h2 className="h1" style={{ textAlign: 'center' }}>Private Room</h2>
          <p className="lead" style={{ alignSelf: 'center' }}>You'll get a room code to share with one friend.</p>
          <div className="field">
            <label>Turn timer</label>
            <div className="seg" role="group" aria-label="Turn timer">
              {TURN_SECONDS_OPTIONS.map((s) => (
                <button key={s} aria-pressed={turn === s} onClick={() => { sfx.click(); setTurn(s); }}>{s}s</button>
              ))}
            </div>
          </div>
          <button className="btn btn--block" onClick={create} disabled={busy}>{busy ? 'Creating…' : 'Create Room'}</button>
        </section>
      </div>
    </Page>
  );
}

export function JoinRoom() {
  const { go, act } = useStore();
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '');
  const [busy, setBusy] = useState(false);
  const join = async () => {
    if (code.length < 5) return;
    setBusy(true); sfx.submit();
    await act('room:join', { code });
    setBusy(false);
  };
  return (
    <Page k="join">
      <BackButton onClick={() => go('menu')} />
      <div className="center">
        <section className="glass panel stack" style={{ width: 'min(460px, 100%)' }}>
          <h2 className="h1" style={{ textAlign: 'center' }}>Join Room</h2>
          <p className="lead" style={{ alignSelf: 'center' }}>Enter the 5-character code your friend shared.</p>
          <input className="input input--code" aria-label="Room code" autoFocus maxLength={5} value={code} placeholder="•••••"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && join()} />
          <button className="btn btn--block" onClick={join} disabled={busy || code.length < 5}>{busy ? 'Connecting…' : 'Join'}</button>
        </section>
      </div>
    </Page>
  );
}

export function QuickMatch() {
  const { go, act, room } = useStore();
  const [secs, setSecs] = useState(0);
  useEffect(() => { const t = setInterval(() => setSecs((s) => s + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (room) go('menu'); }, [room, go]);
  const cancel = async () => { sfx.click(); await act('room:quickCancel'); go('menu'); };
  return (
    <Page k="quick">
      <div className="center">
        <div className="pulse-ring"><span style={{ fontFamily: 'var(--display)', fontSize: 22 }}>{String(Math.floor(secs / 60)).padStart(2, '0')}:{String(secs % 60).padStart(2, '0')}</span></div>
        <h2 className="h1">Searching for an opponent<span className="dots" /></h2>
        <p className="lead">You'll be paired with the next player who taps Play Online. Open the game in a second browser to try it yourself.</p>
        <button className="btn btn--ghost" onClick={cancel}>Cancel</button>
      </div>
    </Page>
  );
}
