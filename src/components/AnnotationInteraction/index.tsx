/**
 * Annotation Interaction System
 * Main component for annotation click handling and event binding
 * Task 34.3: Implement Click Handler and Event Binding
 * Built with shadcn/ui components
 */

import ClickHandler from './ClickHandler';
import EventBindingSystem from './EventBindingSystem';

export { ClickHandler, EventBindingSystem };

export type {
  ClickEventData,
  ClickHandlerOptions,
  ClickHandlerProps,
} from './ClickHandler';

export type {
  EventBinding,
  EventBindingSystemProps,
} from './EventBindingSystem';
