# Carichi dei macchinari per comune

Il catalogo distingue `machine`, `barbell` e `dumbbell`; il nuovo tipo conserva il passo di 2,5 kg. I vecchi override del catalogo che usavano il tipo misto bilanciere/macchina sono compatibili. Le modifiche esplicite nuove salvano `machineTypeVersion: 1`. Per esercizi personalizzati il tipo è selezionabile nelle impostazioni.

Al primo allenamento viene offerto un tutorial di tre schermate. Rilevazione della località e adattamento dei carichi sono due preferenze: si possono registrare località senza adattamento. Il filtro nei Progressi resta disponibile per tutti i macchinari, indipendentemente dalla preferenza. Bilancieri, manubri ed esercizi a corpo libero non hanno filtro.

La località è risolta da GPS corrente, solo con consenso, tramite l’API client di BigDataCloud. La schermata di consenso spiega l’invio di posizione e IP al servizio e rimanda alla sua documentazione. Non si usano IP come alternativa, coordinate storiche o tracciamento continuo. Nell’app persistono solo identificatore, comune, regione e nazione; nessuna coordinata. Il servizio richiede HTTPS (localhost è ammesso) e connettività; in caso di rifiuto, timeout o errore la seduta prosegue senza località e senza presumere una palestra.

Riferimento del servizio: https://www.bigdatacloud.com/docs/article/why-is-reverse-geocoding-api-free

Il modello associa un comune a una palestra: più palestre nello stesso comune condividono lo storico. I nomi personalizzati sono alias della località e non ne cambiano l’identità. Le sessioni precedenti all’aggiornamento restano senza località.

Quando l’adattamento è attivo, prima di conoscere la località i carichi dei macchinari restano vuoti. La risposta GPS completa solo campi ancora vuoti, senza sovrascrivere valori inseriti manualmente o serie completate. Risposte tardive non vengono attribuite ad altre sedute. PR, ultima serie, valutazione del sovraccarico e confronti di Scienza usano la stessa località per i macchinari; i pesi liberi conservano i confronti globali. I volumi settimanali continuano a sommare tutte le località.

Nei Progressi rimane un solo grafico generale, con filtro e rinomina tramite icona. Delta e nuovi record dei macchinari vengono confrontati all’interno della stessa località anche nella vista generale; il tooltip indica la località dei punti.
