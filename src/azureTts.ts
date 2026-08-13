import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

export interface AzureVoiceOption {
  shortName: string;
  label: string;
  lang: string;
  gender: 'M' | 'F';
  styles: string[];
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
};

export function styleLabel(style: string): string {
  return STYLE_LABELS[style] ?? style;
}

// Voci neurali Azure stabili e ben documentate per italiano e inglese, con gli
// stili SSML (mstts:express-as) realmente supportati da ciascuna voce secondo
// la documentazione ufficiale.
// (l'elenco completo si potrebbe ottenere via synthesizer.getVoicesAsync(),
// ma un set curato evita una chiamata di rete extra prima di poter parlare)
export const AZURE_VOICES: AzureVoiceOption[] = [
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
  const candidates = AZURE_VOICES.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));
  return candidates.find((v) => v.gender === 'M') ?? candidates[0];
}

function escapeSsml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pitchToPercent(pitch: number): string {
  const percent = Math.round((pitch - 1) * 50);
  return `${percent >= 0 ? '+' : ''}${percent}%`;
}

export interface BackgroundAudio {
  url: string;
  volume: number;
  fadeInMs: number;
  fadeOutMs: number;
}

function buildSsml(
  text: string,
  voice: AzureVoiceOption,
  rate: number,
  pitch: number,
  style: string,
  background?: BackgroundAudio,
): string {
  const prosody = `<prosody rate="${rate}" pitch="${pitchToPercent(pitch)}">${escapeSsml(text)}</prosody>`;
  const body = style && voice.styles.includes(style) ? `<mstts:express-as style="${style}">${prosody}</mstts:express-as>` : prosody;
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
      this.audioEl = new Audio();
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
      if (!this.audioEl) {
        reject(new Error('Elemento audio non disponibile.'));
        return;
      }
      if (this.currentObjectUrl) URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = URL.createObjectURL(new Blob([audioData], { type: 'audio/mpeg' }));

      const audioEl = this.audioEl;
      audioEl.onended = () => resolve();
      audioEl.onerror = () => reject(new Error('Il browser non riesce a riprodurre l\'audio ricevuto da Azure.'));
      audioEl.src = this.currentObjectUrl;

      audioEl.play().catch((error) => {
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
