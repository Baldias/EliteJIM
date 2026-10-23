# Scienza V3.0: aggiornamento e compatibilità

L’introduzione compare al primo ingresso in Scienza per chi ha un protocollo V2 attivo o preparato. La compressione della schermata dura 4,6 secondi; è saltabile e rispetta la preferenza di movimento ridotto. Quattro passaggi spiegano continuità, storico, qualità e controllo dell’utente. La conferma è persistita in `scienceState.releaseV3`, inclusa nei backup.

I protocolli V2 conservano calendario, settimana e regole di conteggio storiche. Le proposte per la settimana successiva usano fino a quattro settimane rappresentative concluse, con intervalli salvati prioritari. Settimane sovrapposte, inferiori a cinque o superiori a nove giorni non diventano dosi settimanali rappresentative. Accettazione e rifiuto sono registrati nel sidecar; `scienceReport` resta originale. Recap e report condiviso usano la stessa vista dei target accettati. Le formule XP continuano a leggere il report originale.

## Stima iniziale ponderata

Il precedente `max(dose, mediana storico)` poteva trasformare volumi elevati registrati in dosi iniziali automatiche, anche per principianti. Ora:

`stima = arrotonda(base per esperienza + peso × (mediana storico − base))`

La stima conserva la base minima per esperienza; lo spostamento massimo iniziale è +2 serie per principianti, +4 per intermedi, +8 per avanzati. Sono limiti del prodotto per la partenza, non MRV biologici né limiti all’intero mesociclo.

| Esperienza | Storico con sforzo/recupero incerti | Storico con dati affidabili |
|---|---:|---:|
| Principiante | 15% | 30% |
| Intermedio | 25% | 45% |
| Avanzato | 35% | 60% |

“Affidabili” richiede almeno l’80% di serie ordinarie confermate a 0–1 RIR, almeno due feedback muscolari positivi e nessuna segnalazione di fatica generale nella finestra. Non dimostra da solo che quel volume sia ottimale. La mediana richiede almeno due settimane. Senza storico il peso è zero. Per esempio, un principiante con 22 serie di dorso e 14 di spalle senza RIR parte rispettivamente da 8 e 6, non da 22 e 14.

Queste percentuali sono scelte di programmazione del prodotto. RP presenta i landmark come riferimenti da individualizzare, non come soglie universali o percentuali validate: https://rpstrength.com/blogs/articles/training-volume-landmarks-muscle-growth e https://rpstrength.com/blogs/articles/back-hypertrophy-training-tips . Le dosi dell’app riguardano il protocollo concordato a 0–1 RIR; la guida RP comprende anche sforzi meno vicini al cedimento.

Una partenza V3 precedente eccessiva per principianti può essere corretta in settimana uno con accettazione esplicita. Restano invariati ID, data iniziale, storico, XP e obiettivi manuali. Il rifiuto conserva i volumi.

## Altri flussi

- La scelta del tema viene riproposta una volta a tutti con `themeChoiceVersion = 2`, senza cambiare i dati. Poi resta disponibile nel Profilo.
- Il report richiede la scelta tra sole progressioni o progressioni + Scienza. Scienza resta in fondo, con tutte le 5 settimane V3 o 12 V2: quelle future sono stime. La palette e il bagliore seguono il tema catturato all’apertura. Le icone riusano la stessa anatomia della mappa dell’app.
- Il promemoria sulle serie allenanti compare sopra gli esercizi. Tre conferme, in sedute distinte: prima esposizione, prima seduta utile dopo due giorni, poi dopo sette. La cadenza è una scelta del prodotto. Lo scarico accettato sospende le esposizioni senza consumarle. Nessun cambio di RIR, log o XP. Stato incluso anche nel backup di emergenza.
- Le attivazioni Diario/Scienza hanno una transizione di 700 ms; la creazione/ripetizione del protocollo 850 ms. Doppio invio bloccato, timer annullato allo smontaggio; nessuna percentuale fittizia di avanzamento.

## Verifiche

Vitest copre isolamento dei dati, continuità, idempotenza, backup, target accettati/rifiutati, fatica senza blocchi, formule di partenza, temi, tutte le settimane del report e ripetizione dilazionata attraversando il cambio dell’ora. Le prove mobili usano esclusivamente demo e backup fittizi.
