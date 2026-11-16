import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { sfx } from '../lib/audio';
import { Avatar } from '../components/Avatar';
import { BackButton, Page } from '../components/ui';
import { AVATARS, type AvatarId } from '../../../shared/rules';

function timeAgo(t: number) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export function ProfileScreen() {
  const { profile, saveProfile, go, toast, refreshProfile } = useStore();
  const [name, setName] = useState(profile?.name === 'Player' ? '' : profile?.name ?? '');
  const [avatar, setAvatar] = useState<AvatarId>(profile?.avatar ?? 'prism');
  const [saving, setSaving] = useState(false);

  useEffect(() => { refreshProfile(); }, [refreshProfile]);

  const save = async () => {
    setSaving(true);
    try {
      await saveProfile(name.trim() || 'Player', avatar);
      sfx.lock();
      toast('Profile saved', 'good');
    } catch (e) { toast((e as Error).message, 'error'); }
    setSaving(false);
  };

  const s = profile?.stats ?? { played: 0, wins: 0, losses: 0, guesses: 0 };
  const rate = s.played ? Math.round((s.wins / s.played) * 100) : 0;
  const avg = s.played ? (s.guesses / s.played).toFixed(1) : '—';
  const C = 2 * Math.PI * 60;

  return (
    <Page k="profile">
      <BackButton onClick={() => go('menu')} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, marginTop: 14 }}>
        <section className="glass panel stack">
          <div className="panel-title">Player Setup <i>Identity</i></div>
          <div className="row" style={{ gap: 16 }}>
            <Avatar id={avatar} size={72} active />
            <div className="field" style={{ flex: 1, minWidth: 180 }}>
              <label htmlFor="name">Display name</label>
              <input id="name" className="input" maxLength={16} placeholder="Choose a name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
            </div>
          </div>
          <div className="field">
            <label>Avatar</label>
            <div className="avatar-grid">
              {AVATARS.map((a) => (
                <button key={a} className="avatar-opt" aria-pressed={a === avatar} onClick={() => { sfx.click(); setAvatar(a); }}>
                  <Avatar id={a} size={44} />
                  <span>{a}</span>
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn--block" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</button>
        </section>

        <section className="glass panel stack">
          <div className="panel-title">Statistics <i>All time</i></div>
          <div className="row" style={{ gap: 22, justifyContent: 'center' }}>
            <div className="ring">
              <svg width="140" height="140" viewBox="0 0 140 140">
                <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22e6ff" /><stop offset="1" stopColor="#8b5cff" /></linearGradient></defs>
                <circle cx="70" cy="70" r="60" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10" />
                <circle cx="70" cy="70" r="60" fill="none" stroke="url(#rg)" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - rate / 100)} style={{ transition: 'stroke-dashoffset 1s ease' }} />
              </svg>
              <div className="ring__n"><div><b>{rate}%</b><span>WIN RATE</span></div></div>
            </div>
          </div>
          <div className="stats-grid">
            <div className="stat"><b>{s.played}</b><span>Matches</span></div>
            <div className="stat"><b style={{ color: 'var(--mint)' }}>{s.wins}</b><span>Wins</span></div>
            <div className="stat"><b style={{ color: 'var(--rose)' }}>{s.losses}</b><span>Losses</span></div>
            <div className="stat"><b>{s.guesses}</b><span>Total guesses</span></div>
            <div className="stat"><b>{avg}</b><span>Avg / match</span></div>
          </div>
          <div className="panel-title" style={{ marginTop: 8, marginBottom: 0 }}>Recent Matches</div>
          <div className="recent">
            {!profile?.recent.length && <div className="empty">No matches yet — your duels will appear here.</div>}
            {profile?.recent.map((m, i) => (
              <div key={i} className="recent__item">
                <Avatar id={m.opponentAvatar} size={30} />
                <div className="grow">
                  <div>vs <b>{m.opponent}</b></div>
                  <div className="muted">{m.attempts} guesses · {m.reason === 'solved' ? 'code cracked' : 'opponent left'} · {timeAgo(m.at)}</div>
                </div>
                <span className={m.won ? 'w' : 'l'}>{m.won ? 'WIN' : 'LOSS'}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Page>
  );
}
