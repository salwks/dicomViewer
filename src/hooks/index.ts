/**
 * Custom Hooks Index
 * Exports all custom hooks for easy importing
 */

export { useAppState } from './useAppState';
export { useCornerstone } from './useCornerstone';
export { useSynchronization } from './useSynchronization';
export { useFileManagement } from './useFileManagement';
export { useToolManagement } from './useToolManagement';
export { useAppController } from './useAppController';
export { useViewportAssignments } from './useViewportAssignments';
export { useSyncSettingsPersistence } from './useSyncSettingsPersistence';
export { useSeriesManagement, useViewportAssignment } from './useSeriesManagement';
export { useViewportAssignmentManager, useSingleViewportAssignment } from './useViewportAssignmentManager';
export { useStudyManagement } from './useStudyManagement';
export { useViewportSynchronization } from './useViewportSynchronization';
export { useCrossReferenceLines } from './useCrossReferenceLines';

export type { AppState } from './useAppState';
export type { UseViewportAssignmentsReturn, ViewportAssignment } from './useViewportAssignments';
export type { ViewportSynchronizationHookProps, ViewportSynchronizationHookReturn } from './useViewportSynchronization';
export type { CrossReferenceHookProps, CrossReferenceHookReturn } from './useCrossReferenceLines';
