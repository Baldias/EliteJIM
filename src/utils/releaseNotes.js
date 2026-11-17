export const RELEASE_NOTES_VERSION = '1.6';

const changes14 = [
  ['Allenamento', [
    'Aggiunto a ogni esercizio un pulsante con icona per aprire direttamente i suoi progressi, mantenendo attiva la sessione.',
  ]],
  ['Progressi', [
    'Corretta la digitazione nella barra di ricerca degli esercizi.',
    'Aggiunto lo storico delle serie settimanali per distretto muscolare, con media, totale e massimo settimanale.',
    'Aggiunti gli intervalli 3 mesi, 6 mesi, 1 anno, Max e Personalizzato.',
    'Corretto il calcolo della media: esclude le settimane fuori dallo storico registrato e comprende le settimane vuote tra gli allenamenti.',
    'Spostati i livelli RPG e gli XP in fondo alla pagina del distretto.',
  ]],
  ['Scienza', [
    'Le serie completate vengono conteggiate anche quando il RIR non è stato registrato.',
    'Nei percorsi con priorità muscolari, i segnali lievi di stanchezza consentono incrementi graduali; segnali marcati o ripetuti possono sospendere l’aumento.',
    'Nei percorsi per tutto il corpo, la partenza usa il MAV basso come riferimento, adattato alla disponibilità di allenamento e al limite di 20 serie per seduta.',
    'Quando il budget settimanale non basta, il volume viene ridotto prima su polpacci, addome e femorali, anche sotto MEV se necessario. Recupero e andamento dei carichi guidano gli aumenti e la distribuzione successivi.',
    'Aggiunta nel check la distinzione tra stanchezza o fastidi lievi e problemi marcati.',
    'Rimossi i banner gialli dalla dashboard Scienza.',
    'Spostati “Ultimo aggiornamento” e “Mesocicli e decisioni precedenti” sotto la card “Quante serie per seduta”.',
    'Semplificata la card delle sedute e aggiunto un pulsante ? per consultarne la spiegazione.',
  ]],
];

const changes15 = [
  ['Palestre e macchinari', [
    'Aggiunta la rilevazione facoltativa del comune tramite GPS, con consenso e salvataggio della sola località.',
    'Un unico grafico generale nei Progressi, filtrabile per località solo per i macchinari. Un’icona di modifica permette di rinominare la località con il nome della palestra.',
    'Adattamento facoltativo dei carichi suggeriti e dei PR dei macchinari allo storico della stessa località. Bilancieri e manubri mantengono lo storico generale.',
    'Aggiunto un tutorial al primo allenamento e nuove preferenze nelle Impostazioni per attivare o disattivare la funzione.',
    'Se la posizione non è disponibile, la seduta può proseguire senza attribuire una palestra presunta. Gli allenamenti precedenti restano senza località.',
  ]],
  ['Scienza', [
    'Aggiunto un conto alla rovescia in giorni, ore e minuti fino alla fine della settimana e un anello con le serie mancanti all’obiettivo.',
    'Spostata la frase “Il volume cresce con la tua capacità di recuperare” sotto il titolo Scienza.',
    'Il popup di fine settimana compare al massimo una volta al giorno, anche riaprendo l’app.',
  ]],
  ['Allenamento', [
    'Le sedute vengono salvate automaticamente dopo un’ora senza modifiche, con l’orario dell’ultima modifica come fine dell’allenamento.',
    'Se l’app è chiusa, la chiusura viene recuperata alla riapertura mantenendo l’orario corretto.',
  ]],
];

const changes16 = [
  ['Schede e Splits', [
    'Aggiunto il generatore guidato “Splits” in Nuova Scheda per 2–6 allenamenti settimanali.',
    'Selezione rapida degli esercizi su una sola pagina con gli esercizi più usati in evidenza, Addome e Glutei opzionali, Polpacci da 1 esercizio e Glutei nascosti per gli uomini.',
    'Ordinamento automatico di ogni seduta dai distretti muscolari più grandi ai più piccoli e dai multiarticolari all’isolamento.',
    'Sincronizzazione dinamica con Scienza: bilancia e scala automaticamente le serie sulle sedute rimanenti della settimana; le schede completate diventano verdi con badge Fatta e aprono il riepilogo della sessione svolta.',
    'Archivio nascosto delle vecchie schede in fondo alla Home, svelabile con overscroll verso il basso stile WhatsApp.',
  ]],
  ['Progressi', [
    'Aggiunti gli intervalli temporali 1M, 3M, 6M, 1A e Max anche nei progressi dei singoli esercizi.',
    'Aggiunta la variazione percentuale dell’1RM nel periodo calcolata con media mobile sulle prime 3 e ultime 3 sessioni.',
    'Schedina fissa sopra il grafico (mai sopra i puntini) con note e drop set subito visibili in hover; click sul grafico o sulla schedina per aprire l’allenamento con gli altri esercizi attenuati.',
  ]],
  ['Diario e Peso', [
    'Aggiunta la lista dei cibi più frequenti sotto i pasti, filtrata per pasto (con Pranzo e Cena unificati) e con dose abituale già precompilata.',
    'Corretto il doppio tocco sulla spunta verde nella ricerca alimenti: ora rimuove la voce invece di riaggiungerla.',
    'Tendenza del peso calcolata come media mobile a 7 giorni sui soli giorni con pesata registrata.',
  ]],
  ['Allenamento', [
    'Timer di recupero predefinito tra le serie portato da 1:00 a 1:30.',
  ]],
];

export function releaseNotesFor(previousVersion) {
  const match = String(previousVersion || '').match(/^(\d+)\.(\d+)(?:\.\d+)?$/);
  const major = match ? Number(match[1]) : 0;
  const minor = match ? Number(match[2]) : 0;
  const alreadySaw15 = major > 1 || (major === 1 && minor >= 5);
  const alreadySaw14 = major > 1 || (major === 1 && minor >= 4);
  return [
    { version: '1.6', changes: changes16 },
    ...(!alreadySaw15 ? [{ version: '1.5', changes: changes15 }] : []),
    ...(!alreadySaw14 ? [{ version: '1.4', changes: changes14 }] : []),
  ];
}
