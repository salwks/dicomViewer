/**
 * Annotation Event Binding System
 * Comprehensive event management for annotation interactions
 * Task 34.3: Implement Click Handler and Event Binding
 * Built with shadcn/ui components
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';
import { ScrollArea } from '../ui/scroll-area';
import ClickHandler, { ClickEventData, ClickHandlerOptions } from './ClickHandler';
import { AnnotationCompat } from '../../types/annotation-compat';
import { AnnotationSelectionHandler } from '../../services/AnnotationSelectionHandler';
import { log } from '../../utils/logger';

export interface EventBinding {
  id: string;
  eventType: 'click' | 'doubleClick' | 'rightClick' | 'hover' | 'drag' | 'keypress';
  annotationType?: 'length' | 'angle' | 'area' | 'all';
  handler: (event: any) => void;
  enabled: boolean;
  priority: number;
  description: string;
}

export interface EventBindingSystemProps {
  viewportId: string;
  annotations: AnnotationCompat[];
  selectionHandler: AnnotationSelectionHandler;
  className?: string;
  onAnnotationEvent?: (eventType: string, data: any) => void;
  enableEventLog?: boolean;
  maxLogEntries?: number;
  disabled?: boolean;
}

interface EventLogEntry {
  id: string;
  timestamp: number;
  eventType: string;
  annotationId?: string;
  annotationType?: string;
  details: any;
}

export const EventBindingSystem: React.FC<EventBindingSystemProps> = ({
  viewportId,
  annotations,
  selectionHandler,
  className,
  onAnnotationEvent,
  enableEventLog = true,
  maxLogEntries = 50,
  disabled = false,
}) => {
  const [eventBindings, setEventBindings] = useState<EventBinding[]>([]);
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  const [selectedAnnotations, setSelectedAnnotations] = useState<string[]>([]);
  const [hoveredAnnotation] = useState<string | null>(null);
  const [clickHandlerOptions, setClickHandlerOptions] = useState<ClickHandlerOptions>({
    enableSingleClick: true,
    enableDoubleClick: true,
    enableRightClick: true,
    enableMultiSelect: true,
    doubleClickDelay: 300,
    clickTolerance: 5,
    preventDefaultOnAnnotation: true,
    propagateToViewport: false,
  });

  const eventBindingsRef = useRef<Map<string, EventBinding>>(new Map());

  // Log event to history
  const logEvent = useCallback((
    eventType: string,
    annotationId?: string,
    annotationType?: string,
    details?: any,
  ) => {
    if (!enableEventLog) return;

    const entry: EventLogEntry = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      eventType,
      annotationId,
      annotationType,
      details,
    };

    setEventLog(prev => {
      const newLog = [entry, ...prev];
      return newLog.slice(0, maxLogEntries);
    });

    log.info('Annotation event', {
      component: 'EventBindingSystem',
      metadata: { eventType, annotationId, annotationType, viewportId },
    });
  }, [enableEventLog, maxLogEntries, viewportId]);

  // Initialize default event bindings
  useEffect(() => {
    const defaultBindings: EventBinding[] = [
      {
        id: 'click-select',
        eventType: 'click',
        handler: (event: ClickEventData) => {
          logEvent('click', event.annotationId, event.annotation.metadata?.toolName || 'unknown', {
            coordinates: event.coordinates,
            modifiers: event.modifiers,
          });
          onAnnotationEvent?.('click', event);
        },
        enabled: true,
        priority: 10,
        description: 'Select annotation on click',
      },
      {
        id: 'double-click-edit',
        eventType: 'doubleClick',
        handler: (event: ClickEventData) => {
          logEvent('doubleClick', event.annotationId, event.annotation.metadata?.toolName || 'unknown', {
            action: 'edit',
          });
          onAnnotationEvent?.('doubleClick', event);
        },
        enabled: true,
        priority: 9,
        description: 'Edit annotation on double-click',
      },
      {
        id: 'right-click-menu',
        eventType: 'rightClick',
        handler: (event: ClickEventData) => {
          logEvent('rightClick', event.annotationId, event.annotation.metadata?.toolName || 'unknown', {
            action: 'context-menu',
          });
          onAnnotationEvent?.('rightClick', event);
        },
        enabled: true,
        priority: 8,
        description: 'Show context menu on right-click',
      },
    ];

    defaultBindings.forEach(binding => {
      eventBindingsRef.current.set(binding.id, binding);
    });

    setEventBindings(defaultBindings);
  }, [logEvent, onAnnotationEvent]);

  // Handle annotation click
  const handleAnnotationClick = useCallback((event: ClickEventData) => {
    const binding = eventBindingsRef.current.get('click-select');
    if (binding?.enabled) {
      binding.handler(event);
    }
  }, []);

  // Handle annotation double-click
  const handleAnnotationDoubleClick = useCallback((event: ClickEventData) => {
    const binding = eventBindingsRef.current.get('double-click-edit');
    if (binding?.enabled) {
      binding.handler(event);
    }
  }, []);

  // Handle annotation right-click
  const handleAnnotationRightClick = useCallback((event: ClickEventData) => {
    const binding = eventBindingsRef.current.get('right-click-menu');
    if (binding?.enabled) {
      binding.handler(event);
    }
  }, []);

  // Handle selection change
  const handleSelectionChange = useCallback((selectedIds: string[]) => {
    setSelectedAnnotations(selectedIds);
    logEvent('selection-change', undefined, undefined, {
      selectedCount: selectedIds.length,
      selectedIds,
    });
    onAnnotationEvent?.('selection-change', { selectedIds, viewportId });
  }, [logEvent, onAnnotationEvent, viewportId]);


  // Toggle event binding
  const toggleEventBinding = useCallback((bindingId: string) => {
    setEventBindings(prev => {
      return prev.map(binding => {
        if (binding.id === bindingId) {
          const updated = { ...binding, enabled: !binding.enabled };
          eventBindingsRef.current.set(bindingId, updated);

          logEvent('binding-toggle', undefined, undefined, {
            bindingId,
            eventType: binding.eventType,
            enabled: updated.enabled,
          });

          return updated;
        }
        return binding;
      });
    });
  }, [logEvent]);

  // Clear event log
  const clearEventLog = useCallback(() => {
    setEventLog([]);
    logEvent('log-cleared', undefined, undefined, { action: 'manual-clear' });
  }, [logEvent]);

  // Format timestamp for display
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  // Get event type color - 보안: Object Injection 방지를 위해 Map 사용
  const getEventTypeColor = (eventType: string) => {
    const colors = new Map([
      ['click', 'text-blue-500'],
      ['doubleClick', 'text-purple-500'],
      ['rightClick', 'text-orange-500'],
      ['hover', 'text-green-500'],
      ['selection-change', 'text-cyan-500'],
      ['binding-toggle', 'text-gray-500'],
    ]);
    return colors.get(eventType) || 'text-gray-400';
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Click Handler */}
      <ClickHandler
        viewportId={viewportId}
        annotations={annotations}
        selectionHandler={selectionHandler}
        options={clickHandlerOptions}
        onAnnotationClick={handleAnnotationClick}
        onAnnotationDoubleClick={handleAnnotationDoubleClick}
        onAnnotationRightClick={handleAnnotationRightClick}
        onSelectionChange={handleSelectionChange}
        disabled={disabled}
      />

      {/* Event Binding Controls */}
      <Card className="bg-background/90 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Event Bindings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {eventBindings.map(binding => (
            <div
              key={binding.id}
              className="flex items-center justify-between p-2 rounded-md bg-muted/50"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-xs',
                      getEventTypeColor(binding.eventType),
                    )}
                  >
                    {binding.eventType}
                  </Badge>
                  <span className="text-sm">{binding.description}</span>
                </div>
              </div>
              <Switch
                checked={binding.enabled}
                onCheckedChange={() => toggleEventBinding(binding.id)}
                disabled={disabled}
              />
            </div>
          ))}

          <Separator />

          {/* Click Handler Options */}
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground">Click Options</h4>

            <div className="flex items-center justify-between">
              <span className="text-xs">Multi-select (Ctrl/Cmd)</span>
              <Switch
                checked={clickHandlerOptions.enableMultiSelect}
                onCheckedChange={(checked) =>
                  setClickHandlerOptions(prev => ({ ...prev, enableMultiSelect: checked }))
                }
                disabled={disabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs">Prevent Default</span>
              <Switch
                checked={clickHandlerOptions.preventDefaultOnAnnotation}
                onCheckedChange={(checked) =>
                  setClickHandlerOptions(prev => ({ ...prev, preventDefaultOnAnnotation: checked }))
                }
                disabled={disabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Event Log */}
      {enableEventLog && (
        <Card className="bg-background/90 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Event Log ({eventLog.length})
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearEventLog}
                disabled={eventLog.length === 0 || disabled}
                className="h-7 text-xs"
              >
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-48 px-4 pb-4">
              {eventLog.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-8">
                  No events logged yet
                </div>
              ) : (
                <div className="space-y-1">
                  {eventLog.map(entry => (
                    <div
                      key={entry.id}
                      className={cn(
                        'flex items-start gap-2 py-1 text-xs',
                        'border-b border-border/50 last:border-0',
                      )}
                    >
                      <span className="font-mono text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs px-1 py-0',
                          getEventTypeColor(entry.eventType),
                        )}
                      >
                        {entry.eventType}
                      </Badge>
                      {entry.annotationId && (
                        <span className="text-muted-foreground">
                          {entry.annotationType} ({entry.annotationId.slice(0, 8)}...)
                        </span>
                      )}
                      {entry.details && (
                        <span className="text-muted-foreground truncate flex-1">
                          {JSON.stringify(entry.details).slice(0, 50)}...
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Status Summary */}
      <Card className="bg-background/90 backdrop-blur-sm border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <Badge variant="secondary">
                {selectedAnnotations.length} selected
              </Badge>
              {hoveredAnnotation && (
                <Badge variant="secondary">
                  Hovering: {hoveredAnnotation}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Active bindings:</span>
              <Badge variant="secondary">
                {eventBindings.filter(b => b.enabled).length} / {eventBindings.length}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EventBindingSystem;
