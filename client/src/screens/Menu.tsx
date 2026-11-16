import { motion } from 'framer-motion';
import { useStore, type Screen } from '../lib/store';
import { sfx } from '../lib/audio';
import { Avatar } from '../components/Avatar';
import { Icon, Logo, Page } from '../components/ui';

export function Menu() {
  const { go, profile, act, reducedMotion } = useStore();
  const nav = (s: Screen) => () => { sfx.click(); go(s); };
  const quick = async () => {
    sfx.click();
    go('quick');
    const r = await act<'waiting' | 'matched'>('room:quick');
    if (!r) go('menu');
  };
  const item = (i: number) => (reducedMotion ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.15 + i * 0.06 } });

  return (
    <Page k="menu">
      <div className="center">
        <Logo />
        <motion.div className="menu" {...item(0)}>
          <div className="menu__main">
            <motion.button {...item(1)} className="glass menu-card menu-card--hero" onClick={quick}>
              <span className="menu-card__ico">{Icon.bolt}</span>
              <span className="menu-card__k">Play Online</span>
              <span className="menu-card__d">Quick Match — get paired with the next available player.</span>
            </motion.button>
            <motion.button {...item(2)} className="glass menu-card" onClick={nav('create')}>
              <span className="menu-card__ico">{Icon.plus}</span>
              <span className="menu-card__k">Create Room</span>
              <span className="menu-card__d">Private duel with a code.</span>
            </motion.button>
            <motion.button {...item(3)} className="glass menu-card" onClick={nav('join')}>
              <span className="menu-card__ico">{Icon.enter}</span>
              <span className="menu-card__k">Join Room</span>
              <span className="menu-card__d">Enter a friend's code.</span>
            </motion.button>
          </div>
          <motion.div className="menu__foot" {...item(4)}>
            <button className="glass foot-btn" onClick={nav('howto')}>{Icon.help}How to Play</button>
            <button className="glass foot-btn" onClick={nav('settings')}>{Icon.gear}Settings</button>
            <button className="glass foot-btn" onClick={nav('profile')}>{Icon.user}Profile</button>
          </motion.div>
          {profile && (
            <motion.button {...item(5)} className="glass player-chip" style={{ justifySelf: 'center' }} onClick={nav('profile')}>
              <Avatar id={profile.avatar} size={32} />
              <span className="muted">Playing as</span> <b>{profile.name}</b>
            </motion.button>
          )}
        </motion.div>
      </div>
    </Page>
  );
}
