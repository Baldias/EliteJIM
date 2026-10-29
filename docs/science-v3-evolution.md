# Scienza V3.0: aggiornamento e compatibilità

## Passaggio immediato da V2

L’introduzione compare al primo ingresso in Scienza per chi ha un protocollo V2 attivo o preparato. La compressione della schermata dura 4,6 secondi; è saltabile e rispetta il movimento ridotto. Alla fine si passa al vero motore e alla dashboard V3, nella settimana corrente. Anche chi aveva già visto la vecchia introduzione viene trasferito al successivo ingresso.

`scienceReport` resta identico, archiviato con snapshot dei vecchi conteggi. Il marcatore `scienceState.legacyMigration` disattiva il motore V2. Le vecchie settimane 1–4 diventano W1–4; le settimane 5–8 diventano W1–4 del secondo blocco; le settimane successive entrano nella fase di recupero V3. La UI spiega la corrispondenza. Non si ricomincia da zero. I protocolli preparati rimangono da avviare esplicitamente.

Le serie ordinarie già svolte hanno un’identità nel sidecar: rimangono nei progressi come “riportate da V2”. Se il RIR è sconosciuto, non diventano serie confermate a cedimento. Il contatore visivo somma confermate e riportate; il motore degli aumenti usa solo le nuove informazioni confermate. Annotare dopo una serie importata non la conta due volte. Riscaldamento, drop set, rest-pause e serie escluse rimangono nello storico ma non entrano nei nuovi target. Dashboard, recap, distribuzione per seduta, scadenza e report condiviso usano lo stesso contatore.

La migrazione non tocca log, PR, XP, XP muscolari, streak o formule del sovraccarico. Per le future sedute, la formula XP riceve il contesto di recupero attuale anziché restare ancorata per sempre allo scarico V2. Lo scarico V2 già in corso non viene ridotto una seconda volta.

## Nuova tabella di riferimento (versione 3 delle basi)

La tabella fornita dall’utente è il riferimento di prodotto in `scienceReferences.js`. Il MEV iniziale è uguale per tutti i livelli: petto/dorso 10; quadricipiti, polpacci, spalle e bicipiti 8; femorali e tricipiti 6. Addome e glutei hanno MEV di riferimento 0 nella tabella, ma una dose diretta iniziale positiva di prodotto (6 e 4) se attivi. Collo e avambracci, non presenti nella tabella, sono opzionali e partono da 2. Le spalle restano un distretto unico, usando la riga deltoidi laterali/posteriori come riferimento per il lavoro diretto.

Il livello seleziona il punto basso, medio o alto del MAV della tabella, senza creare tre MEV diversi. Per esempio: spalle 16/19/22, dorso 14/18/22. La colonna MRV è aperta (“+”): per inizializzare un limite dell’automatismo usiamo il valore indicato, +2 o +4 serie secondo il livello. Sono scelte del prodotto, non differenze tra livelli dimostrate da studi. `mrvEstimate` resta distinto dal MRV personale osservato, inizialmente non determinato.

La letteratura sostiene una relazione dose-risposta media con rendimenti decrescenti; non convalida una tabella universale per muscolo, un MEV biologico identico per tutti, né la necessità di raggiungere sempre il massimo. RP stesso descrive i landmark come riferimenti da individualizzare. La guida RP include 0–4 RIR, mentre l’app segue il protocollo concordato 0–1 RIR. I risultati con conteggio frazionario delle serie indirette non vanno trasposti automaticamente a target di sole serie dirette. Il lavoro indiretto è mostrato separatamente.

