import { useStore } from '../lib/store';
import { BackButton, Page, Pips } from '../components/ui';
import { Code } from '../components/Code';

const EXAMPLES: [string, number, string][] = [
  ['298', 1, 'Only the 2 is in the right place'],
  ['491', 0, 'No digit sits in its exact position'],
  ['223', 2, 'The first 2 and the 3 are in place'],
  ['263', 3, 'Code cracked — you win'],
];

export function HowTo() {
  const { go } = useStore();
  return (
    <Page k="howto">
      <BackButton onClick={() => go('menu')} />
      <div className="stack" style={{ marginTop: 14, gap: 18 }}>
        <h2 className="h1">How to Play</h2>
        <div className="steps">
          <div className="step"><div className="step__n">01 · ENCODE</div><h3>Pick a secret code</h3><p>Each player locks in a 3-digit number. Repeats (777) and leading zeros (027) are allowed. Your code stays on your screen; your opponent never sees it.</p></div>
          <div className="step"><div className="step__n">02 · PROBE</div><h3>Take turns guessing</h3><p>One guess per turn, with a countdown (45 s by default). If the timer runs out, your turn is skipped.</p></div>
          <div className="step"><div className="step__n">03 · DEDUCE</div><h3>Read the signal</h3><p>The server tells you how many digits are correct <b>in their exact position</b>. It never says which ones, so you have to work that out.</p></div>
          <div className="step"><div className="step__n">04 · REVEAL</div><h3>Crack it first</h3><p>The first player to hit 3/3 wins. Both codes are revealed at the end.</p></div>
        </div>
        <section className="glass panel">
          <div className="panel-title">Example <i>Opponent's secret: 263</i></div>
          <div className="row" style={{ justifyContent: 'center', marginBottom: 16 }}><Code value="263" size="sm" /></div>
          <div className="example">
            {EXAMPLES.map(([g, n, why]) => (
              <div className="example__row" key={g}>
                <Code value={g} size="xs" hits={g.split('').map((d, i) => d === '263'[i])} />
                <span className="muted">{why}</span>
                <span className="score"><Pips n={n} /> {n}/3</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Page>
  );
}
