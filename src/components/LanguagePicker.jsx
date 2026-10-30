import { useState } from 'react';
import { Check, ChevronRight, Languages } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Sheet } from '../pages/monitoring/Sheet';
import { LANGUAGES, detectLanguage, resolveLanguage, tr } from '../i18n';
import './ThemePicker.css';

const languageName = id => LANGUAGES.find(l => l.id === id)?.name;

export function ProfileLanguagePicker() {
  const [open, setOpen] = useState(false);
  const choice = useStore(s => s.language);
  const setLanguage = useStore(s => s.setLanguage);
  const browser = detectLanguage(typeof navigator === 'undefined' ? [] : navigator.languages || [navigator.language]);
  const options = [
    { id: null, name: tr('Automatica'), text: tr('Segue la lingua del browser: {name}.', { name: languageName(browser) }) },
    ...LANGUAGES.map(l => ({ id: l.id, name: l.name })),
  ];
  const pick = id => { setOpen(false); setLanguage(id); };
  return <>
    <button type="button" className="ej-card theme-profile-entry" onClick={() => setOpen(true)}><Languages size={21} /><span><strong>{tr('Lingua')}</strong><small>{choice ? languageName(choice) : `${tr('Automatica')} · ${languageName(resolveLanguage(null))}`}</small></span><ChevronRight size={18} /></button>
    {open && <Sheet title={tr('Scegli la lingua')} onClose={() => setOpen(false)}>
      <div className="lang-choices" role="radiogroup" aria-label={tr('Lingua dell’app')}>
        {options.map(option => <button type="button" role="radio" aria-checked={choice === option.id} key={option.id ?? 'auto'} className="theme-option lang-option" onClick={() => pick(option.id)}><span className="theme-option-copy"><strong>{option.name}</strong>{option.text && <small>{option.text}</small>}</span><span className="theme-option-check">{choice === option.id && <Check size={16} />}</span></button>)}
      </div>
    </Sheet>}
  </>;
}
