import React, { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { EXERCISE_CATEGORIES, getAllExercises, getExerciseCategories } from '../../data/exercises';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ExerciseAutocomplete } from '../../components/ExerciseAutocomplete';
import { getMuscleLevelByXp } from '../../utils/gamification';
import { Zap, Search, Trophy, TrendingUp, TrendingDown } from 'lucide-react';
import './ProgressOverload.css';

// Epley estimated 1RM
const calculateOneRepMax = (weight, reps) => {
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (!w || !r || w <= 0 || r <= 0) return null;
    if (r === 1) return w;
    return w * (1 + r / 30);
};

const round1 = (n) => Math.round(n * 10) / 10;
const fmtNum = (n) => round1(n).toLocaleString('it-IT', { maximumFractionDigits: 1 });
const fmtSigned = (n) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmtNum(Math.abs(n))}`;
const fmtShortDate = (t) => new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', '');
const fmtAxisDate = (t) => new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'numeric' });

function ChartTooltip({ active, payload, unit }) {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    return (
        <div className="pg-tooltip">
            <p className="pg-tooltip-date">{fmtShortDate(d.time)}</p>
            <p className="pg-tooltip-value">{fmtNum(d.value)} {unit}</p>
            <p className="pg-tooltip-set">{d.kg > 0 ? `${fmtNum(d.kg)}kg × ${d.reps}` : `${d.reps} reps`}</p>
            {d.isPR && <p className="pg-tooltip-pr"><Trophy size={11} /> Nuovo PR</p>}
        </div>
    );
}

function ChartDot({ cx, cy, payload }) {
    if (cx == null || cy == null) return null;
    if (payload.isPR) {
        return <circle cx={cx} cy={cy} r={5} fill="var(--c-streak)" stroke="var(--c-bg)" strokeWidth={2} />;
    }
    return <circle cx={cx} cy={cy} r={3.5} fill="var(--c-bg)" stroke="var(--c-primary)" strokeWidth={2} />;
}

function ProgressOverload() {
    const history = useStore(state => state.history);
    const customExercises = useStore(state => state.customExercises || []);
    const exerciseOverrides = useStore(state => state.exerciseOverrides || {});
    const muscleXP = useStore(state => state.muscleXP) || {};

    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedExercise, setSelectedExercise] = useState('');

    const allExercisesDB = useMemo(() => getAllExercises(customExercises, exerciseOverrides), [customExercises, exerciseOverrides]);

    // Every exercise with at least one completed set
    const trainedExercises = useMemo(() => {
        const exSet = new Set();
        history.forEach(workout => {
            workout.exercises.forEach(ex => {
                if (ex.sets.some(s => s.done)) exSet.add(ex.name);
            });
        });
        return Array.from(exSet).sort();
    }, [history]);

    // Only muscle groups that actually have trained exercises, with their count
    const categories = useMemo(() => {
        return Object.entries(EXERCISE_CATEGORIES)
            .map(([key, label]) => {
                const names = new Set(allExercisesDB.filter(e => getExerciseCategories(e).includes(label)).map(e => e.name));
                return { key, label, count: trainedExercises.filter(n => names.has(n)).length };
            })
            .filter(c => c.count > 0);
    }, [allExercisesDB, trainedExercises]);

    const activeCategory = categories.some(c => c.key === selectedCategory) ? selectedCategory : null;

    const availableExercises = useMemo(() => {
        if (!activeCategory) return trainedExercises;
        const categoryLabel = EXERCISE_CATEGORIES[activeCategory];
        const categoryExNames = new Set(allExercisesDB
            .filter(e => getExerciseCategories(e).includes(categoryLabel))
            .map(e => e.name));
        return trainedExercises.filter(name => categoryExNames.has(name));
    }, [trainedExercises, activeCategory, allExercisesDB]);

    // Fall back to the first exercise when the filter hides the current pick
    const currentExercise = availableExercises.includes(selectedExercise)
        ? selectedExercise
        : (availableExercises[0] || '');

    // One point per session: the best set by estimated 1RM (reps for bodyweight work)
    const sessions = useMemo(() => {
        if (!currentExercise) return [];
        const list = [];
        history.forEach(workout => {
            const ex = workout.exercises.find(e => e.name === currentExercise);
            if (!ex) return;
            let best = null;
            ex.sets.filter(s => s.done).forEach(s => {
                const kg = parseFloat(s.kg) || 0;
                const reps = parseInt(s.reps, 10) || 0;
                if (reps <= 0) return;
                const rm = calculateOneRepMax(kg, reps);
                const better = !best
                    || (rm || 0) > (best.rm || 0)
                    || (!rm && !best.rm && reps > best.reps);
                if (better) best = { kg, reps, rm };
            });
            if (best) list.push({ time: workout.startTime, ...best });
        });
        list.sort((a, b) => a.time - b.time);

        const hasLoad = list.some(s => s.rm);
        let runningMax = 0;
        return list.map((s, i) => {
            const value = hasLoad ? round1(s.rm || 0) : s.reps;
            const prev = i > 0 ? (hasLoad ? round1(list[i - 1].rm || 0) : list[i - 1].reps) : null;
            const isPR = i > 0 && value > runningMax;
            runningMax = Math.max(runningMax, value);
            return { ...s, value, delta: prev == null ? null : round1(value - prev), isPR };
        });
    }, [history, currentExercise]);

    const hasLoad = sessions.some(s => s.rm);
    const unit = hasLoad ? 'kg' : 'reps';

    const summary = useMemo(() => {
        if (sessions.length === 0) return null;
        const last = sessions[sessions.length - 1];
        const best = Math.max(...sessions.map(s => s.value));
        let streak = 0;
        for (let i = sessions.length - 1; i >= 1 && sessions[i].delta > 0; i--) streak++;
        const step = last.kg > 0 && last.kg < 20 ? 1 : 2.5;
        const nextTarget = last.kg > 0 ? `${fmtNum(last.kg)}kg × ${last.reps + 1}` : `${last.reps + 1} reps`;
        const altTarget = last.kg > 0 ? `${fmtNum(last.kg + step)}kg × ${last.reps}` : null;
        return { last, best, streak, nextTarget, altTarget };
    }, [sessions]);

    const log = useMemo(() => sessions.slice(-6).reverse(), [sessions]);

    return (
        <div className="ej-page pg-page">
            <div className="ej-glow" aria-hidden="true" />

            <header>
                <h1 className="ej-title">Progressi</h1>
                <p className="ej-eyebrow">Sovraccarico progressivo &amp; 1RM</p>
            </header>

            {/* Muscle group filter: one scrollable row, only trained groups */}
            {categories.length > 0 && (
                <div className="pg-filter" role="tablist" aria-label="Filtra per gruppo muscolare">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={!activeCategory}
                        className={`pg-filter-chip ${!activeCategory ? 'is-active' : ''}`}
                        onClick={() => setSelectedCategory(null)}
                    >
                        Tutti <span className="pg-filter-count">{trainedExercises.length}</span>
                    </button>
                    {categories.map(({ key, label, count }) => (
                        <button
                            type="button"
                            role="tab"
                            key={key}
                            aria-selected={activeCategory === key}
                            className={`pg-filter-chip ${activeCategory === key ? 'is-active' : ''}`}
                            onClick={() => setSelectedCategory(activeCategory === key ? null : key)}
                        >
                            {label} <span className="pg-filter-count">{count}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* RPG level of the selected muscle group */}
            {activeCategory && (() => {
                const label = EXERCISE_CATEGORIES[activeCategory];
                const xp = muscleXP[label] || 0;
                const levelData = getMuscleLevelByXp(xp);
                return (
                    <div className="ej-card pg-rpg">
                        <h3 className="pg-rpg-title"><Zap size={18} /> Livelli RPG</h3>
                        <div className="pg-rpg-level">
                            <div className="pg-rpg-row">
                                <span className="pg-rpg-name">{label}</span>
                                <span className="pg-rpg-meta">
                                    <span>{xp.toLocaleString('it-IT')} XP</span>
                                    <strong>Lv. {levelData.level}</strong>
                                </span>
                            </div>
                            <div className="ej-track"><span style={{ width: `${levelData.progressPercent}%` }} /></div>
                        </div>
                    </div>
                );
            })()}

            {availableExercises.length === 0 ? (
                <div className="ej-card pg-empty">
                    {activeCategory
                        ? `Nessun esercizio completato per ${EXERCISE_CATEGORIES[activeCategory]}.`
                        : 'Nessun dato disponibile. Inizia ad allenarti per vedere i tuoi progressi!'}
                </div>
            ) : (
                <>
                    <div className="pg-search">
                        <Search size={18} className="pg-search-icon" />
                        <ExerciseAutocomplete
                            value={currentExercise}
                            onChange={(val) => setSelectedExercise(val)}
                            options={availableExercises}
                            placeholder="Cerca esercizio..."
                        />
                    </div>

                    {summary && (
                        <>
                            {/* 1RM hero + chart */}
                            <section className="ej-card pg-hero">
                                <div className="pg-hero-head">
                                    <div>
                                        <p className="pg-kicker">{hasLoad ? '1RM stimato · Epley' : 'Ripetizioni massime'}</p>
                                        <p className="pg-hero-value">
                                            {fmtNum(summary.last.value)} <span>{unit}</span>
                                        </p>
                                    </div>
                                    {summary.last.isPR && (
                                        <span className="pg-pr-badge"><Trophy size={14} /> Nuovo PR</span>
                                    )}
                                </div>

                                <div className="pg-chart">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={sessions} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="pgArea" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="var(--c-primary)" stopOpacity={0.3} />
                                                    <stop offset="100%" stopColor="var(--c-primary)" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                                            <XAxis
                                                dataKey="time"
                                                tickFormatter={fmtAxisDate}
                                                stroke="var(--c-text-dim)"
                                                fontSize={10}
                                                tickMargin={10}
                                                axisLine={false}
                                                tickLine={false}
                                                minTickGap={16}
                                            />
                                            <YAxis
                                                stroke="var(--c-text-dim)"
                                                fontSize={10}
                                                axisLine={false}
                                                tickLine={false}
                                                domain={[(min) => Math.floor(min - 2), (max) => Math.ceil(max + 2)]}
                                                allowDecimals={false}
                                            />
                                            <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
                                            <Area
                                                type="monotone"
                                                dataKey="value"
                                                stroke="var(--c-primary)"
                                                strokeWidth={3}
                                                fill="url(#pgArea)"
                                                dot={<ChartDot />}
                                                activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--c-primary)' }}
                                                animationDuration={900}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="pg-legend">
                                    <span><i style={{ background: 'var(--c-primary)' }} /> {hasLoad ? '1RM stimato' : 'Reps'}</span>
                                    <span><i style={{ background: 'var(--c-streak)' }} /> Nuovo PR</span>
                                </div>
                            </section>

                            {/* Insights */}
                            <div className="pg-insights">
                                <div className="ej-card pg-insight">
                                    <span className="pg-insight-label">Personal Best</span>
                                    <span className="pg-insight-value is-primary">{fmtNum(summary.best)}{unit === 'kg' ? 'kg' : ''}</span>
                                    <span className="pg-insight-sub">{hasLoad ? '1RM stimato' : 'reps'}</span>
                                </div>
                                <div className="ej-card pg-insight">
                                    <span className="pg-insight-label">Ultima Sessione</span>
                                    <span className="pg-insight-value">
                                        {summary.last.kg > 0 ? `${fmtNum(summary.last.kg)}kg × ${summary.last.reps}` : `${summary.last.reps} reps`}
                                    </span>
                                    <span className="pg-insight-sub">{fmtShortDate(summary.last.time)}</span>
                                </div>
                                <div className="ej-card pg-insight">
                                    <span className="pg-insight-label">Overload</span>
                                    <span className={`pg-insight-value ${summary.last.delta > 0 ? 'is-up' : summary.last.delta < 0 ? 'is-down' : ''}`}>
                                        {summary.last.delta == null ? '—' : `${fmtSigned(summary.last.delta)}${unit === 'kg' ? 'kg' : ''}`}
                                    </span>
                                    <span className="pg-insight-sub">vs sessione prec.</span>
                                </div>
                            </div>

                            {/* Overload status */}
                            {sessions.length >= 2 && (
                                summary.streak > 0 ? (
                                    <div className="pg-status is-up">
                                        <span className="pg-status-icon"><TrendingUp size={20} /></span>
                                        <div>
                                            <p className="pg-status-title">
                                                {summary.streak === 1 ? 'Overload nell\'ultima sessione' : `${summary.streak} sessioni di fila in overload`}
                                            </p>
                                            <p className="pg-status-sub">Prossimo obiettivo: {summary.nextTarget}{summary.altTarget ? ` o ${summary.altTarget}` : ''}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="pg-status is-flat">
                                        <span className="pg-status-icon"><TrendingDown size={20} /></span>
                                        <div>
                                            <p className="pg-status-title">Nessun overload nell'ultima sessione</p>
                                            <p className="pg-status-sub">Per sbloccarlo punta a {summary.nextTarget}{summary.altTarget ? ` o ${summary.altTarget}` : ''}</p>
                                        </div>
                                    </div>
                                )
                            )}

                            {/* Session log */}
                            <h2 className="ej-section-title">Storico sovraccarico</h2>
                            <div className="ej-card pg-log">
                                {log.map((s) => (
                                    <div key={s.time} className="pg-log-row">
                                        <span className="pg-log-date">{fmtShortDate(s.time)}</span>
                                        <div className="pg-log-main">
                                            <span className="pg-log-set">{s.kg > 0 ? `${fmtNum(s.kg)}kg × ${s.reps}` : `${s.reps} reps`}</span>
                                            <span className="pg-log-cap">Miglior serie</span>
                                        </div>
                                        <div className="pg-log-rm">
                                            <span className="pg-log-set">
                                                {s.isPR && <Trophy size={12} className="pg-log-trophy" />}
                                                {fmtNum(s.value)} {unit}
                                            </span>
                                            <span className="pg-log-cap">{hasLoad ? '1RM' : 'Reps'}</span>
                                        </div>
                                        <span className={`ej-pill ${s.delta == null ? 'ej-pill--flat' : s.delta > 0 ? 'ej-pill--up' : s.delta < 0 ? 'ej-pill--down' : 'ej-pill--flat'}`}>
                                            {s.delta == null ? 'Inizio' : fmtSigned(s.delta)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}

export default ProgressOverload;
