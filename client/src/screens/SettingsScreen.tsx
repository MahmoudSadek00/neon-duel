import { useStore, type Settings } from '../lib/store';
import { sfx } from '../lib/audio';
import { BackButton, Page } from '../components/ui';

export function SettingsScreen() {
  const { go, settings, setSettings } = useStore();
  const set = (patch: Partial<Settings>) => setSettings({ ...settings, ...patch });

  const Slider = ({ k, label }: { k: 'master' | 'sfx' | 'music'; label: string }) => (
    <div className="slider">
      <label htmlFor={k}>{label}</label>
      <input id={k} type="range" min={0} max={1} step={0.05} value={settings[k]}
        onChange={(e) => set({ [k]: Number(e.target.value) })} onPointerUp={() => k !== 'music' && sfx.digit(5)} />
      <output>{Math.round(settings[k] * 100)}</output>
    </div>
  );

  return (
    <Page k="settings">
      <BackButton onClick={() => go('menu')} />
      <section className="glass panel stack" style={{ marginTop: 14, maxWidth: 620, width: '100%', alignSelf: 'center' }}>
        <div className="panel-title">Audio <i>Synthesised, no downloads</i></div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span>Mute all sound</span>
          <button className="switch" role="switch" aria-checked={settings.muted} aria-label="Mute all sound" onClick={() => set({ muted: !settings.muted })} />
        </div>
        <Slider k="master" label="Master" />
        <Slider k="sfx" label="Effects" />
        <Slider k="music" label="Music" />
        <div className="panel-title" style={{ marginTop: 10 }}>Motion</div>
        <div className="seg" role="group" aria-label="Animation level">
          {(['system', 'full', 'reduced'] as const).map((m) => (
            <button key={m} aria-pressed={settings.motion === m} onClick={() => { sfx.click(); set({ motion: m }); }}>
              {m === 'system' ? 'Auto' : m === 'full' ? 'Full' : 'Reduced'}
            </button>
          ))}
        </div>
        <p className="muted">Auto follows your device's “reduce motion” setting. Reduced turns off particles and most animation, which also saves battery.</p>
      </section>
    </Page>
  );
}
