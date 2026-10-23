import { useState } from 'react';
import { Check, Lightbulb } from 'lucide-react';
import { useStore } from '../store/useStore';
import { isTrainingRecovery, reminderDue } from '../utils/trainingReminder';
import './TrainingReminder.css';

export default function TrainingReminder({ workout }) {
  const reminder = useStore(s => s.trainingReminder);
  const recovery = useStore(isTrainingRecovery);
  const acknowledge = useStore(s => s.acknowledgeTrainingReminder);
  const [enteredAt] = useState(() => Date.now());
  if (!reminderDue(reminder,workout,enteredAt,recovery)) return null;
  return <aside className="training-reminder" aria-labelledby="working-sets-title"><span className="training-reminder-icon"><Lightbulb size={22} /></span><div><span className="training-reminder-label">PRIMA DI COMINCIARE</span><h2 id="working-sets-title">Conta le serie che fanno lavorare davvero.</h2><p>Fuori dallo scarico, segna come allenanti solo le serie che finiscono così:</p><div className="training-reminder-examples"><span><b>0</b><span><strong>Non riesci a farne un’altra pulita.</strong><small>È il cedimento. Il movimento resta corretto.</small></span></span><span><b>1</b><span><strong>Ne faresti ancora una, poi basta.</strong><small>Una sola ripetizione pulita rimasta.</small></span></span></div><p className="training-reminder-note">Se potresti farne ancora 2 o più, non contarla tra le serie allenanti. Il riscaldamento serve a prepararti: resta fuori da questo conteggio. Niente ripetizioni storte per arrivare a zero.</p><button type="button" onClick={() => acknowledge(Date.now())}>Ok, tutto chiaro<Check size={16} /></button></div></aside>;
}
