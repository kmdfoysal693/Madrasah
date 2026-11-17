import type { Language } from '../data/madrasaTranslations';

interface LanguageToggleProps {
  lang: Language;
  onChange: (nextLang: Language) => void;
  fullWidth?: boolean;
}

export function LanguageToggle({
  lang,
  onChange,
  fullWidth = false,
}: LanguageToggleProps) {
  return (
    <div
      role="group"
      aria-label={lang === 'bn' ? 'ভাষা পরিবর্তন করুন' : 'Select language'}
      className={`inline-flex items-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-0.5 shrink-0 ${
        fullWidth ? 'w-full justify-center' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => onChange('bn')}
        aria-pressed={lang === 'bn'}
        title="বাংলায় দেখুন"
        className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] whitespace-nowrap ${
          fullWidth ? 'flex-1 text-center' : ''
        } ${
          lang === 'bn'
            ? 'bg-[#065F46] text-white shadow-xs'
            : 'text-[#475569] hover:text-[#0F172A]'
        }`}
      >
        Ban
      </button>
      <button
        type="button"
        onClick={() => onChange('en')}
        aria-pressed={lang === 'en'}
        title="Switch to English"
        className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#065F46] whitespace-nowrap ${
          fullWidth ? 'flex-1 text-center' : ''
        } ${
          lang === 'en'
            ? 'bg-[#065F46] text-white shadow-xs'
            : 'text-[#475569] hover:text-[#0F172A]'
        }`}
      >
        Eng
      </button>
    </div>
  );
}
