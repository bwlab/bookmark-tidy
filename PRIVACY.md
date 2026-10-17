# Informativa Privacy — Bookmark Tidy bwlab

**Ultima revisione**: 2026-10-16

## Sommario

Bookmark Tidy bwlab è un'estensione Chrome che opera **interamente in locale sul dispositivo dell'utente**. Non raccoglie, trasmette, vende o condivide dati personali di alcun tipo.

## Dati a cui l'estensione accede

L'estensione richiede i seguenti permessi Chrome:

- **`bookmarks`**: per leggere, modificare, creare ed eliminare i preferiti del browser. Tutte le operazioni passano dall'API ufficiale `chrome.bookmarks` e restano sul dispositivo. Se l'utente ha la sincronizzazione Chrome attiva, le modifiche sono sincronizzate da Google ai suoi altri device — questo avviene tramite l'infrastruttura di sync di Chrome, non tramite server di terze parti gestiti da noi.
- **`tabs`**: per aprire la pagina del Bookmark Manager in una nuova tab quando l'utente clicca l'icona o usa la scorciatoia da tastiera.
- **`favicon`** (solo Chrome): per mostrare l'icona dei siti salvati leggendola dalla cache locale di Chrome, senza richieste di rete. La versione Firefox non chiede questo permesso e mostra al suo posto l'iniziale del dominio.

## Dati raccolti, trasmessi o venduti

**Nessuno.** L'estensione non:

- Invia dati a server esterni
- Utilizza analytics, telemetria o tracker
- Vende o condivide informazioni con terze parti
- Memorizza credenziali, password o informazioni di pagamento

## Servizi esterni

**Nessuno.** L'estensione non effettua connessioni a Internet in autonomia. Il pulsante "Offrimi un caffè" è un normale link che apre `https://buymeacoffee.com/bwlab` in una nuova scheda solo quando l'utente lo clicca; nessun dato dell'estensione viene inviato. In Chrome le favicon dei siti vengono lette dalla cache locale del browser tramite il permesso `favicon`; in Firefox non vengono caricate affatto.

## Memorizzazione locale

L'estensione utilizza `localStorage` del browser per memorizzare la preferenza di tema (chiaro/scuro). Nessun altro dato è persistito.

## Codice sorgente

Il codice sorgente è pubblico e ispezionabile su https://github.com/bwlab/bookmark-tidy

## Contatti

Per domande: [info@bwlab.it](mailto:info@bwlab.it)
