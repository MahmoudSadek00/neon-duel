import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import App from './App';
import { StoreProvider, useStore } from './lib/store';
import '@fontsource/orbitron/latin-500.css';
import '@fontsource/orbitron/latin-700.css';
import '@fontsource/orbitron/latin-900.css';
import '@fontsource/sora/latin-400.css';
import '@fontsource/sora/latin-600.css';
import './styles.css';

function Motion({ children }: { children: React.ReactNode }) {
  const { reducedMotion } = useStore();
  return <MotionConfig reducedMotion={reducedMotion ? 'always' : 'never'}>{children}</MotionConfig>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <Motion>
        <App />
      </Motion>
    </StoreProvider>
  </StrictMode>,
);
