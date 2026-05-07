function getSpeechSynthesis() {
  if (typeof window === 'undefined') return null;
  return window.speechSynthesis || null;
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

export function speakWelcome(name) {
  const synth = getSpeechSynthesis();
  const studentName = cleanName(name);

  if (!synth || !studentName) return false;

  const utterance = new SpeechSynthesisUtterance(`Welcome to the concert, ${studentName}. Enjoy the show.`);
  const voice = pickVoice(synth);

  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || 'en-IN';
  utterance.volume = 1;
  utterance.rate = 0.88;
  utterance.pitch = 1.04;

  synth.cancel();
  window.setTimeout(() => synth.speak(utterance), 140);
  return true;
}

export function primeWelcomeVoice() {
  const synth = getSpeechSynthesis();
  if (!synth) return false;

  const utterance = new SpeechSynthesisUtterance('Voice announcement enabled.');
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
