import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

export interface AzureVoiceOption {
  shortName: string;
  label: string;
  lang: string;
  gender: 'M' | 'F';
}

// Voci neurali Azure stabili e ben documentate per italiano e inglese.
// (l'elenco completo si potrebbe ottenere via synthesizer.getVoicesAsync(),
// ma un set curato evita una chiamata di rete extra prima di poter parlare)
export const AZURE_VOICES: AzureVoiceOption[] = [
  { shortName: 'it-IT-DiegoNeural', label: 'Diego', lang: 'it-IT', gender: 'M' },
  { shortName: 'it-IT-GianniNeural', label: 'Gianni', lang: 'it-IT', gender: 'M' },
  { shortName: 'it-IT-RinaldoNeural', label: 'Rinaldo', lang: 'it-IT', gender: 'M' },
  { shortName: 'it-IT-ElsaNeural', label: 'Elsa', lang: 'it-IT', gender: 'F' },
  { shortName: 'it-IT-IsabellaNeural', label: 'Isabella', lang: 'it-IT', gender: 'F' },
  { shortName: 'en-GB-RyanNeural', label: 'Ryan (UK)', lang: 'en-GB', gender: 'M' },
  { shortName: 'en-GB-ThomasNeural', label: 'Thomas (UK)', lang: 'en-GB', gender: 'M' },
  { shortName: 'en-GB-SoniaNeural', label: 'Sonia (UK)', lang: 'en-GB', gender: 'F' },
  { shortName: 'en-US-GuyNeural', label: 'Guy (US)', lang: 'en-US', gender: 'M' },
  { shortName: 'en-US-ChristopherNeural', label: 'Christopher (US)', lang: 'en-US', gender: 'M' },
  { shortName: 'en-US-JennyNeural', label: 'Jenny (US)', lang: 'en-US', gender: 'F' },
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

function buildSsml(text: string, voice: AzureVoiceOption, rate: number, pitch: number): string {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${voice.lang}">` +
    `<voice name="${voice.shortName}">` +
    `<prosody rate="${rate}" pitch="${pitchToPercent(pitch)}">${escapeSsml(text)}</prosody>` +
    `</voice></speak>`
  );
}

export interface AzureSpeakCallbacks {
  onChunkStart: (index: number, total: number) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

export class AzureSpeechSession {
  private synthesizer: sdk.SpeechSynthesizer | null = null;
  private player: sdk.SpeakerAudioDestination | null = null;
  private cancelled = false;
  private paused = false;

  async speak(
    chunks: string[],
    config: { key: string; region: string; voice: AzureVoiceOption; rate: number; pitch: number },
    callbacks: AzureSpeakCallbacks,
  ): Promise<void> {
    const speechConfig = sdk.SpeechConfig.fromSubscription(config.key, config.region);
    speechConfig.speechSynthesisVoiceName = config.voice.shortName;

    this.player = new sdk.SpeakerAudioDestination();
    const audioConfig = sdk.AudioConfig.fromSpeakerOutput(this.player);
    this.synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

    for (let index = 0; index < chunks.length; index += 1) {
      if (this.cancelled) return;
      callbacks.onChunkStart(index, chunks.length);
      const ssml = buildSsml(chunks[index], config.voice, config.rate, config.pitch);
      try {
        await this.speakChunk(ssml);
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

  private speakChunk(ssml: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesizer) {
        reject(new Error('Sintetizzatore non inizializzato.'));
        return;
      }
      this.synthesizer.speakSsmlAsync(
        ssml,
        (result) => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            resolve();
          } else {
            reject(new Error(result.errorDetails || 'Sintesi Azure non riuscita. Controlla chiave e regione.'));
          }
        },
        (error) => reject(new Error(error)),
      );
    });
  }

  pause() {
    if (this.player && !this.paused) {
      this.player.pause();
      this.paused = true;
    }
  }

  resume() {
    if (this.player && this.paused) {
      this.player.resume();
      this.paused = false;
    }
  }

  stop() {
    this.cancelled = true;
    this.close();
  }

  private close() {
    this.player?.close();
    this.synthesizer?.close();
    this.player = null;
    this.synthesizer = null;
  }
}
