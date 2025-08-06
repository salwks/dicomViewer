/**
 * useViewer Hook
 * Layout-based unified viewer state management custom hook
 */

import { useViewer as useViewerContext } from '@/contexts/ViewerContext';

// Re-export the useViewer hook from ViewerContext for backward compatibility
export const useViewer = useViewerContext;
