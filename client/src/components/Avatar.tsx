import type { CSSProperties } from 'react';
import type { AvatarId } from '../../../shared/rules';

const COLORS: Record<AvatarId, [string, string]> = {
  prism: ['#22e6ff', '#3d7bff'],
  orbit: ['#8b5cff', '#3d7bff'],
  pulse: ['#e04dff', '#8b5cff'],
  cipher: ['#36f5b4', '#22a6ff'],
  nova: ['#ffc04d', '#ff5c8a'],
  helix: ['#22e6ff', '#8b5cff'],
  echo: ['#ff5c8a', '#8b5cff'],
  quark: ['#7cf5ff', '#36f5b4'],
};

const S = { fill: 'none', stroke: '#fff', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const GLYPHS: Record<AvatarId, JSX.Element> = {
  prism: <><path {...S} d="M12 3 21 19H3Z" /><path {...S} d="M12 3v16" opacity=".6" /></>,
  orbit: <><circle {...S} cx="12" cy="12" r="3" /><ellipse {...S} cx="12" cy="12" rx="9.5" ry="4" transform="rotate(-25 12 12)" opacity=".8" /></>,
  pulse: <path {...S} d="M2 12h4l2-6 4 12 3-9 2 3h5" />,
  cipher: <><rect {...S} x="4" y="4" width="16" height="16" rx="3" /><path {...S} d="M8 9h3M13 9h3M8 15h8M8 12h5" opacity=".85" /></>,
  nova: <path {...S} d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5 19 19M19 5l-3.5 3.5M8.5 15.5 5 19" />,
  helix: <><path {...S} d="M7 3c0 6 10 6 10 12s-10 6-10 6" /><path {...S} d="M17 3c0 6-10 6-10 12" opacity=".6" /></>,
  echo: <><circle {...S} cx="12" cy="12" r="2.5" /><path {...S} d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8" opacity=".75" /></>,
  quark: <><circle {...S} cx="12" cy="7" r="3" /><circle {...S} cx="7" cy="16" r="3" /><circle {...S} cx="17" cy="16" r="3" /></>,
};

export function Avatar({ id, size = 44, active = false }: { id: AvatarId; size?: number; active?: boolean }) {
  const [a1, a2] = COLORS[id] ?? COLORS.prism;
  return (
    <span className={`avatar${active ? ' is-active' : ''}`} style={{ width: size, height: size, '--a1': a1, '--a2': a2 } as CSSProperties}>
      <svg viewBox="0 0 24 24" aria-hidden>{GLYPHS[id] ?? GLYPHS.prism}</svg>
    </span>
  );
}
