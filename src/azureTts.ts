import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

export interface AzureVoiceOption {
  shortName: string;
  label: string;
  lang: string;
  gender: 'M' | 'F';
  styles: string[];
  /** Se presente, la voce e' in preview e funziona solo con una risorsa Azure creata in una di queste regioni. */
  restrictedRegions?: string[];
}

const STYLE_LABELS: Record<string, string> = {
  cheerful: 'Allegro',
  sad: 'Triste',
  excited: 'Eccitato',
  whispering: 'Sussurrato',
  chat: 'Colloquiale',
  angry: 'Arrabbiato',
  friendly: 'Amichevole',
  hopeful: 'Speranzoso',
  newscast: 'Da telegiornale',
  shouting: 'Urlato',
  terrified: 'Terrorizzato',
  unfriendly: 'Scortese',
  assistant: 'Assistente',
  customerservice: 'Servizio clienti',
  // Tag paralinguistici, disponibili solo sulle voci HD (DragonHD)
  sighing: 'Sospiro',
  laughter: 'Risata',
  coughing: 'Colpo di tosse',
  throat_clearing: 'Schiarita di voce',
  breathing: 'Respiro',
  yawning: 'Sbadiglio',
};

export function styleLabel(style: string): string {
  return STYLE_LABELS[style] ?? style;
}

// Voci neurali Azure stabili e ben documentate per italiano e inglese, con gli
// stili SSML (mstts:express-as) realmente supportati da ciascuna voce secondo
// la documentazione ufficiale.
// (l'elenco completo si potrebbe ottenere via synthesizer.getVoicesAsync(),
// ma un set curato evita una chiamata di rete extra prima di poter parlare)
const HD_REGIONS = ['eastus', 'westeurope', 'southeastasia'];

export const AZURE_VOICES: AzureVoiceOption[] = [
  // Voci "HD" (DragonHD): la generazione piu' realistica, basata su LLM, che
  // adatta automaticamente tono ed emozione al contesto. In preview, disponibili
  // solo su risorse Azure create in una delle regioni elencate in HD_REGIONS.
  {
    shortName: 'it-IT-Alessio:DragonHDLatestNeural',
    label: 'Alessio (HD)',
    lang: 'it-IT',
    gender: 'M',
    styles: ['sighing', 'laughter', 'coughing', 'throat_clearing', 'breathing', 'yawning'],
    restrictedRegions: HD_REGIONS,
  },
  {
    shortName: 'it-IT-Isabella:DragonHDLatestNeural',
    label: 'Isabella (HD)',
    lang: 'it-IT',
    gender: 'F',
    styles: ['sighing', 'laughter', 'coughing', 'throat_clearing', 'breathing', 'yawning'],
    restrictedRegions: HD_REGIONS,
  },
  {
    shortName: 'en-US-Andrew:DragonHDLatestNeural',
    label: 'Andrew (HD)',
    lang: 'en-US',
    gender: 'M',
    styles: ['sighing', 'laughter', 'coughing', 'throat_clearing', 'breathing', 'yawning'],
    restrictedRegions: HD_REGIONS,
  },
  {
    shortName: 'en-US-Ava:DragonHDLatestNeural',
    label: 'Ava (HD)',
    lang: 'en-US',
    gender: 'F',
    styles: ['sighing', 'laughter', 'coughing', 'throat_clearing', 'breathing', 'yawning'],
    restrictedRegions: HD_REGIONS,
  },
  // Voci "Multilingual", generazione piu' recente: nessuno stile SSML ma
  // naturalezza di base superiore alle Neural standard sottostanti.
  { shortName: 'it-IT-AlessioMultilingualNeural', label: 'Alessio (naturale)', lang: 'it-IT', gender: 'M', styles: [] },
  { shortName: 'it-IT-GiuseppeMultilingualNeural', label: 'Giuseppe (naturale)', lang: 'it-IT', gender: 'M', styles: [] },
  { shortName: 'it-IT-MarcelloMultilingualNeural', label: 'Marcello (naturale)', lang: 'it-IT', gender: 'M', styles: [] },
  { shortName: 'it-IT-IsabellaMultilingualNeural', label: 'Isabella (naturale)', lang: 'it-IT', gender: 'F', styles: [] },
  { shortName: 'it-IT-DiegoNeural', label: 'Diego', lang: 'it-IT', gender: 'M', styles: ['cheerful', 'excited', 'sad'] },
  { shortName: 'it-IT-GianniNeural', label: 'Gianni', lang: 'it-IT', gender: 'M', styles: [] },
  { shortName: 'it-IT-RinaldoNeural', label: 'Rinaldo', lang: 'it-IT', gender: 'M', styles: [] },
  { shortName: 'it-IT-ElsaNeural', label: 'Elsa', lang: 'it-IT', gender: 'F', styles: [] },
  {
    shortName: 'it-IT-IsabellaNeural',
    label: 'Isabella (espressiva)',
    lang: 'it-IT',
    gender: 'F',
    styles: ['chat', 'cheerful', 'excited', 'sad', 'whispering'],
  },
  { shortName: 'en-GB-RyanNeural', label: 'Ryan (UK)', lang: 'en-GB', gender: 'M', styles: ['chat', 'cheerful', 'sad', 'whispering'] },
  { shortName: 'en-GB-ThomasNeural', label: 'Thomas (UK)', lang: 'en-GB', gender: 'M', styles: [] },
  { shortName: 'en-GB-SoniaNeural', label: 'Sonia (UK)', lang: 'en-GB', gender: 'F', styles: ['cheerful', 'sad'] },
  {
    shortName: 'en-US-GuyNeural',
    label: 'Guy (US)',
    lang: 'en-US',
    gender: 'M',
    styles: ['angry', 'cheerful', 'excited', 'friendly', 'hopeful', 'newscast', 'sad', 'shouting', 'terrified', 'unfriendly', 'whispering'],
  },
  { shortName: 'en-US-ChristopherNeural', label: 'Christopher (US)', lang: 'en-US', gender: 'M', styles: [] },
  {
    shortName: 'en-US-JennyNeural',
    label: 'Jenny (US)',
    lang: 'en-US',
    gender: 'F',
    styles: [
      'angry', 'assistant', 'chat', 'cheerful', 'customerservice', 'excited',
      'friendly', 'hopeful', 'newscast', 'sad', 'shouting', 'terrified', 'unfriendly', 'whispering',
    ],
  },
];

