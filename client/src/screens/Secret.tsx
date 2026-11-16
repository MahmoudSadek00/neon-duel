import { useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../lib/store';
import { sfx } from '../lib/audio';
import { Avatar } from '../components/Avatar';
import { Code } from '../components/Code';
import { Keypad } from '../components/Keypad';
import { Icon, Page } from '../components/ui';

export function Secret() {
  const { room, act } = useStore();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  if (!room) return null;
  const locked = room.yourSecret;
  const opp = room.opponent;

  const lock = async () => {
    if (value.length !== 3 || busy) return;
    setBusy(true);
    sfx.submit();
    const ok = await act('secret:set', { secret: value });
    if (ok) sfx.lock();
    setBusy(false);
  };

  return (
    <Page k="secret">
      <div className="center" style={{ gap: 18 }}>
        <div className="stack" style={{ alignItems: 'center', gap: 6 }}>
          <span className="badge badge--live">Round {room.round} · Encode</span>
          <h2 className="h1" style={{ textAlign: 'center' }}>{locked ? 'Secret locked' : 'Choose your secret number'}</h2>
          <p className="lead">{locked ? 'Your code is stored on the server. It stays visible to you for the whole match.' : 'Three digits, 0–9. Repeats and a leading zero are allowed.'}</p>
        </div>

        {locked ? (
          <motion.div className="glass secret-box" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ padding: 26 }}>
            <div className="panel-title">YOUR SECRET NUMBER <i>{Icon.lock}</i></div>
            <Code value={locked} hits={[true, true, true]} scanKey="locked" />
          </motion.div>
        ) : (
          <>
            <Code value={value} active={value.length < 3 ? value.length : -1} />
            <Keypad value={value} onChange={setValue} onSubmit={lock} disabled={busy} submitLabel="LOCK" />
          </>
        )}

        {opp && (
          <div className="glass player-chip" style={{ padding: '8px 16px 8px 8px' }}>
            <Avatar id={opp.avatar} size={34} />
            <b>{opp.name}</b>
            {opp.secretLocked ? <span className="badge badge--good">Locked in</span> : <span className="badge">Choosing<span className="dots" /></span>}
          </div>
        )}
        <button className="btn btn--ghost btn--small" onClick={() => { if (confirm('Leave this match? Your opponent will win.')) act('room:leave'); }}>Leave match</button>
      </div>
    </Page>
  );
}
