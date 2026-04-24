# Informativa Privacy — Bookmark Tidy bwlab

**Ultima revisione**: 2026-04-24

## Sommario

Bookmark Tidy bwlab è un'estensione Chrome che opera **interamente in locale sul dispositivo dell'utente**. Non raccoglie, trasmette, vende o condivide dati personali di alcun tipo.

## Dati a cui l'estensione accede

L'estensione richiede i seguenti permessi Chrome:

- **`bookmarks`**: per leggere, modificare, creare ed eliminare i preferiti del browser. Tutte le operazioni passano dall'API ufficiale `chrome.bookmarks` e restano sul dispositivo. Se l'utente ha la sincronizzazione Chrome attiva, le modifiche sono sincronizzate da Google ai suoi altri device — questo avviene tramite l'infrastruttura di sync di Chrome, non tramite server di terze parti gestiti da noi.
- **`tabs`**: per aprire la pagina del Bookmark Manager in una nuova tab quando l'utente clicca l'icona o usa la scorciatoia da tastiera.

## Dati raccolti, trasmessi o venduti

**Nessuno.** L'estensione non:

- Invia dati a server esterni
- Utilizza analytics, telemetria o tracker
- Vende o condivide informazioni con terze parti
- Memorizza credenziali, password o informazioni di pagamento

## Servizi esterni

L'unica connessione a Internet effettuata dall'estensione è il caricamento delle **favicon** dei siti dei preferiti dal servizio pubblico Google `https://www.google.com/s2/favicons`. Questa richiesta avviene direttamente dal browser dell'utente verso Google e non passa da server di bwlab.

## Memorizzazione locale

L'estensione utilizza `localStorage` del browser per memorizzare la preferenza di tema (chiaro/scuro). Nessun altro dato è persistito.

## Codice sorgente

Il codice sorgente è pubblico e ispezionabile su https://github.com/bwlab/bookmark-tidy

## Contatti

Per domande: [info@bwlab.it](mailto:info@bwlab.it)