export function pickDefaultAzureVoice(langPrefix: 'it' | 'en'): AzureVoiceOption {
  // Le voci con restrictedRegions richiedono una risorsa Azure creata in una
  // regione specifica: non vanno mai scelte automaticamente, solo a mano.
  const candidates = AZURE_VOICES.filter((v) => v.lang.toLowerCase().startsWith(langPrefix) && !v.restrictedRegions);
  return candidates.find((v) => v.gender === 'M') ?? candidates[0];
}

// Le voci "DragonHD" (non Omni) supportano solo un sottoinsieme minimo di
// SSML: niente <prosody> (quindi tono/velocita' non hanno alcun effetto),
// niente <emphasis>, niente <mstts:express-as> e niente
// <mstts:backgroundaudio>. Stili e tag paralinguistici funzionano solo come
// marcatore testuale "[stile]" dentro il testo stesso.
// Fonte: https://learn.microsoft.com/azure/ai-services/speech-service/high-definition-voices
export function isDragonHD(voice: AzureVoiceOption): boolean {
  return voice.shortName.includes(':DragonHD');
}

function escapeSsml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pitchToPercent(pitch: number): string {
  const percent = Math.round((pitch - 1) * 50);
  return `${percent >= 0 ? '+' : ''}${percent}%`;
}

