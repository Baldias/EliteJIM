import { useEffect, useMemo, useState } from 'react';
import { searchLocalFoods, searchOffFoods } from '../../utils/foodApi';

// Ricerca alimenti: base + creati da te subito, Open Food Facts con debounce
export function useFoodSearch(query, customFoods) {
  const trimmed = query.trim();
  const local = useMemo(() => searchLocalFoods(trimmed, customFoods), [trimmed, customFoods]);
  const [online, setOnline] = useState({ q: '', items: [], loading: false, error: '' });

  useEffect(() => {
    if (trimmed.length < 2) return undefined;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setOnline(o => ({ ...o, loading: true, error: '' }));
      searchOffFoods(trimmed, { signal: ctrl.signal })
        .then(items => setOnline({ q: trimmed, items, loading: false, error: '' }))
        .catch(err => {
          if (err.name === 'AbortError') return;
          setOnline({ q: trimmed, items: [], loading: false, error: navigator.onLine ? 'La ricerca dei prodotti non risponde: riprova tra poco.' : 'Sei offline: trovi solo gli alimenti salvati.' });
        });
    }, 400);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [trimmed]);

  return {
    trimmed,
    local,
    online,
    onlineItems: online.q === trimmed ? online.items : [],
    noOnlineResults: !online.loading && !online.error && online.q === trimmed && online.items.length === 0,
  };
}
