import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../lib/store';
import { sfx } from '../lib/audio';
import { Avatar } from '../components/Avatar';
import { Code } from '../components/Code';

function Confetti() {
  const bits = useMemo(() => Array.from({ length: 46 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.8, dur: 2.4 + Math.random() * 2,
    dx: `${(Math.random() - 0.5) * 200}px`, r: `${Math.random() * 720}deg`,
    c: ['#22e6ff', '#8b5cff', '#36f5b4', '#e04dff', '#ffffff'][i % 5],
  })), []);
  return (
    <div className="confetti" aria-hidden>
      {bits.map((b, i) => (
        <i key={i} style={{ left: `${b.left}%`, background: b.c, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s`, ['--dx' as string]: b.dx, ['--r' as string]: b.r }} />
      ))}
    </div>
  );
}

export function Result() {
  const { room, act, reducedMotion } = useStore();
  const won = room?.result?.winnerId === room?.you.id;
  useEffect(() => { if (room?.result) (won ? sfx.victory : sfx.defeat)(); }, [room?.result, won]);
  if (!room || !room.result) return null;
  const { result, you, opponent } = room;
  const reason = result.reason === 'solved' ? (won ? 'You cracked the code' : `${opponent?.name ?? 'Opponent'} cracked your code`)
    : won ? `${opponent?.name ?? 'Your opponent'} left the match` : 'You left the match';

  const card = (id: string, name: string, avatar: typeof you.avatar, label: string) => (
    <div className={`reveal__card${result.winnerId === id ? ' winner' : ''}`}>
      <div className="row"><Avatar id={avatar} size={32} /><b>{name}</b></div>
      <div className="muted">{label}</div>
      {result.secrets[id] ? <Code value={result.secrets[id]} size="sm" hits={result.winnerId !== id ? [true, true, true] : undefined} scanKey="reveal" /> : <span className="muted">Not chosen</span>}
      <div className="stat-line" style={{ width: '100%' }}>Attempts <b>{result.attempts[id] ?? 0}</b></div>
    </div>
  );

  return (
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {won && !reducedMotion && <Confetti />}
      <motion.section className="glass result" style={{ overflow: 'hidden' }} initial={{ y: 30, scale: 0.94, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22, delay: 0.1 }}>
        {won && <div className="rays" />}
        <span className="badge badge--live">Match complete · Round {room.round}</span>
        <div className={`result__title ${won ? 'win' : 'lose'}`}>{won ? 'VICTORY' : 'DEFEAT'}</div>
        <p className="lead">{reason}{result.reason === 'solved' && ` in ${result.attempts[result.winnerId!]} ${result.attempts[result.winnerId!] === 1 ? 'guess' : 'guesses'}`}.</p>
        <div className="reveal">
          {card(you.id, `${you.name} (you)`, you.avatar, 'Your secret')}
          {opponent && card(opponent.id, opponent.name, opponent.avatar, 'Their secret')}
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn btn--ghost" onClick={() => { sfx.click(); act('room:leave'); }}>Return to Lobby</button>
          {opponent && (
            <button className="btn" disabled={you.wantsRematch} onClick={() => { sfx.lock(); act('rematch:vote'); }}>
              {you.wantsRematch ? 'Waiting for opponent…' : opponent.wantsRematch ? 'Accept Rematch' : 'Play Again'}
            </button>
          )}
        </div>
        {opponent?.wantsRematch && !you.wantsRematch && <span className="badge badge--good">{opponent.name} wants a rematch</span>}
        {!opponent && <span className="muted">Your opponent has left the room.</span>}
      </motion.section>
    </motion.div>
  );
}
