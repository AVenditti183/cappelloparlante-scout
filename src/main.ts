import './style.css';
import { AZURE_VOICES, AzureSpeechSession, pickDefaultAzureVoice, styleLabel } from './azureTts';

const textInput = document.querySelector<HTMLTextAreaElement>('#text-input')!;
const voiceSelect = document.querySelector<HTMLSelectElement>('#voice-select')!;
const accentItBtn = document.querySelector<HTMLButtonElement>('#accent-it')!;
const accentEnBtn = document.querySelector<HTMLButtonElement>('#accent-en')!;
const engineBrowserBtn = document.querySelector<HTMLButtonElement>('#engine-browser')!;
const engineAzureBtn = document.querySelector<HTMLButtonElement>('#engine-azure')!;
const azurePanel = document.querySelector<HTMLDivElement>('#azure-panel')!;
const azureRegionSelect = document.querySelector<HTMLSelectElement>('#azure-region')!;
const azureKeyInput = document.querySelector<HTMLInputElement>('#azure-key')!;
const styleField = document.querySelector<HTMLDivElement>('#style-field')!;
const styleSelect = document.querySelector<HTMLSelectElement>('#style-select')!;
const bgSelect = document.querySelector<HTMLSelectElement>('#azure-bg-select')!;
const bgUrlField = document.querySelector<HTMLDivElement>('#azure-bg-url-field')!;
const bgUrlInput = document.querySelector<HTMLInputElement>('#azure-bg-url')!;
const bgVolumeInput = document.querySelector<HTMLInputElement>('#azure-bg-volume')!;
const bgVolumeValue = document.querySelector<HTMLSpanElement>('#bg-volume-value')!;
const bgFadeInInput = document.querySelector<HTMLInputElement>('#azure-bg-fadein')!;
const bgFadeInValue = document.querySelector<HTMLSpanElement>('#bg-fadein-value')!;
const bgFadeOutInput = document.querySelector<HTMLInputElement>('#azure-bg-fadeout')!;
const bgFadeOutValue = document.querySelector<HTMLSpanElement>('#bg-fadeout-value')!;
const rateInput = document.querySelector<HTMLInputElement>('#rate-input')!;
const pitchInput = document.querySelector<HTMLInputElement>('#pitch-input')!;
const rateValue = document.querySelector<HTMLSpanElement>('#rate-value')!;
const pitchValue = document.querySelector<HTMLSpanElement>('#pitch-value')!;
const statusEl = document.querySelector<HTMLParagraphElement>('#status')!;
const btnPlay = document.querySelector<HTMLButtonElement>('#btn-play')!;
const btnPause = document.querySelector<HTMLButtonElement>('#btn-pause')!;
const btnStop = document.querySelector<HTMLButtonElement>('#btn-stop')!;

type Accent = 'it' | 'en';
type Engine = 'browser' | 'azure';

interface Settings {
  voiceURI: string | null;
  azureVoice: string | null;
  azureRegion: string;
  azureKey: string;
  azureStyle: string;
  azureBgSelection: string;
  azureBgUrl: string;
  azureBgVolume: number;
  azureBgFadeIn: number;
  azureBgFadeOut: number;
  engine: Engine;
  rate: number;
  pitch: number;
  accent: Accent;
  text: string;
}

const STORAGE_KEY = 'cappello-parlante:settings';

