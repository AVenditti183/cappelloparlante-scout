import './style.css';

const textInput = document.querySelector<HTMLTextAreaElement>('#text-input')!;
const voiceSelect = document.querySelector<HTMLSelectElement>('#voice-select')!;
const accentItBtn = document.querySelector<HTMLButtonElement>('#accent-it')!;
const accentEnBtn = document.querySelector<HTMLButtonElement>('#accent-en')!;
const rateInput = document.querySelector<HTMLInputElement>('#rate-input')!;
const pitchInput = document.querySelector<HTMLInputElement>('#pitch-input')!;
const rateValue = document.querySelector<HTMLSpanElement>('#rate-value')!;
const pitchValue = document.querySelector<HTMLSpanElement>('#pitch-value')!;
const statusEl = document.querySelector<HTMLParagraphElement>('#status')!;
const btnPlay = document.querySelector<HTMLButtonElement>('#btn-play')!;
const btnPause = document.querySelector<HTMLButtonElement>('#btn-pause')!;
const btnStop = document.querySelector<HTMLButtonElement>('#btn-stop')!;

type Accent = 'it' | 'en';

interface Settings {
  voiceURI: string | null;
  rate: number;
  pitch: number;
  accent: Accent;
  text: string;
}

const STORAGE_KEY = 'cappello-parlante:settings';

const defaultSettings: Settings = {
  voiceURI: null,
  rate: 0.95,
  pitch: 1,
  accent: 'en',
  text: '',
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultSettings };
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return { ...defaultSettings };
  }
}

function saveSettings(partial: Partial<Settings>) {
  const next = { ...loadSettings(), ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

const settings = loadSettings();
let isSpeaking = false;
let isPaused = false;
let voicesReady = false;

textInput.value = settings.text;
rateInput.value = String(settings.rate);
pitchInput.value = String(settings.pitch);
rateValue.textContent = `${settings.rate.toFixed(2)}×`;
pitchValue.textContent = settings.pitch.toFixed(1);
setAccentButtons(settings.accent);

// --- gestione voci ---

const QUALITY_HINTS = ['natural', 'online', 'neural', 'premium', 'enhanced', 'wavenet'];

// L'API Web Speech non espone il genere della voce: lo deduciamo dal nome,
// coprendo i nomi più comuni usati da Windows/Edge, macOS/iOS e Android.
const MALE_VOICE_NAME_HINTS = [
  'david', 'mark', 'guy', 'ryan', 'christopher', 'eric', 'roger', 'steffan', 'thomas',
  'daniel', 'fred', 'alex', 'aaron', 'james', 'george', 'oliver', 'liam',
  'diego', 'cosimo', 'benigno', 'luca', 'giuseppe', 'marco', 'paolo', 'roberto', 'stefano', 'giorgio', 'matteo',
];

function isLikelyMaleVoice(voice: SpeechSynthesisVoice): boolean {
  const name = voice.name.toLowerCase();
  if (/\bfemale\b/.test(name)) return false;
  if (/\bmale\b/.test(name)) return true;
  return MALE_VOICE_NAME_HINTS.some((hint) => name.includes(hint));
}

function languageGroupLabel(lang: string): string {
  const labels: Record<string, string> = {
    it: 'Italiano',
    en: 'Inglese',
    es: 'Spagnolo',
    fr: 'Francese',
    de: 'Tedesco',
    pt: 'Portoghese',
    ja: 'Giapponese',
    zh: 'Cinese',
  };
  const primary = lang.split('-')[0]?.toLowerCase() ?? lang;
  return labels[primary] ?? lang;
}

function scoreVoice(voice: SpeechSynthesisVoice, preferredRegions: string[], preferMale: boolean): number {
  let score = 0;
  const nameLower = voice.name.toLowerCase();
  if (preferMale && isLikelyMaleVoice(voice)) score += 50;
  if (QUALITY_HINTS.some((hint) => nameLower.includes(hint))) score += 10;
  const regionIndex = preferredRegions.indexOf(voice.lang.toLowerCase());
  if (regionIndex !== -1) score += preferredRegions.length - regionIndex;
  if (voice.default) score += 1;
  return score;
}

function pickBestVoice(
  voices: SpeechSynthesisVoice[],
  langPrefix: string,
  preferredRegions: string[],
  preferMale: boolean,
): SpeechSynthesisVoice | undefined {
  const candidates = voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));
  if (!candidates.length) return undefined;
  return [...candidates].sort(
    (a, b) => scoreVoice(b, preferredRegions, preferMale) - scoreVoice(a, preferredRegions, preferMale),
  )[0];
}

