import React, { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { EXERCISE_CATEGORIES, EXERCISES_DB } from '../data/exercises';
import { CATEGORY_ICON_MAP } from '../components/MuscleIcons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './ProgressOverload.css';

function ProgressOverload() {
    const history = useStore(state => state.history);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedExercise, setSelectedExercise] = useState('');

    // Get all categories as an array of { key, label }
    const categories = Object.entries(EXERCISE_CATEGORIES).map(([key, label]) => ({ key, label }));

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
            const categoryExNames = EXERCISES_DB
                .filter(e => e.category === categoryLabel)
                .map(e => e.name);
            arr = arr.filter(name => categoryExNames.includes(name));
        }

        return arr.sort();
    }, [history, selectedCategory]);

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

            doneSets.forEach(s => {
                const w = parseFloat(s.kg) || 0;
                const r = parseInt(s.reps, 10) || 0;
                const rm = calculateOneRepMax(w, r);
                if (rm > max1RM) max1RM = rm;
            });

            const d = new Date(workout.startTime);
            const shortDate = `${d.getDate()} ${d.toLocaleString('it-IT', { month: 'short' }).replace('.', '')}`;

            dataPoints.push({
                date: shortDate,
                timestamp: workout.startTime,
                setsCount,
                oneRepMax: parseFloat(max1RM.toFixed(1))
            });
        });

        return dataPoints.sort((a, b) => a.timestamp - b.timestamp);
    }, [history, selectedExercise]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="custom-tooltip">
                    <p className="label">{label}</p>
                    <p className="desc">{`1RM Est: ${payload[0].value} kg`}</p>
                    {payload[1] && <p className="desc-volume">{`Serie: ${payload[1].value}`}</p>}
                </div>
            );
        }
        return null;
    };

    return (
        <>
            <header className="app-header">
                <h1>Progressi</h1>
                <p className="subtitle">Sovraccarico Progressivo</p>
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
                        const IconComponent = CATEGORY_ICON_MAP[key];
                        return (
                            <button
                                key={key}
                                className={`muscle-chip ${selectedCategory === key ? 'active' : ''}`}
                                onClick={() => setSelectedCategory(selectedCategory === key ? null : key)}
                            >
                                {IconComponent && <IconComponent size={16} />}
                                <span>{label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Chart Card */}
                <div className="card">
                    {availableExercises.length === 0 ? (
                        <div className="no-data-msg">
                            {selectedCategory
                                ? `Nessun esercizio completato per ${EXERCISE_CATEGORIES[selectedCategory]}.`
                                : 'Nessun dato disponibile. Completa qualche allenamento!'}
                        </div>
                    ) : (
                        <>
                            <select
                                className="exercise-selector"
                                value={selectedExercise}
                                onChange={(e) => setSelectedExercise(e.target.value)}
                            >
                                {availableExercises.map(ex => (
                                    <option key={ex} value={ex}>{ex}</option>
                                ))}
                            </select>

                            <div className="chart-container">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                        <XAxis
                                            dataKey="date"
                                            stroke="var(--text-muted)"
                                            fontSize={12}
                                            tickMargin={10}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            stroke="var(--text-muted)"
                                            fontSize={12}
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
                                            strokeWidth={3}
                                            dot={{ r: 4, strokeWidth: 2 }}
                                            activeDot={{ r: 6 }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="setsCount"
                                            name="Serie"
                                            stroke="var(--accent-color)"
                                            strokeWidth={2}
                                            strokeDasharray="4 4"
                                            dot={false}
                                            activeDot={{ r: 4 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </>
    );
}

export default ProgressOverload;