const defaultSettings: Settings = {
  voiceURI: null,
  azureVoice: null,
  azureRegion: 'italynorth',
  azureKey: '',
  azureStyle: '',
  azureBgSelection: '',
  azureBgUrl: '',
  azureBgVolume: 0.5,
  azureBgFadeIn: 1,
  azureBgFadeOut: 1,
  engine: 'browser',
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
let azureSession: AzureSpeechSession | null = null;

textInput.value = settings.text;
rateInput.value = String(settings.rate);
pitchInput.value = String(settings.pitch);
rateValue.textContent = `${settings.rate.toFixed(2)}×`;
pitchValue.textContent = settings.pitch.toFixed(1);
azureRegionSelect.value = settings.azureRegion;
azureKeyInput.value = settings.azureKey;
bgSelect.value = settings.azureBgSelection;
bgUrlField.hidden = settings.azureBgSelection !== 'custom';
bgUrlInput.value = settings.azureBgUrl;
bgVolumeInput.value = String(settings.azureBgVolume);
bgVolumeValue.textContent = settings.azureBgVolume.toFixed(2);
bgFadeInInput.value = String(settings.azureBgFadeIn);
bgFadeInValue.textContent = `${settings.azureBgFadeIn.toFixed(1)}s`;
bgFadeOutInput.value = String(settings.azureBgFadeOut);
bgFadeOutValue.textContent = `${settings.azureBgFadeOut.toFixed(1)}s`;
setAccentButtons(settings.accent);
setEngineButtons(settings.engine);
azurePanel.hidden = settings.engine !== 'azure';

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

function populateBrowserVoices(): boolean {
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
  refreshStyleOptions();
  return true;
}

function populateAzureVoiceSelect() {
  voiceSelect.innerHTML = '';
  const groupOrder: Array<{ key: string; prefix: 'it' | 'en' }> = [
    { key: 'Italiano', prefix: 'it' },
    { key: 'Inglese', prefix: 'en' },
  ];
  for (const group of groupOrder) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.key;
    for (const voice of AZURE_VOICES.filter((v) => v.lang.toLowerCase().startsWith(group.prefix))) {
      const option = document.createElement('option');
      option.value = voice.shortName;
      option.textContent = `${voice.label} (${voice.lang})`;
      optgroup.appendChild(option);
    }
    voiceSelect.appendChild(optgroup);
  }

  const savedVoiceExists =
    Boolean(settings.azureVoice) && AZURE_VOICES.some((v) => v.shortName === settings.azureVoice);
  if (savedVoiceExists) {
    voiceSelect.value = settings.azureVoice!;
  } else {
    applyAccentDefaultVoice(settings.accent);
  }

  voicesReady = true;
  refreshStyleOptions();
}

function applyAccentDefaultVoice(accent: Accent, browserVoices?: SpeechSynthesisVoice[]) {
  if (settings.engine === 'azure') {
    const best = pickDefaultAzureVoice(accent);
    if (best) {
      voiceSelect.value = best.shortName;
      settings.azureVoice = best.shortName;
      saveSettings({ azureVoice: best.shortName });
    }
    refreshStyleOptions();
    return;
  }

  const voices = browserVoices ?? speechSynthesis.getVoices();
  const best =
    accent === 'en'
      ? pickBestVoice(voices, 'en', ['en-gb', 'en-us'], true)
      : pickBestVoice(voices, 'it', ['it-it'], true);
  if (best) {
    voiceSelect.value = best.voiceURI;
    settings.voiceURI = best.voiceURI;
    saveSettings({ voiceURI: best.voiceURI });
  }
  refreshStyleOptions();
}

function refreshStyleOptions() {
  if (settings.engine !== 'azure') {
    styleField.hidden = true;
    return;
  }

  const voice = AZURE_VOICES.find((v) => v.shortName === voiceSelect.value);
  if (!voice || voice.styles.length === 0) {
    styleField.hidden = true;
    styleSelect.innerHTML = '<option value="">Nessuna (neutra)</option>';
    styleSelect.value = '';
    if (settings.azureStyle) {
      settings.azureStyle = '';
      saveSettings({ azureStyle: '' });
    }
    return;
  }

  styleField.hidden = false;
  styleSelect.innerHTML = '<option value="">Nessuna (neutra)</option>';
  for (const style of voice.styles) {
    const option = document.createElement('option');
    option.value = style;
    option.textContent = styleLabel(style);
    styleSelect.appendChild(option);
  }

  const validStyle = voice.styles.includes(settings.azureStyle) ? settings.azureStyle : '';
  styleSelect.value = validStyle;
  if (validStyle !== settings.azureStyle) {
    settings.azureStyle = validStyle;
    saveSettings({ azureStyle: validStyle });
  }
}

