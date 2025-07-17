import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Globe, Check } from 'lucide-react';
import { Language, LANGUAGE_OPTIONS, useTranslation } from '../utils/i18n';
import { useUIStore } from '../store/uiStore';

interface LanguageSelectorProps {
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ className = '' }) => {
  const { currentLanguage, setLanguage } = useUIStore();
  const { t } = useTranslation(currentLanguage);
  
  const currentOption = LANGUAGE_OPTIONS.find(option => option.value === currentLanguage);
  
  const handleLanguageChange = (language: Language) => {
    setLanguage(language);
  };
  
  return (
    <div className={className}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            style={{
              display: 'inline-flex',
              height: 'auto',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              borderRadius: '6px',
              border: '1px solid #4B5563',
              backgroundColor: '#2d2d2d',
              padding: '8px 12px',
              fontSize: '14px',
              fontWeight: '500',
              color: 'white',
              transition: 'all 0.2s',
              cursor: 'pointer',
              outline: 'none'
            }}
            title={t('selectLanguage')}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#404040';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#2d2d2d';
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = '0 0 0 2px #3B82F6';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Globe style={{ width: '16px', height: '16px' }} />
            <span style={{ fontWeight: '500' }}>{currentOption?.flag} {currentOption?.value}</span>
            <ChevronDown style={{ width: '16px', height: '16px' }} />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            style={{
              minWidth: '200px',
              backgroundColor: '#2d2d2d',
              border: '1px solid #4B5563',
              borderRadius: '6px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              zIndex: 50,
              padding: '4px',
              willChange: 'opacity, transform'
            }}
            sideOffset={5}
            align="end"
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <DropdownMenu.Item
                key={option.value}
                style={{
                  fontSize: '14px',
                  lineHeight: '1',
                  color: '#E5E7EB',
                  borderRadius: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  height: '35px',
                  padding: '0 5px',
                  position: 'relative',
                  paddingLeft: '25px',
                  userSelect: 'none',
                  outline: 'none',
                  cursor: 'pointer'
                }}
                onSelect={() => handleLanguageChange(option.value)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#404040';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{
                  position: 'absolute',
                  left: '0',
                  width: '25px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {currentLanguage === option.value && <Check style={{ width: '16px', height: '16px', color: '#60A5FA' }} />}
                </div>
                <span style={{ fontSize: '18px', marginRight: '8px' }}>{option.flag}</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: '500' }}>{option.value}</span>
                  <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{option.label}</span>
                </div>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
};

export default LanguageSelector;