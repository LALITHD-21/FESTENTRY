function getSpeechSynthesis() {
  if (typeof window === 'undefined') return null;
  return window.speechSynthesis || null;
}

let sharedAudioContext = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioContextClass();
  }

  const ctx = sharedAudioContext;
  if (ctx.state === 'suspended') ctx.resume?.();
  return ctx;
}

function cleanName(name = '') {
  return String(name)
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s.'-]/gu, '')
    .trim()
    .slice(0, 70);
}

function pickVoice(synth) {
  const voices = synth.getVoices?.() || [];
  return (
    voices.find((voice) => voice.lang?.toLowerCase() === 'en-in') ||
    voices.find((voice) => voice.lang?.toLowerCase().startsWith('en-')) ||
    voices[0] ||
    null
  );
}

function playTone({ frequency = 880, endFrequency = frequency, duration = 0.16, delay = 0, type = 'sine', volume = 0.18 }) {
  const ctx = getAudioContext();
  if (!ctx) return false;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const startAt = ctx.currentTime + delay;
  const endAt = startAt + duration;

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startAt);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), endAt);
  gain.gain.setValueAtTime(0.001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.001, endAt);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(endAt + 0.025);
  return true;
}

function playNoiseBurst({ delay = 0, duration = 0.09, volume = 0.09 } = {}) {
  const ctx = getAudioContext();
  if (!ctx) return false;

  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(sampleRate * duration)), sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
  }

  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const startAt = ctx.currentTime + delay;

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1400, startAt);
  filter.Q.setValueAtTime(8, startAt);
  gain.gain.setValueAtTime(volume, startAt);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);

  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(startAt);
  source.stop(startAt + duration);
  return true;
}

export function playRadioPermittedTone() {
  playNoiseBurst({ duration: 0.06, volume: 0.08 });
  playTone({ frequency: 1280, endFrequency: 1560, duration: 0.09, delay: 0.035, type: 'square', volume: 0.12 });
  playTone({ frequency: 860, endFrequency: 720, duration: 0.11, delay: 0.14, type: 'square', volume: 0.09 });
  return true;
}

export function playWarningAnnouncementTone() {
  playNoiseBurst({ duration: 0.045, volume: 0.08 });
  playTone({ frequency: 520, endFrequency: 160, duration: 0.12, delay: 0.02, type: 'square', volume: 0.18 });
  playTone({ frequency: 420, endFrequency: 130, duration: 0.12, delay: 0.16, type: 'square', volume: 0.16 });
  return true;
}

export function playFiveSecondWarningSiren({ delay = 1.55 } = {}) {
  const ctx = getAudioContext();
  if (!ctx) return false;

  const duration = 5;
  const startAt = ctx.currentTime + delay;
  const endAt = startAt + duration;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  gain.gain.setValueAtTime(0.001, startAt);
  gain.gain.linearRampToValueAtTime(0.14, startAt + 0.08);

  for (let time = startAt; time < endAt; time += 0.5) {
    osc.frequency.setValueAtTime(620, time);
    osc.frequency.linearRampToValueAtTime(320, Math.min(time + 0.25, endAt));
    osc.frequency.linearRampToValueAtTime(620, Math.min(time + 0.5, endAt));
  }

  gain.gain.setValueAtTime(0.14, endAt - 0.12);
  gain.gain.linearRampToValueAtTime(0.001, endAt);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(endAt + 0.02);
  return true;
}

export function playWelcomeChime() {
  playTone({ frequency: 523, endFrequency: 659, duration: 0.22, type: 'sine', volume: 0.1 });
  playTone({ frequency: 784, endFrequency: 1046, duration: 0.28, delay: 0.16, type: 'triangle', volume: 0.11 });
  playTone({ frequency: 1318, endFrequency: 1568, duration: 0.34, delay: 0.34, type: 'sine', volume: 0.08 });
  return true;
}

function speakLine(text, options = {}) {
  const synth = getSpeechSynthesis();
  const cleanedText = String(text || '').trim();

  if (!synth || !cleanedText) return false;

  const utterance = new SpeechSynthesisUtterance(cleanedText);
  const voice = pickVoice(synth);

  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || 'en-IN';
  utterance.volume = options.volume ?? 1;
  utterance.rate = options.rate ?? 0.88;
  utterance.pitch = options.pitch ?? 1.04;

  synth.cancel();
  window.setTimeout(() => synth.speak(utterance), options.delay ?? 140);
  return true;
}

export function speakWelcome(name) {
  const studentName = cleanName(name);
  if (!studentName) return false;
  return speakLine(`Welcome to the concert, ${studentName}. Enjoy the show.`, {
    rate: 0.88,
    pitch: 1.04,
  });
}

export function announcePermitted(name) {
  const studentName = cleanName(name);
  playRadioPermittedTone();
  return speakLine(studentName ? `Permitted. ${studentName}.` : 'Permitted.', {
    delay: 260,
    rate: 0.78,
    pitch: 0.78,
    volume: 1,
  });
}

export function announceAlreadyCheckedIn(name) {
  const studentName = cleanName(name);
  playWarningAnnouncementTone();
  playFiveSecondWarningSiren();
  return speakLine(studentName ? `Denied. Already scanned. ${studentName}.` : 'Denied. Already scanned.', {
    delay: 145,
    rate: 0.88,
    pitch: 0.7,
    volume: 1,
  });
}

export function announceWelcomeBeautiful(name) {
  const studentName = cleanName(name);
  playWelcomeChime();
  if (!studentName) return true;
  return speakLine(`Welcome to the concert, ${studentName}.`, {
    delay: 520,
    rate: 0.9,
    pitch: 1.12,
    volume: 0.96,
  });
}

export async function notifyScan({ title, body, tag = 'vivan-scan' } = {}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;

  try {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    if (Notification.permission !== 'granted') return false;

    const notification = new Notification(title || 'VIVAN VAIVIDHYA', {
      body: body || 'Scan update received.',
      tag,
      renotify: true,
      silent: true,
    });

    window.setTimeout(() => notification.close?.(), 4200);
    return true;
  } catch {
    return false;
  }
}

export function primeWelcomeVoice() {
  const synth = getSpeechSynthesis();
  if (!synth) return false;

  playWelcomeChime();

  const utterance = new SpeechSynthesisUtterance('Welcome sound enabled.');
  const voice = pickVoice(synth);

  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || 'en-IN';
  utterance.volume = 0.82;
  utterance.rate = 0.9;
  utterance.pitch = 1.02;

  synth.cancel();
  synth.speak(utterance);
  return true;
}

export function stopWelcomeVoice() {
  const synth = getSpeechSynthesis();
  if (!synth) return;
  synth.cancel();
}
