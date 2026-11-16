import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useStore } from './lib/store';
import { sfx } from './lib/audio';
import { Background } from './components/Background';
import { Avatar } from './components/Avatar';
import { Icon, Toasts } from './components/ui';
import { Menu } from './screens/Menu';
import { ProfileScreen } from './screens/Profile';
import { HowTo } from './screens/HowTo';
import { SettingsScreen } from './screens/SettingsScreen';
import { CreateRoom, JoinRoom, QuickMatch } from './screens/RoomEntry';
import { Lobby } from './screens/Lobby';
import { Secret } from './screens/Secret';
import { Game } from './screens/Game';
import { Result } from './screens/Result';

export default function App() {
  const { screen, room, connected, profile, settings, setSettings, go } = useStore();

  // deep link: /?room=CODE opens the join screen pre-filled
  useEffect(() => {
    if (new URLSearchParams(location.search).get('room')) go('join');
  }, [go]);

  let view: JSX.Element;
  if (room) {
    if (room.phase === 'lobby') view = <Lobby key="lobby" />;
    else if (room.phase === 'secret') view = <Secret key={`secret-${room.round}`} />;
    else view = <Game key={`game-${room.round}`} />;
  } else {
    view = {
      menu: <Menu key="menu" />, profile: <ProfileScreen key="profile" />, howto: <HowTo key="howto" />,
      settings: <SettingsScreen key="settings" />, create: <CreateRoom key="create" />, join: <JoinRoom key="join" />, quick: <QuickMatch key="quick" />,
    }[screen];
  }

  return (
    <>
      <Background />
      <div className="app">
        <header className="topbar">
          <div className="topbar__brand">
            <span className={`status-dot${connected ? ' on' : ''}`} title={connected ? 'Connected' : 'Offline — reconnecting'} />
            <b>NEON</b> DUEL
          </div>
          <div className="topbar__right">
            {!connected && <span>Reconnecting…</span>}
            <button className="icon-btn" aria-label={settings.muted ? 'Unmute' : 'Mute'} onClick={() => { setSettings({ ...settings, muted: !settings.muted }); sfx.click(); }}>
              {settings.muted ? Icon.mute : Icon.sound}
            </button>
            {profile && !room && (
              <button className="icon-btn" style={{ width: 'auto', padding: 3, borderRadius: 99 }} aria-label="Profile" onClick={() => go('profile')}>
                <Avatar id={profile.avatar} size={32} />
              </button>
            )}
          </div>
        </header>
        <AnimatePresence mode="wait">{view}</AnimatePresence>
      </div>
      {room?.phase === 'finished' && <Result />}
      <Toasts />
    </>
  );
}
