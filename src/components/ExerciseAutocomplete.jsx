import React, { useState, useRef, useEffect } from 'react';
import { EXERCISES_DB } from '../data/exercises';
import './Autocomplete.css';

export function ExerciseAutocomplete({ value, onChange, placeholder = "Cerca esercizio...", options = null }) {
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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sourceData = options || EXERCISES_DB;

  const filteredExercises = sourceData.filter(ex => {
    const name = typeof ex === 'string' ? ex : ex.name;
    const category = typeof ex === 'string' ? '' : ex.category;
    return name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           category.toLowerCase().includes(searchTerm.toLowerCase());
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
              const category = typeof ex === 'string' ? null : ex.category;
              const id = typeof ex === 'string' ? `opt-${idx}` : ex.id;
              
              return (
                <li 
                  key={id} 
                  className="autocomplete-item"
                  onClick={() => {
                    onChange(name);
                    setIsOpen(false);
                  }}
                >
                  <span className="ac-name">{name}</span>
                  {category && <span className="ac-category">{category}</span>}
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
