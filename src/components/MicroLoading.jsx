import { Dna, Utensils } from 'lucide-react';
import './MicroLoading.css';
import { tr } from '../i18n';

export default function MicroLoading({ food = false, title = tr('Preparo il tuo percorso'), description = tr('Livello, storico e obiettivi si incontrano.') }) {
  const Icon = food ? Utensils : Dna;
  return <div className="micro-loading" role="status" aria-live="polite"><span className="micro-loading-symbol"><Icon size={29} /></span><strong>{title}</strong><p>{description}</p><span className="micro-loading-dots" aria-hidden="true"><i /><i /><i /></span></div>;
}
