import React, { useState } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';
import { Language, useTranslation } from '../utils/i18n';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  language
}) => {
  const { t } = useTranslation(language);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) {
      alert(t('pleaseEnterFeedback'));
      return;
    }

    // mailto를 사용한 이메일 전송
    const recipient = 'stra2003@gmail.com';
    const subject = encodeURIComponent(`[Clarity DICOM Viewer] ${title.trim()}`);
    const body = encodeURIComponent(`
피드백 제목: ${title.trim()}

피드백 내용:
${content.trim()}

---
보낸 사람: Clarity DICOM Viewer 사용자
전송 시간: ${new Date().toLocaleString()}
언어 설정: ${language}
`);

    const mailtoUrl = `mailto:${recipient}?subject=${subject}&body=${body}`;
    
    try {
      window.location.href = mailtoUrl;
      
      // 피드백 전송 후 폼 초기화 및 모달 닫기
      setTitle('');
      setContent('');
      onClose();
      
      // 성공 메시지 표시
      setTimeout(() => {
        alert(t('feedbackSent'));
      }, 100);
    } catch (error) {
      console.error('피드백 전송 오류:', error);
      alert(t('feedbackError'));
    }
  };

  const handleCancel = () => {
    setTitle('');
    setContent('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000
        }}
        onClick={handleCancel}
      />
      
      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#2d2d2d',
          border: '1px solid #404040',
          borderRadius: '8px',
          padding: '24px',
          width: '90%',
          maxWidth: '500px',
          maxHeight: '80vh',
          overflow: 'auto',
          zIndex: 1001
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
      >
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={20} style={{ color: '#3b82f6' }} />
            <h2 
              id="feedback-modal-title"
              style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                color: 'white',
                margin: 0
              }}
            >
              {t('feedback')}
            </h2>
          </div>
          <button
            onClick={handleCancel}
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#404040';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#9ca3af';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Title Input */}
          <div>
            <label 
              htmlFor="feedback-title"
              style={{ 
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#e5e7eb',
                marginBottom: '6px'
              }}
            >
              {t('feedbackTitle')}
            </label>
            <input
              id="feedback-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('feedbackTitlePlaceholder')}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#374151',
                border: '1px solid #4b5563',
                borderRadius: '6px',
                color: 'white',
                fontSize: '14px',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#4b5563';
              }}
            />
          </div>

          {/* Content Textarea */}
          <div>
            <label 
              htmlFor="feedback-content"
              style={{ 
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#e5e7eb',
                marginBottom: '6px'
              }}
            >
              {t('feedbackContent')}
            </label>
            <textarea
              id="feedback-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('feedbackContentPlaceholder')}
              rows={6}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#374151',
                border: '1px solid #4b5563',
                borderRadius: '6px',
                color: 'white',
                fontSize: '14px',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#4b5563';
              }}
            />
          </div>

          {/* Buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            justifyContent: 'flex-end',
            marginTop: '8px'
          }}>
            <button
              onClick={handleCancel}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6b7280',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#4b5563';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#6b7280';
              }}
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!title.trim() || !content.trim()}
              style={{
                padding: '8px 16px',
                backgroundColor: !title.trim() || !content.trim() ? '#4b5563' : '#3b82f6',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '500',
                cursor: !title.trim() || !content.trim() ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: !title.trim() || !content.trim() ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (title.trim() && content.trim()) {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }
              }}
              onMouseLeave={(e) => {
                if (title.trim() && content.trim()) {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                }
              }}
            >
              <Send size={14} />
              {t('send')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default FeedbackModal;