# 🎙️ Cappello Parlante

App web che legge testo in italiano ad alta voce, senza backend: gira interamente nel browser e viene pubblicata come sito statico su GitHub Pages.

**Demo:** https://avenditti183.github.io/cappelloparlante-scout/

## Motori vocali

L'app supporta due motori, selezionabili al volo:

- **Voce di sistema** — usa la [Web Speech API](https://developer.mozilla.org/docs/Web/API/Web_Speech_API) del browser. Gratis, funziona offline dopo il primo caricamento, ma la qualità delle voci dipende dal sistema operativo/browser dell'utente.
- **Azure Neural** — usa [Azure AI Speech](https://learn.microsoft.com/azure/ai-services/speech-service/) tramite l'SDK ufficiale per il browser. Voci molto più naturali, richiede una chiave API Azure inserita dall'utente (salvata solo in `localStorage`, mai nel codice).

### Funzionalità del motore Azure

- Voci italiane e inglesi, standard / "naturali" (Multilingual) / **HD** (DragonHD, le più realistiche)
- Espressioni: stili emotivi e tag paralinguistici (sospiro, risata, ecc.), applicati via `mstts:express-as` sulle voci standard e via marcatore testuale `[stile]` sulle voci HD
- Enfasi automatica sulle parole TUTTE IN MAIUSCOLO (voci non-HD)
- Audio di sottofondo opzionale (`mstts:backgroundaudio`), con dissolvenza iniziale/finale configurabile — un valore negativo fa partire il sottofondo da solo prima della voce
- Download dell'audio generato in MP3

**Limiti noti delle voci HD**: secondo la [documentazione ufficiale](https://learn.microsoft.com/azure/ai-services/speech-service/high-definition-voices), le voci DragonHD non supportano `<prosody>` (velocità/tono), `<emphasis>` né `<mstts:backgroundaudio>` — l'app disabilita questi controlli automaticamente quando ne selezioni una. Sono inoltre disponibili solo con una risorsa Azure creata in `eastus`, `westeurope` o `southeastasia`.

### Espressioni disponibili sulle voci HD

Sulle voci HD (Alessio, Isabella, Andrew, Ava) le espressioni funzionano anche scrivendo il marcatore direttamente nel testo, es. `[sighing] Che stanchezza...` — utile per cambiare espressione più volte nella stessa lettura, cosa che il menu "Espressione" (un solo stile per tutta la frase) non permette.

**Paralinguistica** (versi/rumori):

| Marcatore | Traduzione |
|---|---|
| `[sighing]` | Sospiro |
| `[laughter]` | Risata |
| `[coughing]` | Colpo di tosse |
| `[throat_clearing]` | Schiarita di voce |
| `[breathing]` | Respiro |
| `[yawning]` | Sbadiglio |

**Stili emotivi**:

| Marcatore | Traduzione | Marcatore | Traduzione |
|---|---|---|---|
| `[amazed]` | Stupito | `[optimistic]` | Ottimista |
| `[amused]` | Divertito | `[painful]` | Dolorante |
| `[angry]` | Arrabbiato | `[panicked]` | Nel panico |
| `[annoyed]` | Infastidito | `[panting]` | Ansimante |
| `[anxious]` | Ansioso | `[pleading]` | Implorante |
| `[appreciative]` | Riconoscente | `[proud]` | Fiero |
| `[calm]` | Calmo | `[quiet]` | Silenzioso |
| `[cautious]` | Cauto | `[reassuring]` | Rassicurante |
| `[concerned]` | Preoccupato | `[reflective]` | Pensieroso |
| `[confident]` | Sicuro di sé | `[relieved]` | Sollevato |
| `[confused]` | Confuso | `[remorseful]` | Pieno di rimorso |
| `[curious]` | Curioso | `[resigned]` | Rassegnato |
| `[defeated]` | Sconfitto | `[sad]` | Triste |
| `[defensive]` | Sulla defensiva | `[sarcastic]` | Sarcastico |
| `[defiant]` | Di sfida | `[secretive]` | Riservato |
| `[determined]` | Determinato | `[serious]` | Serio |
| `[disappointed]` | Deluso | `[shocked]` | Scioccato |
| `[disgusted]` | Disgustato | `[shouting]` | Urlato |
| `[doubtful]` | Dubbioso | `[shy]` | Timido |
| `[ecstatic]` | Estasiato | `[skeptical]` | Scettico |
| `[encouraging]` | Incoraggiante | `[slow]` | Lento |
| `[excited]` | Eccitato | `[struggling]` | In difficoltà |
| `[fast]` | Veloce | `[surprised]` | Sorpreso |
| `[fearful]` | Timoroso | `[suspicious]` | Sospettoso |
| `[frustrated]` | Frustrato | `[sympathetic]` | Comprensivo |
| `[happy]` | Felice | `[terrified]` | Terrorizzato |
| `[hesitant]` | Esitante | `[upset]` | Sconvolto |
| `[hurt]` | Ferito | `[urgent]` | Urgente |
| `[impatient]` | Impaziente | `[whispering]` | Sussurrato |
| `[impressed]` | Impressionato | | |
| `[intrigued]` | Incuriosito | | |
| `[joking]` | Scherzoso | | |
| `[laughing]` | Che ride | | |

Il marcatore va scritto sempre in inglese esattamente com'è (minuscolo): è un'istruzione per il modello, non viene letto ad alta voce.

## Sviluppo locale

```bash
npm install
npm run dev          # dev server su localhost
npm run dev:host      # dev server raggiungibile anche da altri dispositivi in rete locale
npm run build         # build di produzione in dist/
npm run preview       # serve la build di produzione in locale
```

Richiede Node.js 20+.

## Configurare Azure Neural TTS

1. Nel [portale Azure](https://portal.azure.com), crea una risorsa "Servizi voce" (Speech). Il piano gratuito F0 include 500.000 caratteri/mese.
2. Copia la chiave e la regione dalla pagina "Chiavi ed endpoint" della risorsa.
3. Nell'app, passa al motore "Azure Neural", seleziona la stessa regione e incolla la chiave.

## Deploy

Il push su `main` attiva automaticamente il workflow GitHub Actions in `.github/workflows/deploy.yml`, che builda il progetto e pubblica `dist/` su GitHub Pages.

I file audio per il sottofondo vanno caricati in `public/audio/`: il menu "Audio di sottofondo" dell'app li legge dinamicamente tramite l'API pubblica di GitHub, senza bisogno di modificare il codice.

## Struttura del progetto

```
index.html          punto di ingresso, markup dell'interfaccia
src/main.ts          logica dell'app, stato, gestione UI
src/azureTts.ts       integrazione Azure Speech SDK, costruzione SSML, playback
src/style.css         stili
public/audio/         file mp3 per il sottofondo (letti dinamicamente da GitHub)
.github/workflows/    workflow di deploy su GitHub Pages
```

## Stack tecnico

- [Vite](https://vitejs.dev/) + TypeScript, nessun framework UI
- [microsoft-cognitiveservices-speech-sdk](https://www.npmjs.com/package/microsoft-cognitiveservices-speech-sdk) per l'integrazione Azure
- Nessun backend: tutte le chiamate (Azure Speech, API GitHub) partono direttamente dal browser
