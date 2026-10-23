import React, { useState } from 'react';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { resolveBodyweight } from '../../utils/oneRepMax';
import {
  ACTIVITY_LEVELS, TRAINING_LEVELS, PHASES, MACROS, energyBreakdown, macroGoalsInGrams, macrosFor, phaseForRate,
  toDateKey, fmtInt, fmtDec
} from '../../utils/nutrition';
import { Sheet } from './Sheet';

const STEPS = ['intro', 'sex', 'body', 'bodyFat', 'activity', 'training', 'goal', 'target', 'result'];
const toNum = (v) => parseFloat(String(v).replace(',', '.'));
const between = (v, min, max) => v >= min && v <= max;
const fmtRate = (r) => `${r > 0 ? '+' : '−'}${Math.abs(r).toLocaleString('it-IT')} kg a settimana`;

function Option({ active, onClick, title, desc }) {
  return (
    <button type="button" className={`mn-option ${active ? 'is-active' : ''}`} onClick={onClick} aria-pressed={active}>
      <strong>{title}</strong>
      {desc && <span>{desc}</span>}
    </button>
  );
}

function NumberField({ label, unit, value, onChange, placeholder }) {
  return (
    <label className="mn-numfield">
      <span>{label}</span>
      <div>
        <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        <small>{unit}</small>
      </div>
    </label>
  );
}

