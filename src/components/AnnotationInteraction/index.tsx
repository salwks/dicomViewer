/**
 * Annotation Interaction System
 * Main component for annotation click handling and event binding
 * Task 34.3: Implement Click Handler and Event Binding
 * Built with shadcn/ui components
 */

export { default as ClickHandler } from './ClickHandler';
export { default as EventBindingSystem } from './EventBindingSystem';

export type {
  ClickEventData,
  ClickHandlerOptions,
  ClickHandlerProps,
} from './ClickHandler';

export type {
  EventBinding,
  EventBindingSystemProps,
} from './EventBindingSystem';
