import React, { useState } from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { Language, LANGUAGE_OPTIONS, useTranslation } from '../utils/i18n';
import { useUIStore } from '../store/uiStore';

interface LanguageSelectorProps {
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ className = '' }) => {
  const { currentLanguage, setLanguage } = useUIStore();
  const { t } = useTranslation(currentLanguage);
  const [isOpen, setIsOpen] = useState(false);
  
  const currentOption = LANGUAGE_OPTIONS.find(option => option.value === currentLanguage);
  
  const handleLanguageChange = (language: Language) => {
    setLanguage(language);
    setIsOpen(false);
  };
  
  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex h-auto items-center justify-center gap-2 rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
        title={t('selectLanguage')}
      >
        <Globe className="h-4 w-4" />
        <span className="font-medium">{currentOption?.flag} {currentOption?.value}</span>
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute top-full right-0 mt-1 w-48 bg-gray-800 border border-gray-600 rounded-md shadow-lg z-20 overflow-hidden">
            {LANGUAGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleLanguageChange(option.value)}
                className={`inline-flex h-auto w-full items-center justify-start gap-3 rounded-none px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-gray-700 focus:outline-none focus:bg-gray-700 ${
                  currentLanguage === option.value 
                    ? 'bg-gray-700 text-blue-400' 
                    : 'text-gray-200'
                }`}
              >
                <span className="text-lg">{option.flag}</span>
                <div className="flex flex-col">
                  <span className="font-medium">{option.value}</span>
                  <span className="text-xs text-gray-400">{option.label}</span>
                </div>
                {currentLanguage === option.value && (
                  <span className="ml-auto text-blue-400 text-xs">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default LanguageSelector;