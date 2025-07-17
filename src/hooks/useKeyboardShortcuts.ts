import { useEffect } from 'react';

// 단축키 매핑 정의
export const KEYBOARD_SHORTCUTS = {
  z: 'Zoom',
  p: 'Pan', 
  w: 'WindowLevel',
  i: 'Invert',
  l: 'Length',
  a: 'Angle',
  r: 'RectangleROI',
  e: 'EllipticalROI',
  c: 'CircleROI',
  f: 'PlanarFreehandROI',
  b: 'Bidirectional',
  o: 'Probe',
  t: 'ArrowAnnotate'
} as const;

// 단축키 표시용 정보
export const SHORTCUT_INFO = {
  Zoom: 'Z',
  Pan: 'P',
  WindowLevel: 'W',
  Invert: 'I',
  Length: 'L',
  Angle: 'A',
  RectangleROI: 'R',
  EllipticalROI: 'E',
  CircleROI: 'C',
  PlanarFreehandROI: 'F',
  Bidirectional: 'B',
  Probe: 'O',
  ArrowAnnotate: 'T'
} as const;

interface UseKeyboardShortcutsProps {
  onToolSelect: (toolName: string) => void;
  onInvert: () => void;
  enabled?: boolean;
}

export const useKeyboardShortcuts = ({ 
  onToolSelect, 
  onInvert, 
  enabled = true 
}: UseKeyboardShortcutsProps) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // 입력 필드에 포커스가 있을 때는 단축키 무시
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // 모달이 열려있을 때는 단축키 무시
      if (document.querySelector('[role="dialog"]') || document.querySelector('.modal')) {
        return;
      }

      const key = event.key.toLowerCase();
      
      // Ctrl, Alt, Shift + 키 조합은 무시
      if (event.ctrlKey || event.altKey || event.metaKey) {
        return;
      }

      const toolName = KEYBOARD_SHORTCUTS[key as keyof typeof KEYBOARD_SHORTCUTS];
      
      if (toolName) {
        event.preventDefault();
        
        if (toolName === 'Invert') {
          onInvert();
        } else {
          onToolSelect(toolName);
        }
        
        console.log(`🎯 Keyboard shortcut activated: ${key.toUpperCase()} -> ${toolName}`);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onToolSelect, onInvert, enabled]);

  // 툴 이름으로 단축키 정보 가져오기
  const getShortcutForTool = (toolName: string): string | undefined => {
    return SHORTCUT_INFO[toolName as keyof typeof SHORTCUT_INFO];
  };

  return { getShortcutForTool };
};