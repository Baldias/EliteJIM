export const RELEASE_NOTES_VERSION = '1.5';

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

export function releaseNotesFor(previousVersion) {
  const match = String(previousVersion || '').match(/^(\d+)\.(\d+)(?:\.\d+)?$/);
  const alreadySaw14 = match && (Number(match[1]) > 1 || Number(match[1]) === 1 && Number(match[2]) >= 4);
  return [{ version: '1.5', changes: changes15 }, ...(!alreadySaw14 ? [{ version: '1.4', changes: changes14 }] : [])];
}
