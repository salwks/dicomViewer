import React from 'react';
import { useUIStore } from '../store';
import { useTranslation } from '../utils/i18n';
import { ArrowLeft } from 'lucide-react';

const PrivacyPolicy: React.FC = () => {
  const { currentLanguage } = useUIStore();
  const { t } = useTranslation(currentLanguage);

  const handleBackClick = () => {
    window.history.back();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: '#ffffff',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          lineHeight: '1.6',
          paddingBottom: '40px',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '32px',
            paddingBottom: '16px',
            borderBottom: '1px solid #404040',
          }}
        >
          <button
            onClick={handleBackClick}
            style={{
              background: 'none',
              border: 'none',
              color: '#3b82f6',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              padding: '8px 12px',
              borderRadius: '6px',
              marginRight: '16px',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <ArrowLeft size={16} />
            {currentLanguage === 'KR' ? '뒤로' : 
             currentLanguage === 'JP' ? '戻る' : 
             currentLanguage === 'CN' ? '返回' : 'Back'}
          </button>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              margin: 0,
              color: '#ffffff',
            }}
          >
            {t('privacyPolicyTitle')}
          </h1>
        </div>

        {/* Content */}
        <div
          style={{
            backgroundColor: '#2d2d2d',
            padding: '32px',
            borderRadius: '12px',
            border: '1px solid #404040',
            maxHeight: 'calc(100vh - 200px)',
            overflow: 'auto',
          }}
        >
          <div
            style={{
              fontSize: '16px',
              lineHeight: '1.8',
              color: '#e5e7eb',
            }}
            dangerouslySetInnerHTML={{
              __html: t('privacyPolicyContent')
                .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #ffffff; font-weight: 600;">$1</strong>')
                .replace(/## (.*?)(?=\n|$)/g, '<h2 style="color: #ffffff; font-size: 20px; font-weight: 600; margin: 24px 0 16px 0; padding-bottom: 8px; border-bottom: 1px solid #404040;">$1</h2>')
                .replace(/\n/g, '<br>')
                .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: underline;">$1</a>')
                .replace(/(stra2003@gmail\.com)/g, '<a href="mailto:$1" style="color: #3b82f6; text-decoration: underline;">$1</a>'),
            }}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '32px',
            padding: '16px',
            fontSize: '14px',
            color: '#9ca3af',
          }}
        >
          <p style={{ margin: 0 }}>
            {currentLanguage === 'KR' ? '개인정보보호에 대한 문의사항이 있으시면 언제든 연락주세요.' :
             currentLanguage === 'JP' ? 'プライバシー保護に関するご質問がございましたら、いつでもお気軽にお問い合わせください。' :
             currentLanguage === 'CN' ? '如果您对隐私保护有任何疑问，请随时联系我们。' :
             'If you have any questions about privacy protection, please feel free to contact us at any time.'}
          </p>
          <p style={{ margin: '8px 0 0 0' }}>
            <a
              href="mailto:stra2003@gmail.com"
              style={{
                color: '#3b82f6',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              stra2003@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;