// Test iniziale del Diario: poche domande → calorie e macro su misura
export function SetupWizard({ onClose }) {
  const goals = useStore(state => state.nutritionGoals);
  const bodyweight = useStore(resolveBodyweight);
  const completeDietSetup = useStore(state => state.completeDietSetup);
  const postponeDietSetup = useStore(state => state.postponeDietSetup);
  const isFirstTime = useStore(state => !state.dietSetup?.completedAt);

  const prev = goals?.profile || {};
  const [step, setStep] = useState(0);
  const [a, setA] = useState({
    sex: prev.sex || null,
    age: prev.age || '',
    height: prev.height || '',
    weight: bodyweight ? String(bodyweight).replace('.', ',') : '',
    bodyFat: prev.bodyFat ? String(prev.bodyFat) : '',
    activity: prev.activity || null,
    training: prev.training || null,
    rate: goals?.weeklyGoal ?? null,
    targetWeight: goals?.targetWeight ? String(goals.targetWeight).replace('.', ',') : '',
  });
  const set = (patch) => setA(s => ({ ...s, ...patch }));

  const id = STEPS[step];
  const weight = toNum(a.weight);
  const bodyFat = toNum(a.bodyFat);
  const phase = a.rate == null ? null : phaseForRate(a.rate);
  const target = toNum(a.targetWeight);

  const valid = {
    intro: true,
    sex: !!a.sex,
    body: between(toNum(a.age), 14, 99) && between(toNum(a.height), 120, 230) && between(weight, 30, 300),
    bodyFat: !a.bodyFat || between(bodyFat, 4, 59),
    activity: !!a.activity,
    training: !!a.training,
    goal: a.rate != null,
    target: !a.targetWeight || between(target, 30, 300),
    result: true,
  }[id];

  const energy = energyBreakdown({ ...a, weight, bodyFat, weeklyGoal: a.rate ?? 0 });
  const macros = macrosFor(phase || 'maintain', a.training);
  const plan = energy ? macroGoalsInGrams({ kcal: energy.kcal, ...macros }, weight) : null;

  const next = () => setStep(s => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep(s => Math.max(0, s - 1));
  const later = () => { if (isFirstTime) postponeDietSetup(); onClose(); };

  const save = () => {
    completeDietSetup({
      kcal: energy.kcal,
      ...macros,
      weeklyGoal: a.rate,
      targetWeight: between(target, 30, 300) ? Math.round(target * 10) / 10 : null,
      profile: { sex: a.sex, age: a.age, height: a.height, activity: a.activity, training: a.training, bodyFat: between(bodyFat, 4, 59) ? bodyFat : null },
    }, { date: toDateKey(), kg: weight });
    onClose();
  };

  // suggerimento per il peso obiettivo: ~5% nella direzione della fase
  const suggestedTarget = phase === 'cut' ? weight * 0.95 : phase === 'bulk' ? weight * 1.05 : weight;

  const footer = id === 'intro' ? (
    <div className="mn-wizard-foot">
      <button type="button" className="mn-cta" onClick={next}>Iniziamo</button>
      <button type="button" className="mn-wizard-later" onClick={later}>Più tardi</button>
    </div>
  ) : (
    <div className="mn-wizard-foot is-row">
      <button type="button" className="mn-wizard-back" onClick={back} aria-label="Indietro"><ChevronLeft size={20} /></button>
      {id === 'result'
        ? <button type="button" className="mn-cta" onClick={save}>Salva il mio piano</button>
        : <button type="button" className="mn-cta" disabled={!valid} onClick={next}>
            {(id === 'bodyFat' && !a.bodyFat) || (id === 'target' && !a.targetWeight) ? 'Salta' : 'Avanti'}
          </button>}
    </div>
  );

  return (
    <Sheet title="Il tuo piano" onClose={later} full footer={footer}>
      <div className="mn-wizard">
        {id !== 'intro' && (
          <div className="mn-wizard-progress" aria-label={`Passo ${step} di ${STEPS.length - 1}`}>
            <span style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} />
          </div>
        )}

        {id === 'intro' && (
          <div className="mn-wizard-intro">
            <span className="mn-wizard-badge"><Sparkles size={26} /></span>
            <h2>Calcoliamo il tuo piano</h2>
            <p>Sette domande, meno di un minuto. Da qui ricavo calorie e macro su misura per te e per il tuo obiettivo.</p>
            <p className="mn-hint">Potrai cambiarli quando vuoi, o rifare il test da “I tuoi obiettivi”.</p>
          </div>
        )}

        {id === 'sex' && (
          <>
            <h2 className="mn-wizard-q">Sesso biologico</h2>
            <p className="mn-wizard-help">Serve solo al calcolo del metabolismo.</p>
            <div className="mn-options">
              <Option active={a.sex === 'male'} onClick={() => { set({ sex: 'male' }); next(); }} title="Uomo" />
              <Option active={a.sex === 'female'} onClick={() => { set({ sex: 'female' }); next(); }} title="Donna" />
            </div>
          </>
        )}

        {id === 'body' && (
          <>
            <h2 className="mn-wizard-q">Età, altezza e peso</h2>
            <p className="mn-wizard-help">Il peso di oggi diventa anche la tua prima pesata.</p>
            <div className="mn-numfields">
              <NumberField label="Età" unit="anni" value={a.age} onChange={(v) => set({ age: v })} placeholder="29" />
              <NumberField label="Altezza" unit="cm" value={a.height} onChange={(v) => set({ height: v })} placeholder="178" />
              <NumberField label="Peso" unit="kg" value={a.weight} onChange={(v) => set({ weight: v })} placeholder="75,5" />
            </div>
          </>
        )}

        {id === 'bodyFat' && (
          <>
            <h2 className="mn-wizard-q">Conosci la tua massa grassa?</h2>
            <p className="mn-wizard-help">Facoltativo. Da plicometria, bilancia impedenziometrica o DEXA: rende il calcolo più preciso, soprattutto se sei muscoloso.</p>
            <div className="mn-numfields">
              <NumberField label="Massa grassa" unit="%" value={a.bodyFat} onChange={(v) => set({ bodyFat: v })} placeholder="es. 15" />
            </div>
          </>
        )}

        {id === 'activity' && (
          <>
            <h2 className="mn-wizard-q">Quanti passi fai in un giorno normale?</h2>
            <p className="mn-wizard-help">Senza contare l'allenamento. Se hai un telefono o uno smartwatch, guarda la media dell'ultima settimana.</p>
            <div className="mn-options">
              {ACTIVITY_LEVELS.map(l => (
                <Option key={l.id} active={a.activity === l.id} onClick={() => { set({ activity: l.id }); next(); }} title={l.label} desc={l.desc} />
              ))}
            </div>
          </>
        )}

        {id === 'training' && (
          <>
            <h2 className="mn-wizard-q">Quanto ti alleni?</h2>
            <p className="mn-wizard-help">Serve a dosare le proteine. Le kcal di ogni seduta le aggiungo io nei giorni in cui registri l'allenamento.</p>
            <div className="mn-options">
              {TRAINING_LEVELS.map(t => (
                <Option key={t.id} active={a.training === t.id} onClick={() => { set({ training: t.id }); next(); }} title={t.label} desc={t.desc} />
              ))}
            </div>
          </>
        )}

        {id === 'goal' && (
          <>
            <h2 className="mn-wizard-q">Qual è il tuo obiettivo?</h2>
            <div className="mn-options">
              {PHASES.map(p => (
                <Option
                  key={p.id}
                  active={phase === p.id}
                  onClick={() => set({ rate: phase === p.id ? a.rate : p.id === 'cut' ? -0.5 : p.id === 'bulk' ? 0.25 : 0 })}
                  title={p.label}
                  desc={p.desc}
                />
              ))}
            </div>
            {phase && phase !== 'maintain' && (
              <>
                <p className="mn-wizard-help">A che ritmo?</p>
                <div className="mn-chips">
                  {PHASES.find(p => p.id === phase).rates.map(r => (
                    <button key={r} type="button" className={`mn-chip ${a.rate === r ? 'is-active' : ''}`} onClick={() => set({ rate: r })}>{fmtRate(r)}</button>
                  ))}
                </div>
                <p className="mn-hint">
                  {phase === 'cut' ? 'Tra 0,5% e 1% del peso a settimana preservi meglio forza e muscoli.' : 'In massa un surplus piccolo limita il grasso accumulato.'}
                </p>
              </>
            )}
          </>
        )}

        {id === 'target' && (
          <>
            <h2 className="mn-wizard-q">Hai un peso obiettivo?</h2>
            <p className="mn-wizard-help">Facoltativo: lo uso per mostrarti il percorso e la data prevista.</p>
            <div className="mn-numfields">
              <NumberField label="Peso obiettivo" unit="kg" value={a.targetWeight} onChange={(v) => set({ targetWeight: v })} placeholder={fmtDec(suggestedTarget)} />
            </div>
          </>
        )}

        {id === 'result' && energy && plan && (
          <>
            <h2 className="mn-wizard-q">Ecco il tuo piano</h2>
            <section className="mn-plan">
              <p className="mn-plan-phase">
                {PHASES.find(p => p.id === phase)?.label}{a.rate ? ` · ${fmtRate(a.rate)}` : ''}
              </p>
              <p className="mn-plan-kcal">{fmtInt(energy.kcal)}<small>kcal al giorno</small></p>
              <div className="mn-plan-macros">
                {MACROS.map(m => (
                  <div key={m.id} className={`is-${m.id}`}>
                    <strong>{fmtInt(plan[m.id])}<small> g</small></strong>
                    <span>{m.label}</span>
                  </div>
                ))}
              </div>
            </section>
            <ul className="mn-steps">
              <li><span>Metabolismo basale</span><strong>{fmtInt(energy.bmr)} kcal</strong><small>{energy.method === 'katch' ? 'Katch-McArdle, dalla massa magra' : 'Mifflin-St Jeor'}</small></li>
              <li><span>Con i tuoi passi quotidiani</span><strong>{fmtInt(energy.maintenance)} kcal</strong><small>per mantenere il peso, {ACTIVITY_LEVELS.find(l => l.id === a.activity)?.label.toLowerCase()}</small></li>
              {energy.delta !== 0 && (
                <li><span>{energy.delta < 0 ? 'Deficit' : 'Surplus'} per {fmtRate(a.rate)}</span><strong>{energy.delta > 0 ? '+' : '−'}{fmtInt(Math.abs(energy.delta))} kcal</strong></li>
              )}
              {a.training !== 'none' && (
                // stessa stima del Diario: pesi ≈ 5 MET × peso × ore, qui per una seduta di un'ora
                <li><span>Nei giorni di allenamento</span><strong>+{fmtInt(5 * weight)} kcal</strong><small>{TRAINING_LEVELS.find(t => t.id === a.training)?.label.toLowerCase()}, per un'ora di seduta, aggiunte in automatico</small></li>
              )}
              <li><span>Proteine</span><strong>{fmtDec(macros.proteinPerKg)} g/kg</strong><small>in base a fase e allenamenti; grassi al {macros.fatPct}%, carboidrati il resto</small></li>
            </ul>
            {energy.floored && <p className="mn-hint mn-hint--warn">Ho fermato le calorie al minimo consigliato: scendere oltre senza un professionista non è sicuro.</p>}
          </>
        )}
      </div>
    </Sheet>
  );
}
