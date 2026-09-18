let enabled = true;

export function setSoundEnabled(value: boolean) {
  enabled = value;
}

const cache = new Map<string, HTMLAudioElement>();

function play(name: 'coin' | 'approve') {
  if (!enabled) return;
  let audio = cache.get(name);
  if (!audio) {
    audio = new Audio(`./sounds/${name}.wav`);
    cache.set(name, audio);
  } else {
    audio.currentTime = 0;
  }
  audio.volume = 0.5;
  audio.play().catch(() => {
    /* autoplay can be blocked before any user gesture — not worth surfacing */
  });
}

export const playCoin = () => play('coin');
export const playApprove = () => play('approve');
