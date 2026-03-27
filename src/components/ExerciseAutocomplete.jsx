import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { EXERCISES_DB, getExerciseCategories } from '../data/exercises';
import './Autocomplete.css';

export function ExerciseAutocomplete({ value, onChange, placeholder = "Cerca esercizio...", options = null }) {
  const customExercises = useStore(state => state.customExercises || []);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  // Close dropdown if clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const sourceData = options || [...EXERCISES_DB, ...customExercises];

  const filteredExercises = sourceData.filter(ex => {
    const name = typeof ex === 'string' ? ex : ex.name;
    const categories = typeof ex === 'string' ? [] : getExerciseCategories(ex);
    
    const searchLow = searchTerm.toLowerCase().trim();
    const nameMatch = name.toLowerCase().includes(searchLow);
    const categoryMatch = categories.some(cat => cat.toLowerCase().includes(searchLow));
    
    return nameMatch || categoryMatch;
  });


  return (
    <div ref={wrapperRef} className="autocomplete-wrapper">
      <input
        type="text"
        className="autocomplete-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setSearchTerm(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          setSearchTerm(''); // show all on focus if needed or keep current
          setIsOpen(true);
        }}
      />
      
      {isOpen && (
        <ul className="autocomplete-dropdown">
          {filteredExercises.length > 0 ? (
            filteredExercises.map((ex, idx) => {
              const name = typeof ex === 'string' ? ex : ex.name;
              const categories = typeof ex === 'string' ? null : getExerciseCategories(ex);
              const categoryLabel = categories ? categories.join(' · ') : null;
              const id = typeof ex === 'string' ? `opt-${idx}` : ex.id;
              
              return (
                <li 
                  key={id} 
                  className="autocomplete-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(name);
                    setIsOpen(false);
                  }}
                >
                  <span className="ac-name">{name}</span>
                  {categoryLabel && <span className="ac-category">{categoryLabel}</span>}
                </li>
              );
            })
          ) : (
             <li className="autocomplete-item-empty">Nessun esercizio trovato</li>
          )}
        </ul>
      )}
    </div>
  );
}
