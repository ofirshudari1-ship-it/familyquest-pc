import { useEffect, useMemo } from 'react';
import LockHome from './screens/LockHome';
import Hud from './screens/Hud';
import ParentDashboard from './screens/ParentDashboard';
import { setSoundEnabled } from './sound';

function resolveView(): 'home' | 'hud' | 'dashboard' {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'hud') return 'hud';
  if (hash === 'dashboard') return 'dashboard';
  return 'home';
}

export default function App() {
  const view = useMemo(resolveView, []);

  useEffect(() => {
    window.familyquest.getSettings().then((s) => setSoundEnabled(s.soundEffectsEnabled));
  }, []);

  if (view === 'hud') return <Hud />;
  if (view === 'dashboard') return <ParentDashboard />;
  return <LockHome />;
}
