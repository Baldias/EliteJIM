import React, { useState } from 'react';
import { Minus, Plus, ChevronDown, Sparkles } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { resolveBodyweight } from '../../utils/oneRepMax';
import {
  ACTIVITY_LEVELS, PHASES, MACROS, DEFAULT_NUTRITION_GOALS, KCAL_PER_G, computeCalorieGoal, macroGoalsInGrams,
  phaseForRate, fmtInt, fmtDec
} from '../../utils/nutrition';
import { Sheet } from './Sheet';
import { locale, tr } from '../../i18n';

const toNum = (v) => parseFloat(String(v).replace(',', '.'));
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const fmtRate = (r) => `${r > 0 ? '+' : '−'}${Math.abs(r).toLocaleString(locale())} ${tr('kg/sett')}`;

function Stepper({ value, onChange, step, min, max, format, unit }) {
  return (
    <div className="mn-stepper mn-stepper--inline">
      <button type="button" onClick={() => onChange(clamp(Math.round((value - step) * 100) / 100, min, max))} disabled={value <= min} aria-label={tr('Diminuisci')}>
        <Minus size={16} />
      </button>
      <span className="mn-stepper-inline-value">{format(value)}<small>{unit}</small></span>
      <button type="button" onClick={() => onChange(clamp(Math.round((value + step) * 100) / 100, min, max))} disabled={value >= max} aria-label={tr('Aumenta')}>
        <Plus size={16} />
      </button>
    </div>
  );
}

// Voce richiudibile: titolo e valore attuale; aperta mostra i controlli
function Section({ id, open, onToggle, title, summary, children }) {
  const isOpen = open === id;
  return (
    <div className={`mn-goal-row ${isOpen ? 'is-open' : ''}`}>
      <button type="button" className="mn-goal-row-head" onClick={() => onToggle(isOpen ? null : id)} aria-expanded={isOpen}>
        <span className="mn-goal-row-title">{title}</span>
        <span className="mn-goal-row-summary">{summary}</span>
        <ChevronDown size={18} />
      </button>
      {isOpen && <div className="mn-goal-row-body">{children}</div>}
    </div>
  );
}