// Cattura sequenze di parole TUTTE IN MAIUSCOLO (almeno 2 lettere ciascuna) per
// enfatizzarle. <emphasis> da solo e' garantito solo su 3 voci inglesi US, quindi
// aggiungiamo anche una spinta di tono/volume via <prosody>, che funziona su
// qualsiasi voce neurale Azure.
const ALLCAPS_RUN = /[A-ZÀÈÉÌÍÎÒÓÙÚ]{2,}(?:[ '-][A-ZÀÈÉÌÍÎÒÓÙÚ]{2,})*/g;

function emphasizeAllCaps(text: string): string {
  let result = '';
  let lastIndex = 0;
  for (const match of text.matchAll(ALLCAPS_RUN)) {
    result += escapeSsml(text.slice(lastIndex, match.index));
    result +=
      `<prosody pitch="+8%" volume="+20%"><emphasis level="strong">${escapeSsml(match[0])}</emphasis></prosody>`;
    lastIndex = match.index! + match[0].length;
  }
  result += escapeSsml(text.slice(lastIndex));
  return result;
}

export interface BackgroundAudio {
  url: string;
  volume: number;
  fadeInMs: number;
  fadeOutMs: number;
  /** Silenzio prima che la voce inizi a parlare: il sottofondo suona da solo per questo tempo. */
  leadInMs: number;
}

function buildSsml(
  text: string,
  voice: AzureVoiceOption,
  rate: number,
  pitch: number,
  style: string,
  background?: BackgroundAudio,
): string {
  if (isDragonHD(voice)) {
    // Nessun <prosody>/<emphasis>/<mstts:express-as>/<mstts:backgroundaudio>:
    // l'unica leva rimasta e' il marcatore testuale per stili/paralinguistica.
    const marker = style && voice.styles.includes(style) ? `[${style}] ` : '';
    return (
      `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${voice.lang}">` +
      `<voice name="${voice.shortName}">${marker}${escapeSsml(text)}</voice>` +
      `</speak>`
    );
  }

  const prosody = `<prosody rate="${rate}" pitch="${pitchToPercent(pitch)}">${emphasizeAllCaps(text)}</prosody>`;
  const expressive = style && voice.styles.includes(style) ? `<mstts:express-as style="${style}">${prosody}</mstts:express-as>` : prosody;
  const leadIn = background && background.leadInMs > 0 ? `<break time="${background.leadInMs}ms"/>` : '';
  const body = leadIn + expressive;
  const backgroundTag = background
    ? `<mstts:backgroundaudio src="${escapeSsml(background.url)}" volume="${background.volume}" fadein="${background.fadeInMs}" fadeout="${background.fadeOutMs}"/>`
    : '';
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${voice.lang}">` +
    backgroundTag +
    `<voice name="${voice.shortName}">${body}</voice>` +
    `</speak>`
  );
}

export interface AzureSpeakCallbacks {
  onChunkStart: (index: number, total: number) => void;
  onDone: () => void;
  onError: (message: string) => void;
  /** Riceve l'audio mp3 grezzo di ogni frase, utile per offrirne il download. */
  onAudioChunk?: (data: ArrayBuffer) => void;
}

export class AzureSpeechSession {
  private synthesizer: sdk.SpeechSynthesizer | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;
  private cancelled = false;

  async speak(
    chunks: string[],
    config: {
      key: string;
      region: string;
      voice: AzureVoiceOption;
      rate: number;
      pitch: number;
      style: string;
      background?: BackgroundAudio;
    },
    callbacks: AzureSpeakCallbacks,
  ): Promise<void> {
    try {
      const speechConfig = sdk.SpeechConfig.fromSubscription(config.key, config.region);
      speechConfig.speechSynthesisVoiceName = config.voice.shortName;
      // Mp3 semplice, decodificato da un elemento <audio> standard: a differenza
      // del playback via Media Source Extensions (SpeakerAudioDestination), questo
      // funziona anche su iOS Safari/WebKit (e quindi su Chrome/Firefox per iOS,
      // che sotto sono comunque WebKit).
      speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3;

      // audioConfig=null evita che l'SDK provi comunque un output automatico via
      // MSE: vogliamo solo il buffer audio, la riproduzione la gestiamo noi.
      this.synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);
    } catch (error) {
      callbacks.onError(error instanceof Error ? error.message : 'Impossibile inizializzare Azure Speech.');
      this.close();
      return;
    }

    for (let index = 0; index < chunks.length; index += 1) {
      if (this.cancelled) return;
      callbacks.onChunkStart(index, chunks.length);
      const ssml = buildSsml(chunks[index], config.voice, config.rate, config.pitch, config.style, config.background);
      try {
        const audioData = await this.synthesizeChunk(ssml);
        if (this.cancelled) return;
        callbacks.onAudioChunk?.(audioData);
        await this.playAudioData(audioData);
      } catch (error) {
        if (!this.cancelled) {
          callbacks.onError(error instanceof Error ? error.message : 'Errore di sintesi Azure.');
        }
        this.close();
        return;
      }
    }

    if (!this.cancelled) callbacks.onDone();
    this.close();
  }

  private synthesizeChunk(ssml: string): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      if (!this.synthesizer) {
        reject(new Error('Sintetizzatore non inizializzato.'));
        return;
      }
      const timeout = setTimeout(() => {
        reject(new Error('Nessuna risposta da Azure dopo 15 secondi. Controlla la connessione, la chiave e la regione.'));
      }, 15000);
      this.synthesizer.speakSsmlAsync(
        ssml,
        (result) => {
          clearTimeout(timeout);
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            resolve(result.audioData);
          } else {
            reject(new Error(result.errorDetails || 'Sintesi Azure non riuscita. Controlla chiave e regione.'));
          }
        },
        (error) => {
          clearTimeout(timeout);
          reject(new Error(error));
        },
      );
    });
  }

  private playAudioData(audioData: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      // Un elemento <audio> nuovo per ogni frase, invece di riusare lo stesso:
      // riassegnare .src sullo stesso elemento subito dopo un 'ended' può
      // scatenare un evento 'error' spurio in alcuni browser.
      const url = URL.createObjectURL(new Blob([audioData], { type: 'audio/mpeg' }));
      const audioEl = new Audio(url);
      this.audioEl = audioEl;
      this.currentObjectUrl = url;

      const cleanup = () => {
        URL.revokeObjectURL(url);
        audioEl.onended = null;
        audioEl.onerror = null;
      };

      audioEl.onended = () => {
        cleanup();
        resolve();
      };
      audioEl.onerror = () => {
        cleanup();
        reject(new Error('Il browser non riesce a riprodurre l\'audio ricevuto da Azure.'));
      };

      audioEl.play().catch((error) => {
        cleanup();
        reject(
          new Error(
            error?.name === 'NotAllowedError'
              ? 'Il browser ha bloccato la riproduzione automatica. Tocca di nuovo "Ascolta".'
              : `Riproduzione audio non riuscita: ${error?.message ?? error}`,
          ),
        );
      });
    });
  }

  pause() {
    this.audioEl?.pause();
  }

  resume() {
    void this.audioEl?.play();
  }

  stop() {
    this.cancelled = true;
    this.close();
  }

  private close() {
    if (this.audioEl) {
      this.audioEl.onended = null;
      this.audioEl.onerror = null;
      this.audioEl.pause();
      this.audioEl.removeAttribute('src');
    }
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
    this.synthesizer?.close();
    this.synthesizer = null;
    this.audioEl = null;
  }
}