function populateVoices(): boolean {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return false;

  const groups = new Map<string, SpeechSynthesisVoice[]>();
  for (const voice of voices) {
    const label = languageGroupLabel(voice.lang);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(voice);
  }

  const priority = ['Italiano', 'Inglese'];
  const orderedKeys = [...groups.keys()].sort((a, b) => {
    const ia = priority.indexOf(a);
    const ib = priority.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b, 'it');
  });

  voiceSelect.innerHTML = '';
  for (const key of orderedKeys) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = key;
    const groupVoices = groups.get(key)!.sort((a, b) => a.name.localeCompare(b.name));
    for (const voice of groupVoices) {
      const option = document.createElement('option');
      option.value = voice.voiceURI;
      option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' — predefinita' : ''}`;
      optgroup.appendChild(option);
    }
    voiceSelect.appendChild(optgroup);
  }

  const savedVoiceExists = Boolean(settings.voiceURI) && voices.some((v) => v.voiceURI === settings.voiceURI);
  if (savedVoiceExists) {
    voiceSelect.value = settings.voiceURI!;
  } else {
    applyAccentDefaultVoice(settings.accent, voices);
  }

  voicesReady = true;
  return true;
}

function applyAccentDefaultVoice(accent: Accent, voices: SpeechSynthesisVoice[] = speechSynthesis.getVoices()) {
  const best =
    accent === 'en'
      ? pickBestVoice(voices, 'en', ['en-gb', 'en-us'], true)
      : pickBestVoice(voices, 'it', ['it-it'], true);
  if (best) {
    voiceSelect.value = best.voiceURI;
    saveSettings({ voiceURI: best.voiceURI });
  }
}

function setAccentButtons(accent: Accent) {
  accentItBtn.classList.toggle('is-active', accent === 'it');
  accentEnBtn.classList.toggle('is-active', accent === 'en');
  accentItBtn.setAttribute('aria-pressed', String(accent === 'it'));
  accentEnBtn.setAttribute('aria-pressed', String(accent === 'en'));
}

speechSynthesis.addEventListener('voiceschanged', populateVoices);
if (!populateVoices()) {
  // Chrome/Android e Safari possono popolare le voci con un piccolo ritardo dopo il caricamento
  let attempts = 0;
  const retry = setInterval(() => {
    attempts += 1;
    if (populateVoices() || attempts > 20) clearInterval(retry);
  }, 200);
}

// --- eventi UI ---

accentItBtn.addEventListener('click', () => {
  settings.accent = 'it';
  setAccentButtons('it');
  applyAccentDefaultVoice('it');
  saveSettings({ accent: 'it' });
});

accentEnBtn.addEventListener('click', () => {
  settings.accent = 'en';
  setAccentButtons('en');
  applyAccentDefaultVoice('en');
  saveSettings({ accent: 'en' });
});

voiceSelect.addEventListener('change', () => {
  saveSettings({ voiceURI: voiceSelect.value });

  const selectedVoice = speechSynthesis.getVoices().find((v) => v.voiceURI === voiceSelect.value);
  const lang = selectedVoice?.lang.toLowerCase() ?? '';
  const matchedAccent: Accent | null = lang.startsWith('it') ? 'it' : lang.startsWith('en') ? 'en' : null;
  if (matchedAccent) {
    settings.accent = matchedAccent;
    setAccentButtons(matchedAccent);
    saveSettings({ accent: matchedAccent });
  }
});

rateInput.addEventListener('input', () => {
  const rate = parseFloat(rateInput.value);
  rateValue.textContent = `${rate.toFixed(2)}×`;
  saveSettings({ rate });
});

pitchInput.addEventListener('input', () => {
  const pitch = parseFloat(pitchInput.value);
  pitchValue.textContent = pitch.toFixed(1);
  saveSettings({ pitch });
});

let textSaveTimeout: number | undefined;
textInput.addEventListener('input', () => {
  window.clearTimeout(textSaveTimeout);
  textSaveTimeout = window.setTimeout(() => saveSettings({ text: textInput.value }), 400);
});

// --- suddivisione testo in frasi per evitare il bug di Chrome sulle utterance troppo lunghe ---

const MAX_CHUNK_LENGTH = 180;

function splitIntoChunks(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const sentences = trimmed.split(/(?<=[.!?;:])\s+/);
  const chunks: string[] = [];

  for (const sentence of sentences) {
    if (sentence.length <= MAX_CHUNK_LENGTH) {
      chunks.push(sentence);
      continue;
    }
    let current = '';
    for (const word of sentence.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > MAX_CHUNK_LENGTH && current) {
        chunks.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) chunks.push(current);
  }

  return chunks.filter(Boolean);
}

// --- riproduzione ---

function setStatus(message: string) {
  statusEl.textContent = message;
}

function setSpeakingState(speaking: boolean) {
  isSpeaking = speaking;
  isPaused = false;
  btnPlay.disabled = speaking;
  btnPause.disabled = !speaking;
  btnStop.disabled = !speaking;
  btnPause.textContent = '⏸ Pausa';
}

function speak() {
  const chunks = splitIntoChunks(textInput.value);
  if (!chunks.length) {
    setStatus('Scrivi del testo prima di ascoltare.');
    return;
  }
  if (!voicesReady || !speechSynthesis.getVoices().length) {
    setStatus('Nessuna voce disponibile su questo dispositivo.');
    return;
  }

  speechSynthesis.cancel();

  const voice = speechSynthesis.getVoices().find((v) => v.voiceURI === voiceSelect.value);
  const rate = parseFloat(rateInput.value);
  const pitch = parseFloat(pitchInput.value);
  const total = chunks.length;

  chunks.forEach((chunk, index) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'it-IT';
    }
    utterance.rate = rate;
    utterance.pitch = pitch;

    utterance.onstart = () => setStatus(total > 1 ? `Frase ${index + 1} di ${total}...` : 'In riproduzione...');
    utterance.onerror = () => {
      setSpeakingState(false);
      setStatus('Si è verificato un errore durante la riproduzione.');
    };
    if (index === total - 1) {
      utterance.onend = () => {
        setSpeakingState(false);
        setStatus('Riproduzione completata.');
      };
    }

    speechSynthesis.speak(utterance);
  });

  setSpeakingState(true);
}

btnPlay.addEventListener('click', speak);

btnPause.addEventListener('click', () => {
  if (!isSpeaking) return;
  if (!isPaused) {
    speechSynthesis.pause();
    isPaused = true;
    btnPause.textContent = '▶ Riprendi';
    setStatus('In pausa.');
  } else {
    speechSynthesis.resume();
    isPaused = false;
    btnPause.textContent = '⏸ Pausa';
    setStatus('In riproduzione...');
  }
});

btnStop.addEventListener('click', () => {
  speechSynthesis.cancel();
  setSpeakingState(false);
  setStatus('Pronto.');
});