function setAccentButtons(accent: Accent) {
  accentItBtn.classList.toggle('is-active', accent === 'it');
  accentEnBtn.classList.toggle('is-active', accent === 'en');
  accentItBtn.setAttribute('aria-pressed', String(accent === 'it'));
  accentEnBtn.setAttribute('aria-pressed', String(accent === 'en'));
}

function setEngineButtons(engine: Engine) {
  engineBrowserBtn.classList.toggle('is-active', engine === 'browser');
  engineAzureBtn.classList.toggle('is-active', engine === 'azure');
  engineBrowserBtn.setAttribute('aria-pressed', String(engine === 'browser'));
  engineAzureBtn.setAttribute('aria-pressed', String(engine === 'azure'));
}

function refreshVoiceOptions() {
  if (settings.engine === 'azure') {
    populateAzureVoiceSelect();
    return;
  }
  voicesReady = false;
  if (populateBrowserVoices()) return;
  // Chrome/Android e Safari possono popolare le voci con un piccolo ritardo dopo il caricamento
  let attempts = 0;
  const retry = setInterval(() => {
    attempts += 1;
    if (populateBrowserVoices() || attempts > 20) clearInterval(retry);
  }, 200);
}

speechSynthesis.addEventListener('voiceschanged', () => {
  if (settings.engine === 'browser') populateBrowserVoices();
});
refreshVoiceOptions();

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

engineBrowserBtn.addEventListener('click', () => {
  if (settings.engine === 'browser') return;
  if (isSpeaking) {
    stopCurrentEngine();
    setSpeakingState(false);
  }
  settings.engine = 'browser';
  saveSettings({ engine: 'browser' });
  setEngineButtons('browser');
  azurePanel.hidden = true;
  refreshVoiceOptions();
});

engineAzureBtn.addEventListener('click', () => {
  if (settings.engine === 'azure') return;
  if (isSpeaking) {
    stopCurrentEngine();
    setSpeakingState(false);
  }
  settings.engine = 'azure';
  saveSettings({ engine: 'azure' });
  setEngineButtons('azure');
  azurePanel.hidden = false;
  refreshVoiceOptions();
});

azureRegionSelect.addEventListener('change', () => {
  settings.azureRegion = azureRegionSelect.value;
  saveSettings({ azureRegion: azureRegionSelect.value });
});

azureKeyInput.addEventListener('input', () => {
  settings.azureKey = azureKeyInput.value;
  saveSettings({ azureKey: azureKeyInput.value });
});

bgSelect.addEventListener('change', () => {
  settings.azureBgSelection = bgSelect.value;
  saveSettings({ azureBgSelection: bgSelect.value });
  bgUrlField.hidden = bgSelect.value !== 'custom';
});

bgUrlInput.addEventListener('input', () => {
  settings.azureBgUrl = bgUrlInput.value;
  saveSettings({ azureBgUrl: bgUrlInput.value });
});

bgVolumeInput.addEventListener('input', () => {
  const volume = parseFloat(bgVolumeInput.value);
  bgVolumeValue.textContent = volume.toFixed(2);
  settings.azureBgVolume = volume;
  saveSettings({ azureBgVolume: volume });
});

bgFadeInInput.addEventListener('input', () => {
  const seconds = parseFloat(bgFadeInInput.value);
  bgFadeInValue.textContent = `${seconds.toFixed(1)}s`;
  settings.azureBgFadeIn = seconds;
  saveSettings({ azureBgFadeIn: seconds });
});

bgFadeOutInput.addEventListener('input', () => {
  const seconds = parseFloat(bgFadeOutInput.value);
  bgFadeOutValue.textContent = `${seconds.toFixed(1)}s`;
  settings.azureBgFadeOut = seconds;
  saveSettings({ azureBgFadeOut: seconds });
});

