import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../lib/store';
import { sfx } from '../lib/audio';
import { socket } from '../lib/net';
import { Avatar } from '../components/Avatar';
import { Code } from '../components/Code';
import { Keypad } from '../components/Keypad';
import { Icon, Page, Pips } from '../components/ui';
import type { GuessEntry, PublicPlayer } from '../../../shared/types';

const LABELS = ['No correct digits', 'One digit in place', 'Two digits in place', 'Code cracked'];

function useRemaining(endsAt: number | null, offset: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endsAt]);
  return endsAt ? Math.max(0, Math.ceil((endsAt - (now + offset)) / 1000)) : 0;
}

function Timer({ left, total }: { left: number; total: number }) {
  const C = 2 * Math.PI * 32;
  const frac = total ? left / total : 0;
  return (
    <div className={`timer${left <= 10 ? ' low' : ''}`} role="timer" aria-label={`${left} seconds left`}>
      <svg viewBox="0 0 74 74">
        <defs><linearGradient id="tg" x1="0" x2="1"><stop offset="0" stopColor="#22e6ff" /><stop offset="1" stopColor="#8b5cff" /></linearGradient></defs>
        <circle cx="37" cy="37" r="32" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5" />
        <circle cx="37" cy="37" r="32" fill="none" stroke={left <= 10 ? '#ff5c8a' : 'url(#tg)'} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: 'stroke-dashoffset .25s linear' }} />
      </svg>
      <div className="timer__n">{left}</div>
    </div>
  );
}

function Duelist({ p, turn, right }: { p: PublicPlayer; turn: boolean; right?: boolean; label?: string }) {
  return (
    <div className={`duelist${right ? ' duelist--right' : ''}${turn ? ' is-turn' : ''}`}>
      <Avatar id={p.avatar} size={42} active={turn} />
      <div className="duelist__meta">
        <div className="duelist__name">{p.name}</div>
        <div className="duelist__sub">{p.attempts} {p.attempts === 1 ? 'guess' : 'guesses'}{!p.connected && ' · offline'}</div>
      </div>
    </div>
  );
}

