import React from 'react';
import { SUPPORTED_LANGUAGES, type AppLocale } from '../../shared/i18n/languages.js';

const selectClass =
    'w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-amber-50 outline-none transition-colors focus:border-amber-400/45 focus:ring-2 focus:ring-amber-400/30';

export interface LanguageSelectProps {
    value: AppLocale;
    onChange: (locale: AppLocale) => void;
    id?: string;
    className?: string;
    disabled?: boolean;
}

const LanguageSelect: React.FC<LanguageSelectProps> = ({
    value,
    onChange,
    id = 'app-language-select',
    className = '',
    disabled = false,
}) => {
    return (
        <select
            id={id}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value as AppLocale)}
            className={`${selectClass} ${className}`.trim()}
        >
            {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-zinc-900 text-amber-50">
                    {lang.nativeName}
                </option>
            ))}
        </select>
    );
};

export default LanguageSelect;
