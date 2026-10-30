import React, { useState } from 'react';
import { ChevronLeft, Sparkles } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { resolveBodyweight } from '../../utils/oneRepMax';
import {
  ACTIVITY_LEVELS, TRAINING_LEVELS, PHASES, MACROS, energyBreakdown, macroGoalsInGrams, macrosFor, phaseForRate,
  toDateKey, fmtInt, fmtDec
} from '../../utils/nutrition';
import { Sheet } from './Sheet';
import { locale, tr } from '../../i18n';

const STEPS = ['intro', 'sex', 'body', 'bodyFat', 'activity', 'training', 'goal', 'target', 'result'];
const toNum = (v) => parseFloat(String(v).replace(',', '.'));
const between = (v, min, max) => v >= min && v <= max;
const fmtRate = (r) => tr('{kg} kg a settimana', { kg: `${r > 0 ? '+' : '−'}${Math.abs(r).toLocaleString(locale())}` });

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
      <button type="button" className="mn-cta" onClick={next}>{tr('Iniziamo')}</button>
      <button type="button" className="mn-wizard-later" onClick={later}>{tr('Più tardi')}</button>
    </div>
  ) : (
    <div className="mn-wizard-foot is-row">
      <button type="button" className="mn-wizard-back" onClick={back} aria-label={tr('Indietro')}><ChevronLeft size={20} /></button>
      {id === 'result'
        ? <button type="button" className="mn-cta" onClick={save}>{tr('Salva il mio piano')}</button>
        : <button type="button" className="mn-cta" disabled={!valid} onClick={next}>
            {(id === 'bodyFat' && !a.bodyFat) || (id === 'target' && !a.targetWeight) ? tr('Salta') : tr('Avanti')}
          </button>}
    </div>
  );

  return (
    <Sheet title={tr('Il tuo piano')} onClose={later} full footer={footer}>
      <div className="mn-wizard">
        {id !== 'intro' && (
          <div className="mn-wizard-progress" aria-label={tr('Passo {step} di {total}', { step, total: STEPS.length - 1 })}>
            <span style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} />
          </div>
        )}

        {id === 'intro' && (
          <div className="mn-wizard-intro">
            <span className="mn-wizard-badge"><Sparkles size={26} /></span>
            <h2>{tr('Calcoliamo il tuo piano')}</h2>
            <p>{tr('Sette domande, meno di un minuto. Da qui ricavo calorie e macro su misura per te e per il tuo obiettivo.')}</p>
            <p className="mn-hint">{tr('Potrai cambiarli quando vuoi, o rifare il test da “I tuoi obiettivi”.')}</p>
          </div>
        )}

        {id === 'sex' && (
          <>
            <h2 className="mn-wizard-q">{tr('Sesso biologico')}</h2>
            <p className="mn-wizard-help">{tr('Serve solo al calcolo del metabolismo.')}</p>
            <div className="mn-options">
              <Option active={a.sex === 'male'} onClick={() => { set({ sex: 'male' }); next(); }} title={tr('Uomo')} />
              <Option active={a.sex === 'female'} onClick={() => { set({ sex: 'female' }); next(); }} title={tr('Donna')} />
            </div>
          </>
        )}

        {id === 'body' && (
          <>
            <h2 className="mn-wizard-q">{tr('Età, altezza e peso')}</h2>
            <p className="mn-wizard-help">{tr('Il peso di oggi diventa anche la tua prima pesata.')}</p>
            <div className="mn-numfields">
              <NumberField label={tr('Età')} unit={tr('anni')} value={a.age} onChange={(v) => set({ age: v })} placeholder="29" />
              <NumberField label={tr('Altezza')} unit="cm" value={a.height} onChange={(v) => set({ height: v })} placeholder="178" />
              <NumberField label={tr('Peso')} unit="kg" value={a.weight} onChange={(v) => set({ weight: v })} placeholder="75,5" />
            </div>
          </>
        )}

        {id === 'bodyFat' && (
          <>
            <h2 className="mn-wizard-q">{tr('Conosci la tua massa grassa?')}</h2>
            <p className="mn-wizard-help">{tr('Facoltativo. Da plicometria, bilancia impedenziometrica o DEXA: rende il calcolo più preciso, soprattutto se sei muscoloso.')}</p>
            <div className="mn-numfields">
              <NumberField label={tr('Massa grassa')} unit="%" value={a.bodyFat} onChange={(v) => set({ bodyFat: v })} placeholder={tr('es. 15')} />
            </div>
          </>
        )}

        {id === 'activity' && (
          <>
            <h2 className="mn-wizard-q">{tr('Quanti passi fai in un giorno normale?')}</h2>
            <p className="mn-wizard-help">{tr("Senza contare l'allenamento. Se hai un telefono o uno smartwatch, guarda la media dell'ultima settimana.")}</p>
            <div className="mn-options">
              {ACTIVITY_LEVELS.map(l => (
                <Option key={l.id} active={a.activity === l.id} onClick={() => { set({ activity: l.id }); next(); }} title={l.label} desc={l.desc} />
              ))}
            </div>
          </>
        )}

        {id === 'training' && (
          <>
            <h2 className="mn-wizard-q">{tr('Quanto ti alleni?')}</h2>
            <p className="mn-wizard-help">{tr("Serve a dosare le proteine. Le kcal di ogni seduta le aggiungo io nei giorni in cui registri l'allenamento.")}</p>
            <div className="mn-options">
              {TRAINING_LEVELS.map(t => (
                <Option key={t.id} active={a.training === t.id} onClick={() => { set({ training: t.id }); next(); }} title={t.label} desc={t.desc} />
              ))}
            </div>
          </>
        )}

        {id === 'goal' && (
          <>
            <h2 className="mn-wizard-q">{tr('Qual è il tuo obiettivo?')}</h2>
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
                <p className="mn-wizard-help">{tr('A che ritmo?')}</p>
                <div className="mn-chips">
                  {PHASES.find(p => p.id === phase).rates.map(r => (
                    <button key={r} type="button" className={`mn-chip ${a.rate === r ? 'is-active' : ''}`} onClick={() => set({ rate: r })}>{fmtRate(r)}</button>
                  ))}
                </div>
                <p className="mn-hint">
                  {phase === 'cut' ? tr('Tra 0,5% e 1% del peso a settimana preservi meglio forza e muscoli.') : tr('In massa un surplus piccolo limita il grasso accumulato.')}
                </p>
              </>
            )}
          </>
        )}

        {id === 'target' && (
          <>
            <h2 className="mn-wizard-q">{tr('Hai un peso obiettivo?')}</h2>
            <p className="mn-wizard-help">{tr('Facoltativo: lo uso per mostrarti il percorso e la data prevista.')}</p>
            <div className="mn-numfields">
              <NumberField label={tr('Peso obiettivo')} unit="kg" value={a.targetWeight} onChange={(v) => set({ targetWeight: v })} placeholder={fmtDec(suggestedTarget)} />
            </div>
          </>
        )}

        {id === 'result' && energy && plan && (
          <>
            <h2 className="mn-wizard-q">{tr('Ecco il tuo piano')}</h2>
            <section className="mn-plan">
              <p className="mn-plan-phase">
                {PHASES.find(p => p.id === phase)?.label}{a.rate ? ` · ${fmtRate(a.rate)}` : ''}
              </p>
              <p className="mn-plan-kcal">{fmtInt(energy.kcal)}<small>{tr('kcal al giorno')}</small></p>
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
              <li><span>{tr('Metabolismo basale')}</span><strong>{fmtInt(energy.bmr)} kcal</strong><small>{energy.method === 'katch' ? tr('Katch-McArdle, dalla massa magra') : 'Mifflin-St Jeor'}</small></li>
              <li><span>{tr('Con i tuoi passi quotidiani')}</span><strong>{fmtInt(energy.maintenance)} kcal</strong><small>{tr('per mantenere il peso, {steps}', { steps: ACTIVITY_LEVELS.find(l => l.id === a.activity)?.label.toLowerCase() })}</small></li>
              {energy.delta !== 0 && (
                <li><span>{tr(energy.delta < 0 ? 'Deficit per {rate}' : 'Surplus per {rate}', { rate: fmtRate(a.rate) })}</span><strong>{energy.delta > 0 ? '+' : '−'}{fmtInt(Math.abs(energy.delta))} kcal</strong></li>
              )}
              {a.training !== 'none' && (
                // stessa stima del Diario: pesi ≈ 5 MET × peso × ore, qui per una seduta di un'ora
                <li><span>{tr('Nei giorni di allenamento')}</span><strong>+{fmtInt(5 * weight)} kcal</strong><small>{tr('{training}, per un\'ora di seduta, aggiunte in automatico', { training: TRAINING_LEVELS.find(t => t.id === a.training)?.label.toLowerCase() })}</small></li>
              )}
              <li><span>{tr('Proteine')}</span><strong>{fmtDec(macros.proteinPerKg)} g/kg</strong><small>{tr('in base a fase e allenamenti; grassi al {fat}%, carboidrati il resto', { fat: macros.fatPct })}</small></li>
            </ul>
            {energy.floored && <p className="mn-hint mn-hint--warn">{tr('Ho fermato le calorie al minimo consigliato: scendere oltre senza un professionista non è sicuro.')}</p>}
          </>
        )}
      </div>
    </Sheet>
  );
}
