import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { EXERCISE_CATEGORIES, EXERCISES_DB, getExerciseCategories } from '../data/exercises';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ExerciseAutocomplete } from '../components/ExerciseAutocomplete';
import { getMuscleLevelByXp } from '../utils/gamification';
import { Zap } from 'lucide-react';
import './ProgressOverload.css';

function ProgressOverload() {
    const history = useStore(state => state.history);
    const customExercises = useStore(state => state.customExercises || []);
    const muscleXP = useStore(state => state.muscleXP) || {};
    
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedExercise, setSelectedExercise] = useState('');

    // Get all categories as an array of { key, label }
    const categories = Object.entries(EXERCISE_CATEGORIES).map(([key, label]) => ({ key, label }));

    const allExercisesDB = useMemo(() => [...EXERCISES_DB, ...customExercises], [customExercises]);

    // Extract unique exercises from history, optionally filtered by category
    const availableExercises = useMemo(() => {
        const exSet = new Set();
        history.forEach(workout => {
            workout.exercises.forEach(ex => {
                if (ex.sets.some(s => s.done)) {
                    exSet.add(ex.name);
                }
            });
        });

        let arr = Array.from(exSet);

        // Filter by selected muscle group
        if (selectedCategory) {
            const categoryLabel = EXERCISE_CATEGORIES[selectedCategory];
            const categoryExNames = allExercisesDB
                .filter(e => getExerciseCategories(e).includes(categoryLabel))
                .map(e => e.name);
            arr = arr.filter(name => categoryExNames.includes(name));
        }

        return arr.sort();
    }, [history, selectedCategory, allExercisesDB]);

    // Auto-select first exercise when filter changes
    useMemo(() => {
        if (availableExercises.length > 0 && !availableExercises.includes(selectedExercise)) {
            setSelectedExercise(availableExercises[0]);
        }
    }, [availableExercises]);

    const calculateOneRepMax = (weight, reps) => {
        const w = parseFloat(weight);
        const r = parseInt(reps, 10);
        if (!w || !r || w <= 0 || r <= 0) return null;
        if (r === 1) return w;
        return w * (1 + r / 30);
    };

    const chartData = useMemo(() => {
        if (!selectedExercise) return [];
        const dataPoints = [];

        history.forEach(workout => {
            const ex = workout.exercises.find(e => e.name === selectedExercise);
            if (!ex) return;
            const doneSets = ex.sets.filter(s => s.done);
            if (doneSets.length === 0) return;

            let setsCount = doneSets.length;
            let max1RM = 0;
            let maxReps = 0;
            let tonnage = 0;

            doneSets.forEach(s => {
                const w = parseFloat(s.kg) || 0;
                const r = parseInt(s.reps, 10) || 0;
                tonnage += (w * r);
                const rm = calculateOneRepMax(w, r);
                if (rm > max1RM) max1RM = rm;
                if (r > maxReps) maxReps = r;
            });

            const d = new Date(workout.startTime);
            const shortDate = `${d.getDate()} ${d.toLocaleString('it-IT', { month: 'short' }).replace('.', '')}`;

            dataPoints.push({
                date: shortDate,
                timestamp: workout.startTime,
                setsCount,
                oneRepMax: parseFloat(max1RM.toFixed(1)),
                maxReps,
                tonnage: parseFloat(tonnage.toFixed(1))
            });
        });

        return dataPoints.sort((a, b) => a.timestamp - b.timestamp);
    }, [history, selectedExercise]);

    const insights = useMemo(() => {
        if (chartData.length === 0) return null;
        
        const validPRs = chartData.map(d => d.oneRepMax).filter(val => val > 0);
        const pb = validPRs.length > 0 ? Math.max(...validPRs) : 0;
        const last1RM = chartData[chartData.length - 1].oneRepMax;
        
        let volumeProgress = { text: '0%', isPositive: true };
        const lastTonnage = chartData[chartData.length - 1].tonnage;

        if (chartData.length >= 2) {
            const prevTonnage = chartData[chartData.length - 2].tonnage;
            if (prevTonnage > 0) {
                const diff = lastTonnage - prevTonnage;
                const percent = (diff / prevTonnage) * 100;
                volumeProgress = {
                    text: `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`,
                    isPositive: percent >= 0
                };
            }
        }

        return {
            pb: pb > 0 ? `${pb}kg` : chartData[chartData.length - 1].maxReps + ' reps',
            last: last1RM > 0 ? `${last1RM}kg` : '-',
            volume: lastTonnage > 0 ? `${lastTonnage}kg` : '0kg',
            volumeProgress
        };
    }, [chartData]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const showsReps = data.oneRepMax === 0 && data.maxReps > 0;

            return (
                <div className="custom-tooltip glass">
                    <p className="label">{label}</p>
                    <div className="tooltip-content">
                        {showsReps ? (
                            <div className="tooltip-row">
                                <span className="dot reps"></span>
                                <span className="val">Max Reps: {data.maxReps}</span>
                            </div>
                        ) : (
                            <div className="tooltip-row">
                                <span className="dot rm"></span>
                                <span className="val">1RM Est: {data.oneRepMax}kg</span>
                            </div>
                        )}
                        {data.tonnage > 0 && (
                            <div className="tooltip-row">
                                <span className="dot volume" style={{ backgroundColor: 'var(--accent-color)' }}></span>
                                <span className="val">Volume: {data.tonnage}kg</span>
                            </div>
                        )}
                        <div className="tooltip-row">
                            <span className="dot sets" style={{ backgroundColor: 'var(--text-muted)' }}></span>
                            <span className="val">Serie: {data.setsCount}</span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <>
            <header className="app-header">
                <div className="header-content">
                    <h1>Progressi</h1>
                    <p className="subtitle">Performance & Insight</p>
                </div>
            </header>

            <main className="app-main">
                {/* Muscle Group Chips */}
                <div className="muscle-chips-container">
                    <button
                        className={`muscle-chip ${!selectedCategory ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(null)}
                    >
                        Tutti
                    </button>
                    {categories.map(({ key, label }) => {
                        return (
                            <button
                                key={key}
                                className={`muscle-chip ${selectedCategory === key ? 'active' : ''}`}
                                onClick={() => setSelectedCategory(selectedCategory === key ? null : key)}
                            >
                                <span>{label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Muscle Levels Info Box — only visible when a specific muscle group is selected */}
                {selectedCategory && (
                <div style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(255, 204, 0, 0.05)', borderRadius: '16px', border: '1px solid rgba(255, 204, 0, 0.2)' }}>
                    <h3 style={{ fontSize: '1.1rem', color: '#ffcc00', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                        <Zap size={20} />
                        Livelli RPG
                    </h3>
                    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                        {Object.entries(EXERCISE_CATEGORIES)
                            .filter(([key]) => !selectedCategory || selectedCategory === key)
                            .map(([key, label]) => {
                                const xp = muscleXP[label] || 0;
                                const levelData = getMuscleLevelByXp(xp);
                                
                                return (
                                    <div key={key} style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                                            <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{label}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{xp} XP</span>
                                                <span style={{ fontSize: '1rem', fontWeight: '800', color: '#ffcc00' }}>Lv. {levelData.level}</span>
                                            </div>
                                        </div>
                                        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ 
                                                height: '100%', 
                                                width: `${levelData.progressPercent}%`, 
                                                background: 'linear-gradient(90deg, var(--primary-color) 0%, #ffcc00 100%)', 
                                                borderRadius: '3px'
                                            }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
                )}

                {availableExercises.length === 0 ? (
                    <div className="card glass no-data-msg">
                        {selectedCategory
                            ? `Nessun esercizio completato per ${EXERCISE_CATEGORIES[selectedCategory]}.`
                            : 'Nessun dato disponibile. Inizia ad allenarti per vedere i tuoi progressi!'}
                    </div>
                ) : (
                    <>
                        <div className="exercise-picker-row">
                            <ExerciseAutocomplete
                                value={selectedExercise}
                                onChange={(val) => setSelectedExercise(val)}
                                options={availableExercises}
                                placeholder="Cerca esercizio..."
                            />
                        </div>

                        {insights && (
                            <div className="insights-grid">
                                <div className="insight-card">
                                    <span className="insight-label">Personal Best</span>
                                    <span className="insight-value primary">{insights.pb}</span>
                                </div>
                                <div className="insight-card">
                                    <span className="insight-label">Ultima Sessione</span>
                                    <span className="insight-value">{insights.last}</span>
                                </div>
                                <div className="insight-card">
                                    <span className="insight-label">Volume (Trend)</span>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                        <span className="insight-value">{insights.volume}</span>
                                        {insights.volume !== '0kg' && (
                                            <span style={{ 
                                                fontSize: '0.8rem', 
                                                fontWeight: '600',
                                                color: insights.volumeProgress.isPositive ? 'var(--success-color)' : 'var(--error-color)' 
                                            }}>
                                                {insights.volumeProgress.text}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="card chart-card glass">
                            <div className="chart-container">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 20, right: 5, left: -25, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorRM" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis
                                            dataKey="date"
                                            stroke="var(--text-muted)"
                                            fontSize={11}
                                            tickMargin={12}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            stroke="var(--text-muted)"
                                            fontSize={11}
                                            axisLine={false}
                                            tickLine={false}
                                            domain={['auto', 'auto']}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Line
                                            type="monotone"
                                            dataKey="oneRepMax"
                                            name="1RM Est."
                                            stroke="var(--primary-color)"
                                            strokeWidth={4}
                                            dot={{ r: 4, strokeWidth: 2, fill: 'var(--surface-color)' }}
                                            activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--primary-color)' }}
                                            animationDuration={1500}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="setsCount"
                                            name="Serie"
                                            stroke="var(--accent-color)"
                                            strokeWidth={2}
                                            strokeDasharray="5 5"
                                            dot={false}
                                            activeDot={{ r: 4 }}
                                            opacity={0.5}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </>
    );
}

export default ProgressOverload;