voiceSelect.addEventListener('change', () => {
  if (settings.engine === 'azure') {
    settings.azureVoice = voiceSelect.value;
    saveSettings({ azureVoice: voiceSelect.value });
    const selected = AZURE_VOICES.find((v) => v.shortName === voiceSelect.value);
    if (selected) {
      const matchedAccent: Accent = selected.lang.toLowerCase().startsWith('it') ? 'it' : 'en';
      settings.accent = matchedAccent;
      setAccentButtons(matchedAccent);
      saveSettings({ accent: matchedAccent });
    }
    refreshStyleOptions();
    return;
  }

  settings.voiceURI = voiceSelect.value;
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

styleSelect.addEventListener('change', () => {
  settings.azureStyle = styleSelect.value;
  saveSettings({ azureStyle: styleSelect.value });
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

window.addEventListener('error', (event) => {
  setSpeakingState(false);
  setStatus(`Errore imprevisto: ${event.message}`);
});

window.addEventListener('unhandledrejection', (event) => {
  setSpeakingState(false);
  const reason = event.reason;
  setStatus(`Errore imprevisto: ${reason instanceof Error ? reason.message : String(reason)}`);
});

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

  if (settings.engine === 'azure') {
    speakWithAzure(chunks);
  } else {
    speakWithBrowser(chunks);
  }
}

function speakWithBrowser(chunks: string[]) {
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

function resolveBackgroundAudioUrl(): string {
  if (bgSelect.value === 'custom') return bgUrlInput.value.trim();
  if (!bgSelect.value) return '';
  return new URL(`${import.meta.env.BASE_URL}audio/${bgSelect.value}`, window.location.origin).href;
}

function speakWithAzure(chunks: string[]) {
  const key = azureKeyInput.value.trim();
  const region = azureRegionSelect.value;
  if (!key) {
    setStatus('Inserisci la tua chiave API Azure per usare questa voce.');
    return;
  }

  const voice = AZURE_VOICES.find((v) => v.shortName === voiceSelect.value) ?? pickDefaultAzureVoice(settings.accent);
  if (!voice) {
    setStatus('Nessuna voce Azure disponibile.');
    return;
  }

  const bgUrl = resolveBackgroundAudioUrl();
  // Con audio di sottofondo l'intero testo va in un'unica richiesta: il tag
  // mstts:backgroundaudio riparte da capo a ogni <speak>, quindi spezzettare
  // per frase farebbe ripartire la traccia a ogni frase.
  const effectiveChunks = bgUrl ? [chunks.join(' ')] : chunks;

  azureSession?.stop();
  azureSession = new AzureSpeechSession();
  setSpeakingState(true);

  const total = effectiveChunks.length;
  void azureSession.speak(
    effectiveChunks,
    {
      key,
      region,
      voice,
      rate: parseFloat(rateInput.value),
      pitch: parseFloat(pitchInput.value),
      style: styleSelect.value,
      background: bgUrl
        ? {
            url: bgUrl,
            volume: parseFloat(bgVolumeInput.value),
            fadeInMs: Math.round(parseFloat(bgFadeInInput.value) * 1000),
            fadeOutMs: Math.round(parseFloat(bgFadeOutInput.value) * 1000),
          }
        : undefined,
    },
    {
      onChunkStart: (index) => setStatus(total > 1 ? `Frase ${index + 1} di ${total}...` : 'In riproduzione...'),
      onDone: () => {
        setSpeakingState(false);
        setStatus('Riproduzione completata.');
      },
      onError: (message) => {
        setSpeakingState(false);
        setStatus(`Errore Azure: ${message}`);
      },
    },
  );
}

function pauseCurrentEngine() {
  if (settings.engine === 'azure') azureSession?.pause();
  else speechSynthesis.pause();
}

function resumeCurrentEngine() {
  if (settings.engine === 'azure') azureSession?.resume();
  else speechSynthesis.resume();
}

function stopCurrentEngine() {
  if (settings.engine === 'azure') azureSession?.stop();
  else speechSynthesis.cancel();
}

btnPlay.addEventListener('click', speak);

btnPause.addEventListener('click', () => {
  if (!isSpeaking) return;
  if (!isPaused) {
    pauseCurrentEngine();
    isPaused = true;
    btnPause.textContent = '▶ Riprendi';
    setStatus('In pausa.');
  } else {
    resumeCurrentEngine();
    isPaused = false;
    btnPause.textContent = '⏸ Pausa';
    setStatus('In riproduzione...');
  }
});

btnStop.addEventListener('click', () => {
  stopCurrentEngine();
  setSpeakingState(false);
  setStatus('Pronto.');
});