export function GoalsSheet({ onClose, onRedoTest }) {
  const stored = useStore(state => state.nutritionGoals);
  const bodyweight = useStore(resolveBodyweight);
  const setNutritionGoals = useStore(state => state.setNutritionGoals);
  const goals = { ...DEFAULT_NUTRITION_GOALS, ...stored };

  const [open, setOpen] = useState(null);
  const [rate, setRate] = useState(goals.weeklyGoal ?? 0);
  const [kcal, setKcal] = useState(goals.kcal);
  const [proteinPerKg, setProteinPerKg] = useState(goals.proteinPerKg);
  const [fatPct, setFatPct] = useState(goals.fatPct);
  const [targetWeight, setTargetWeight] = useState(goals.targetWeight ? String(goals.targetWeight).replace('.', ',') : '');
  const [profile, setProfile] = useState({ sex: 'male', age: '', height: '', activity: 'light', ...(goals.profile || {}) });
  const [weight, setWeight] = useState(bodyweight ? String(bodyweight).replace('.', ',') : '');
  const [showCalc, setShowCalc] = useState(false);

  const phase = phaseForRate(rate);
  const phaseInfo = PHASES.find(p => p.id === phase);
  const bw = bodyweight || toNum(weight);
  const estimate = computeCalorieGoal({ ...profile, weight: bw, weeklyGoal: rate });
  const plan = macroGoalsInGrams({ ...goals, kcal, proteinPerKg, fatPct }, bw);
  const carbsKcal = kcal - plan.protein * KCAL_PER_G.protein - plan.fat * KCAL_PER_G.fat;
  const target = toNum(targetWeight) > 0 ? toNum(targetWeight) : null;

  const pickPhase = (p) => {
    if (p === phase) return;
    const rates = PHASES.find(x => x.id === p).rates;
    setRate(rates[Math.min(1, rates.length - 1)]);
  };

  const save = () => {
    setNutritionGoals({
      kcal,
      proteinPerKg,
      fatPct,
      weeklyGoal: rate,
      targetWeight: target ? Math.round(target * 10) / 10 : null,
      profile,
    });
    onClose();
  };

  return (
    <Sheet
      title={tr('I tuoi obiettivi')}
      onClose={onClose}
      full
      footer={<button type="button" className="mn-cta" disabled={carbsKcal < 0} onClick={save}>{tr('Salva')}</button>}
    >
      <div className="mn-goals">
        <section className="mn-plan">
          <p className="mn-plan-phase">
            {phaseInfo.label}{rate !== 0 && ` · ${fmtRate(rate)}`}{target && ` · ${tr('verso {kg} kg', { kg: fmtDec(target) })}`}
          </p>
          <p className="mn-plan-kcal">{fmtInt(kcal)}<small>{tr('kcal al giorno')}</small></p>
          <div className="mn-plan-macros">
            {MACROS.map(m => (
              <div key={m.id} className={`is-${m.id}`}>
                <strong>{m.id === 'carbs' && carbsKcal < 0 ? '—' : fmtInt(plan[m.id])}<small> g</small></strong>
                <span>{m.label}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="mn-goal-list">
          <Section
            id="phase"
            open={open}
            onToggle={setOpen}
            title={tr('Obiettivo')}
            summary={rate === 0 ? phaseInfo.label : `${phaseInfo.label}, ${fmtRate(rate)}`}
          >
            <div className="mn-seg">
              {PHASES.map(p => (
                <button key={p.id} type="button" className={phase === p.id ? 'is-active' : ''} onClick={() => pickPhase(p.id)}>{p.label}</button>
              ))}
            </div>
            <p className="mn-hint">{phaseInfo.desc}.</p>
            {phase !== 'maintain' && (
              <div className="mn-chips">
                {phaseInfo.rates.map(r => (
                  <button key={r} type="button" className={`mn-chip ${rate === r ? 'is-active' : ''}`} onClick={() => setRate(r)}>{fmtRate(r)}</button>
                ))}
              </div>
            )}
            <label className="mn-field mn-field--inline">
              <span>{tr('Peso obiettivo')}</span>
              <input className="mn-input" inputMode="decimal" value={targetWeight} onChange={e => setTargetWeight(e.target.value)} placeholder="—" />
              <small>kg</small>
            </label>
          </Section>

          <Section id="kcal" open={open} onToggle={setOpen} title={tr('Calorie')} summary={`${fmtInt(kcal)} kcal`}>
            <Stepper value={kcal} onChange={setKcal} step={50} min={1000} max={6000} format={fmtInt} unit="kcal" />
            {estimate && estimate !== kcal && (
              <button type="button" className="mn-suggest" onClick={() => setKcal(estimate)}>
                {tr('Per il tuo profilo ne servono circa')} <strong>{fmtInt(estimate)}</strong> · {tr('usa questo valore')}
              </button>
            )}
            <button type="button" className="mn-link" onClick={() => setShowCalc(s => !s)}>
              {showCalc ? tr('Chiudi il calcolo') : tr('Calcola in base al tuo profilo')}
            </button>
            {showCalc && (
              <div className="mn-calc">
                <div className="mn-seg mn-seg--small">
                  <button type="button" className={profile.sex === 'male' ? 'is-active' : ''} onClick={() => setProfile({ ...profile, sex: 'male' })}>{tr('Uomo')}</button>
                  <button type="button" className={profile.sex === 'female' ? 'is-active' : ''} onClick={() => setProfile({ ...profile, sex: 'female' })}>{tr('Donna')}</button>
                </div>
                <div className="mn-field-row mn-field-row--3">
                  <label className="mn-field"><span>{tr('Età')}</span>
                    <input className="mn-input" inputMode="numeric" value={profile.age} onChange={e => setProfile({ ...profile, age: e.target.value })} />
                  </label>
                  <label className="mn-field"><span>{tr('Altezza cm')}</span>
                    <input className="mn-input" inputMode="numeric" value={profile.height} onChange={e => setProfile({ ...profile, height: e.target.value })} />
                  </label>
                  <label className="mn-field"><span>{tr('Peso kg')}</span>
                    <input className="mn-input" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)} disabled={!!bodyweight} />
                  </label>
                </div>
                <label className="mn-field"><span>{tr('Giornata tipo, senza allenamento')}</span>
                  <select className="mn-input" value={profile.activity} onChange={e => setProfile({ ...profile, activity: e.target.value })}>
                    {ACTIVITY_LEVELS.map(l => <option key={l.id} value={l.id}>{l.label} — {l.desc}</option>)}
                  </select>
                </label>
                <p className="mn-hint">{tr('Le calorie degli allenamenti si aggiungono da sole nei giorni in cui ti alleni.')}</p>
              </div>
            )}
          </Section>

          <Section
            id="macro"
            open={open}
            onToggle={setOpen}
            title={tr('Macro')}
            summary={tr('{protein} g/kg proteine · {fat}% grassi', { protein: fmtDec(proteinPerKg), fat: fmtInt(fatPct) })}
          >
            <div className="mn-macro-goal is-protein">
              <div>
                <strong>{tr('Proteine')}</strong>
                <span>{bw ? tr('{g} g al giorno', { g: fmtInt(plan.protein) }) : tr('registra il peso per i grammi')}</span>
              </div>
              <Stepper value={proteinPerKg} onChange={setProteinPerKg} step={0.1} min={1.2} max={3} format={fmtDec} unit="g/kg" />
            </div>
            <div className="mn-macro-goal is-fat">
              <div>
                <strong>{tr('Grassi')}</strong>
                <span>{tr('{g} g al giorno', { g: fmtInt(plan.fat) })}</span>
              </div>
              <Stepper value={fatPct} onChange={setFatPct} step={5} min={15} max={45} format={fmtInt} unit="%" />
            </div>
            <p className={`mn-hint ${carbsKcal < 0 ? 'mn-hint--warn' : ''}`}>
              {carbsKcal < 0
                ? tr('Proteine e grassi superano le calorie: abbassali o alza le calorie.')
                : tr('I carboidrati prendono il resto: {g} g. Chi si allena con i pesi di solito sta tra 1,6 e 2,2 g/kg di proteine.', { g: fmtInt(plan.carbs) })}
            </p>
          </Section>
        </div>

        {onRedoTest && (
          <button type="button" className="mn-redo-test" onClick={onRedoTest}>
            <Sparkles size={16} /> {tr('Rifai il test per ricalcolare il piano')}
          </button>
        )}
      </div>
    </Sheet>
  );
}