function History({ entries }: { entries: GuessEntry[] }) {
  const real = entries.filter((e) => e.guess !== null).length;
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [entries.length]);
  return (
    <section className="glass history" aria-label="Your guess history">
      <div className="panel-title">Your Guess History <i>{real} {real === 1 ? 'attempt' : 'attempts'}</i></div>
      <div className="history__list" ref={listRef}>
        {!entries.length && <div className="empty">Your guesses and their results will appear here.</div>}
        <AnimatePresence initial={false}>
          {entries.map((e, i) => (
            <motion.div key={e.at} className={`h-item${i === entries.length - 1 ? ' latest' : ''}`}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
              <span className="h-item__n">#{e.attempt}</span>
              {e.guess ? <span className="h-item__g">{e.guess}</span> : <span className="h-item__g timeout">Timed out — turn skipped</span>}
              {e.guess ? <span className="score"><Pips n={e.correct} /> {e.correct}/3</span> : <span />}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

export function Game() {
  const { room, act, lastGuess, clockOffset, reducedMotion } = useStore();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'play' | 'history'>('play');
  const [flash, setFlash] = useState<GuessEntry | null>(null);
  const [scan, setScan] = useState(0);
  const lastTurn = useRef<number>(0);
  const left = useRemaining(room?.turnEndsAt ?? null, clockOffset);
  const myTurn = !!room && room.turnPlayerId === room.you.id;

  // feedback popup for my latest guess
  useEffect(() => {
    if (!lastGuess || !lastGuess.guess) return;
    setFlash(lastGuess);
    setScan((s) => s + 1);
    sfx.feedback(lastGuess.correct);
    const t = setTimeout(() => setFlash(null), 1700);
    return () => clearTimeout(t);
  }, [lastGuess]);

  // turn change cue
  useEffect(() => {
    if (!room) return;
    if (room.turnId !== lastTurn.current) {
      if (lastTurn.current !== 0 && myTurn) sfx.turn();
      lastTurn.current = room.turnId;
      setValue('');
    }
  }, [room, myTurn]);

  // countdown ticks during my last 5 seconds
  useEffect(() => { if (myTurn && left > 0 && left <= 5) sfx.tick(); }, [left, myTurn]);

  // a soft cue when the opponent guesses
  useEffect(() => {
    const on = () => sfx.click();
    socket.on('opponent:guessed', on);
    return () => { socket.off('opponent:guessed', on); };
  }, []);

  if (!room || !room.opponent) return null;
  const opp = room.opponent;

  const submit = async () => {
    if (!myTurn || value.length !== 3 || busy) return;
    setBusy(true);
    sfx.submit();
    const res = await act('guess:submit', { guess: value, turnId: room.turnId });
    if (res) setValue('');
    setBusy(false);
  };

  return (
    <Page k="game">
      <div className="tabs" role="tablist">
        <button aria-pressed={tab === 'play'} onClick={() => setTab('play')}>Play</button>
        <button aria-pressed={tab === 'history'} onClick={() => setTab('history')}>History ({room.you.attempts})</button>
      </div>

      <div className="game" data-tab={tab}>
        <div className="game__col game__col--main">
          <section className="glass secret-box">
            <div className="panel-title">YOUR SECRET NUMBER <i>{Icon.lock}</i></div>
            <Code value={room.yourSecret ?? ''} size="sm" />
            <span className="muted">Only you can see this.</span>
          </section>
          <section className="glass opp-box">
            <div className="panel-title" style={{ marginBottom: 0 }}>Opponent <i>{opp.connected ? 'online' : 'reconnecting'}</i></div>
            <div className="row"><Avatar id={opp.avatar} size={38} /><b>{opp.name}</b></div>
            <div className="locked-code" aria-label="Opponent's hidden number"><span>?</span><span>?</span><span>?</span></div>
            <div className="stat-line">Attempts <b>{opp.attempts}</b></div>
            <div className="stat-line">Their best signal <span className="meter">{[0, 1, 2].map((i) => <i key={i} className={i < opp.bestResult ? 'on' : ''} />)}</span></div>
            <div className="stat-line">Last result <b>{opp.lastResult === null ? '—' : `${opp.lastResult}/3`}</b></div>
          </section>
        </div>

        <section className="glass game__stage">
          <div className="duelists">
            <Duelist p={room.you} turn={myTurn} label="You" />
            <Timer left={left} total={room.turnSeconds} />
            <Duelist p={opp} turn={!myTurn} right label="Opponent" />
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={room.turnId} className={`turn-banner ${myTurn ? 'mine' : 'theirs'}`}
              initial={reducedMotion ? false : { opacity: 0, y: 10, letterSpacing: '0.5em' }} animate={{ opacity: 1, y: 0, letterSpacing: '0.22em' }} exit={{ opacity: 0, y: -10 }}>
              {myTurn ? 'Your turn' : `${opp.name}'s turn`}
              <div className="turn-sub">{myTurn ? 'Enter 3 digits to probe their code' : 'Waiting for their guess…'}</div>
            </motion.div>
          </AnimatePresence>
          <div className="mobile-secret"><span>YOUR SECRET</span><Code value={room.yourSecret ?? ''} size="xs" /></div>

          <Code value={myTurn ? value : ''} active={myTurn && value.length < 3 ? value.length : -1} scanKey={scan || undefined} />
          <Keypad value={value} onChange={setValue} onSubmit={submit} disabled={!myTurn || busy} submitLabel="GUESS" goKey={false} />
          <button className="btn" style={{ width: 'min(330px, 100%)' }} disabled={!myTurn || value.length !== 3 || busy} onClick={submit}>
            {busy ? 'Scanning…' : 'Submit Guess'}
          </button>
          <div className="row" style={{ justifyContent: 'space-between', width: 'min(330px, 100%)' }}>
            <span className="muted">Attempts: <b style={{ color: 'var(--ink)' }}>{room.you.attempts}</b></span>
            <button className="btn btn--ghost btn--small" onClick={() => { if (confirm('Leave the match? Your opponent will win.')) act('room:leave'); }}>Leave</button>
          </div>
        </section>

        <div className="game__col game__col--side">
          <History entries={room.yourGuesses} />
        </div>
      </div>

      <AnimatePresence>
        {flash && (
          <motion.div className="feedback" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="feedback__card" initial={{ scale: 0.7, rotateX: 40 }} animate={{ scale: 1, rotateX: 0 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}>
              <Code value={flash.guess!} size="sm" hits={undefined} />
              <div className={`feedback__big fb-${flash.correct}`} style={{ marginTop: 14 }}>{flash.correct}/3</div>
              <div className="feedback__label">{LABELS[flash.correct]}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  );
}
