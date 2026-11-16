import { motion } from 'framer-motion';
import { useStore } from '../lib/store';
import { sfx } from '../lib/audio';
import { Avatar } from '../components/Avatar';
import { Icon, Page } from '../components/ui';
import type { PublicPlayer } from '../../../shared/types';

function Seat({ p, you }: { p: PublicPlayer | null; you?: boolean }) {
  if (!p) {
    return (
      <div className="glass seat seat--empty">
        <div className="pulse-ring" style={{ width: 64, height: 64 }}>?</div>
        <div className="seat__name">Waiting for opponent<span className="dots" /></div>
      </div>
    );
  }
  return (
    <motion.div className="glass seat" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
      <Avatar id={p.avatar} size={64} active={p.ready} />
      <div>
        <div className="seat__name">{p.name}{you && <span className="muted"> (you)</span>}</div>
        <div className="row" style={{ justifyContent: 'center', marginTop: 6, gap: 6 }}>
          {!p.connected ? <span className="badge badge--warn">Reconnecting</span>
            : p.ready ? <span className="badge badge--good">Ready</span>
            : <span className="badge">Not ready</span>}
        </div>
      </div>
    </motion.div>
  );
}

export function Lobby() {
  const { room, act, toast } = useStore();
  if (!room) return null;
  const link = `${location.origin}/?room=${room.code}`;
  const copy = async () => {
    sfx.click();
    try { await navigator.clipboard.writeText(link); toast('Invite link copied', 'good'); }
    catch { toast(`Room code: ${room.code}`); }
  };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: 'NEON DUEL', text: `Join my NEON DUEL room: ${room.code}`, url: link }); } catch { /* cancelled */ } }
    else copy();
  };

  return (
    <Page k="lobby">
      <div className="center">
        <div className="stack" style={{ alignItems: 'center', gap: 8 }}>
          <span className="badge badge--live">Private room · {room.turnSeconds}s turns</span>
          <div className="room-code" aria-label={`Room code ${room.code.split('').join(' ')}`}>{room.code}</div>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn btn--ghost btn--small" onClick={copy}>{Icon.copy} Copy link</button>
            <button className="btn btn--ghost btn--small" onClick={share}>Share</button>
          </div>
        </div>
        <div className="vs-row">
          <Seat p={room.you} you />
          <div className="vs">VS</div>
          <Seat p={room.opponent} />
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn btn--ghost" onClick={() => { sfx.click(); act('room:leave'); }}>Leave</button>
          <button className={`btn${room.you.ready ? ' btn--good' : ''}`} style={{ minWidth: 200 }}
            onClick={() => { sfx.lock(); act('room:ready', { ready: !room.you.ready }); }}>
            {room.you.ready ? '✓ Ready' : "I'm Ready"}
          </button>
        </div>
        <p className="muted">{!room.opponent ? 'Share the code. The room holds exactly two players.'
          : room.you.ready && !room.opponent.ready ? `Waiting for ${room.opponent.name} to get ready…`
          : 'The duel begins as soon as both players are ready.'}</p>
      </div>
    </Page>
  );
}
