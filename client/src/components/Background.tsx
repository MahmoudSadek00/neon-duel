import { memo } from 'react';

const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 47) % 100,
  delay: -((i * 1.7) % 16),
  dur: 12 + ((i * 3) % 10),
  size: 2 + (i % 3),
}));
const DIGITS = Array.from({ length: 14 }, (_, i) => ({
  d: (i * 7) % 10,
  left: (i * 61) % 96,
  top: (i * 37) % 44 + 4,
  delay: -(i * 1.3),
}));

/** Pure-CSS animated backdrop: perspective grid floor (2.5D), glow orbs, rising particles, drifting digits. */
export const Background = memo(function Background() {
  return (
    <div className="bg" aria-hidden>
      <div className="bg__orb bg__orb--a" />
      <div className="bg__orb bg__orb--b" />
      <div className="bg__digits">
        {DIGITS.map((x, i) => (
          <span key={i} style={{ left: `${x.left}%`, top: `${x.top}%`, animationDelay: `${x.delay}s` }}>{x.d}</span>
        ))}
      </div>
      <div className="bg__horizon" />
      <div className="bg__floor" />
      {PARTICLES.map((p, i) => (
        <i key={i} className="bg__p" style={{ left: `${p.left}%`, width: p.size, height: p.size, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }} />
      ))}
    </div>
  );
});