Fonti:
- [RP: Training Volume Landmarks](https://rpstrength.com/blogs/articles/training-volume-landmarks-muscle-growth)
- [Pelland et al.: dose-risposta di volume e frequenza, 2026](https://pubmed.ncbi.nlm.nih.gov/41343037/)
- [Baz-Valle et al.: revisione su uomini allenati, 2022](https://pubmed.ncbi.nlm.nih.gov/35291645/)

## Storico ponderato e tempo

`stima = arrotonda(base comune + peso × (mediana storico − base))`

La mediana deriva da almeno due settimane complete e fino a quattro rappresentative nelle otto precedenti, escluse le fasi di recupero identificabili. La stima non scende sotto la base ed è limitata inizialmente dal punto MAV del livello. Lo storico non assegna automaticamente 22 serie di dorso a un principiante.

| Esperienza | Sforzo/recupero incerti | Dati affidabili |
|---|---:|---:|
| Principiante | 15% | 30% |
| Intermedio | 25% | 45% |
| Avanzato | 35% | 60% |

Sono pesi del prodotto. “Affidabili” richiede almeno l’80% di serie ordinarie confermate a 0–1 RIR, due feedback positivi e assenza di fatica generale segnalata. Un principiante con mediana di 22 serie di dorso e 14 di spalle senza RIR parte da 12 e 9. Senza storico: 10 e 8. Il quiz non chiede più i mesi continuativi.

Quattro minuti per serie servono solo per stimare il tempo. Una normale discrepanza produce un avviso e conserva i target. Solo senza storico e con budget inferiore al 60% del fabbisogno stimato si applica una riduzione proporzionale, esplicitamente segnalata come forte carenza di tempo, eventualmente sotto MEV.

L’accumulo usa recupero, qualità, completamento e prestazioni confrontabili. L’esperienza non limita più il principiante a +1 serie: gli incrementi tendono al riferimento MAV, con massimo +2 o +3 se i dati di qualità sono particolarmente buoni. La crescita complessiva è contenuta entro circa il 10% della dose iniziale per aggiornamento. I riferimenti non garantiscono di raggiungere simultaneamente il MAV di ogni muscolo in un blocco. Le priorità guidano l’allocazione. Eventuali trasferimenti nelle ultime due settimane richiedono consenso e non scendono sotto MEV. Fatica e dolore producono consigli; riduzioni, pause e scarico richiedono la scelta dell’utente.

## Tolleranza ai segnali lievi durante l’accumulo

Per i distretti target in specializzazione l’aumento è la scelta predefinita quando è stato completato almeno l’80% del target, anche senza RIR e senza un check perfetto. “Solo in parte”, qualche serie meno pulita, stanchezza lieve e fastidi lievi con movimento normale permettono +1 serie. Un singolo check negativo isolato non blocca automaticamente l’accumulo. Senza segnali negativi il passo resta fino a +2, oppure +3 con serie confermate, almeno due esposizioni e feedback completamente positivo.

Il blocco per recupero scatta con dolore che limita il movimento, fatica generale marcata in almeno due sedute, due check con recupero o qualità nettamente insufficienti, recupero insufficiente e qualità marcatamente scadente nello stesso check, oppure calo ripetuto delle prestazioni accompagnato da almeno un check nettamente negativo. Le risposte storiche booleane positive su dolore/fatica sono conservate; i nuovi check distinguono esplicitamente il livello lieve. Il RIR migliora la lettura delle prestazioni e la fiducia nei landmark, ma non è un requisito per l’aumento ordinario.

Restano il budget globale del 10%, le soglie di volume, le settimane W1–W4 di accumulo e W5 di recupero. In specializzazione i distretti fuori priorità non ricevono aumenti: conservano la base, con eventuali trasferimenti solo accettati e mai sotto MEV. Le nuove regole si applicano alla prossima chiusura senza riscrivere lo storico o annullare pause già accettate.

## Percorso completo: MAV basso e budget per seduta

Il percorso `balanced`, senza priorità specializzate, parte dal valore basso del MAV di ogni distretto nella tabella. La partenza non viene aumentata automaticamente dalla mediana storica. Il tetto degli obiettivi è `20 × sedute previste`, anche nelle stime, negli aumenti successivi e nell’editor manuale. A parità di disponibilità il volume viene ripartito per avanzamento proporzionale da MEV verso MAV basso, con un piccolo ritardo per polpacci, addome e femorali.

Se non entrano nemmeno tutti i MEV, il tetto prevale: si riducono prima questi tre distretti, anche sotto MEV. Solo con disponibilità estremamente ridotta si toccano anche gli altri. I distretti attivi conservano almeno una serie quando possibile; nessun log completato viene rimosso per far rientrare il volume.

Gli aumenti privilegiano recupero buono e carichi confrontabili in crescita. A tetto pieno le differenze tra distretti possono spostare una serie per muscolo donatore per aggiornamento verso quelli con risposta migliore. Con segnali equivalenti non si inventano differenze e le stime future non simulano trasferimenti arbitrari. Il budget di cambiamento resta graduale, intorno al 10% della base iniziale. Lo scarico rimane una proposta da accettare.

La politica si applica una volta anche ai protocolli completi attivi, conservando settimane archiviate e dati originali. Cambiare le sedute previste riduce i target correnti se necessario per il nuovo tetto; aumentare la disponibilità non inventa nuove serie già completate. Il percorso di specializzazione conserva la sua base e i suoi automatismi: prima usa il budget disponibile, poi propone eventuali trasferimenti necessari dalle altre basi.

## Aggiornamento obbligatorio dei protocolli V3 esistenti

Come richiesto, il primo caricamento aggiorna anche i protocolli già compilati, senza ripetere il quiz. `startingDoseVersion = 3` rende l’operazione idempotente, anche dopo ripristino. Si ricalcola la base e si conservano gli incrementi positivi già maturati; date, settimana e settimane archiviate restano intatte. Gli obiettivi impostati manualmente e il recupero già accettato non sono annullati. I riferimenti vengono aggiornati anche in recupero. I nuovi valori e le variazioni sono salvati nel sidecar; la UI segnala l’aggiornamento.

Un profilo esplicitamente uomo esclude i glutei dal budget e dalle priorità; nessuna deduzione da nomi o altri dati. La scelta viene chiesta nel quiz. I vecchi log e gli snapshot dei glutei restano conservati.

## Altri flussi e verifiche

La scelta del tema viene riproposta una volta a tutti con `themeChoiceVersion = 2`. Il report richiede sole progressioni oppure progressioni + Scienza, in fondo, con tutte le settimane e lo stile scelto. Il promemoria delle serie allenanti usa tre conferme in sedute distinte, dopo due e poi sette giorni. Le attivazioni Diario/Scienza e la creazione del protocollo mantengono le brevi transizioni.

Tutti i dati nuovi sono nello stato scientifico e nei backup normali e di emergenza. I vecchi backup caricano uno stato scientifico vuoto. Le prove mobili usano demo e backup fittizi, isolati dai dati reali.

Vitest verifica basi comuni, storico ponderato, stime per livello, forte carenza di tempo, aggiornamento automatico e ripetuto, recupero accettato, migrazione immediata, conteggi coerenti, identità mancanti, buffer V2, settimane prolungate, backup, gamification e progressioni. La build e i controlli visivi mobile completano la verifica.
