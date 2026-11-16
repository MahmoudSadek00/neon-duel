import { AnimatePresence, motion } from 'framer-motion';

interface Props {
  value: string;            // up to 3 chars
  active?: number;          // index of caret, -1 for none
  size?: 'lg' | 'sm' | 'xs';
  hits?: boolean[];         // highlight cells as correct
  scanKey?: number | string; // change to replay the scanning sweep
  masked?: boolean;
}

/** Holographic 3-cell number display used for input, secrets, history and reveals. */
export function Code({ value, active = -1, size = 'lg', hits, scanKey, masked }: Props) {
  return (
    <div className={`code${size !== 'lg' ? ` code--${size}` : ''}`} aria-label={masked ? 'hidden number' : `number ${value.split('').join(' ')}`}>
      {[0, 1, 2].map((i) => {
        const ch = value[i];
        const cls = ['cell', i === active && 'cell--active', ch && 'cell--filled', hits?.[i] && 'cell--hit'].filter(Boolean).join(' ');
        return (
          <div key={i} className={cls}>
            <AnimatePresence mode="popLayout" initial={false}>
              {ch !== undefined && (
                <motion.span
                  key={`${ch}-${i}-${masked}`}
                  className="cell__d"
                  initial={{ y: 26, opacity: 0, rotateX: -70, filter: 'blur(4px)' }}
                  animate={{ y: 0, opacity: 1, rotateX: 0, filter: 'blur(0px)' }}
                  exit={{ y: -22, opacity: 0, rotateX: 70 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                >
                  {masked ? '•' : ch}
                </motion.span>
              )}
            </AnimatePresence>
            {scanKey !== undefined && <span key={`${scanKey}`} className="cell__scan" style={{ animationDelay: `${i * 0.12}s` }} />}
          </div>
        );
      })}
    </div>
  );
}
