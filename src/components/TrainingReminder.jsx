import { useState } from 'react';
import { Check, Lightbulb } from 'lucide-react';
import { useStore } from '../store/useStore';
import { isTrainingRecovery, reminderDue } from '../utils/trainingReminder';
import './TrainingReminder.css';
import { tr } from '../i18n';

export default function TrainingReminder({ workout }) {
  const reminder = useStore(s => s.trainingReminder);
  const recovery = useStore(isTrainingRecovery);
  const acknowledge = useStore(s => s.acknowledgeTrainingReminder);
  const [enteredAt] = useState(() => Date.now());
  if (!reminderDue(reminder,workout,enteredAt,recovery)) return null;
  return <aside className="training-reminder" aria-labelledby="working-sets-title"><span className="training-reminder-icon"><Lightbulb size={22} /></span><div><span className="training-reminder-label">{tr('PRIMA DI COMINCIARE')}</span><h2 id="working-sets-title">{tr('Conta le serie che fanno lavorare davvero.')}</h2><p>{tr('Fuori dallo scarico, segna come allenanti solo le serie che finiscono così:')}</p><div className="training-reminder-examples"><span><b>0</b><span><strong>{tr('Non riesci a farne un’altra pulita.')}</strong><small>{tr('È il cedimento. Il movimento resta corretto.')}</small></span></span><span><b>1</b><span><strong>{tr('Ne faresti ancora una, poi basta.')}</strong><small>{tr('Una sola ripetizione pulita rimasta.')}</small></span></span></div><p className="training-reminder-note">{tr('Se potresti farne ancora 2 o più, non contarla tra le serie allenanti. Il riscaldamento serve a prepararti: resta fuori da questo conteggio. Niente ripetizioni storte per arrivare a zero.')}</p><button type="button" onClick={() => acknowledge(Date.now())}>{tr('Ok, tutto chiaro')}<Check size={16} /></button></div></aside>;
}
