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
