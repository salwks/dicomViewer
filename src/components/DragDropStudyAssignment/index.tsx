/**
 * Drag and Drop Study Assignment Component
 * Enables drag-and-drop functionality for assigning studies to comparison viewport slots
 * Built with shadcn/ui components and HTML5 drag-and-drop API
 */

import React, { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { cn } from '../../lib/utils';
import { log } from '../../utils/logger';
import { StudyInfo } from '../../services/ComparisonViewportManager';

export interface ViewportSlot {
  id: string;
  position: number;
  assignedStudy?: StudyInfo;
  isActive: boolean;
  label: string;
}

export interface DragDropStudyAssignmentProps {
  availableStudies: StudyInfo[];
  viewportSlots: ViewportSlot[];
  onAssignment: (slotId: string, study: StudyInfo | null) => void;
  onReorder?: (fromSlotId: string, toSlotId: string) => void;
  maxSlots?: number;
  className?: string;
  showInstructions?: boolean;
  layout?: '1x2' | '2x2' | '3x3';
}

interface DragData {
  type: 'study' | 'slot';
  study?: StudyInfo;
  slotId?: string;
  sourceIndex?: number;
}

export const DragDropStudyAssignment: React.FC<DragDropStudyAssignmentProps> = ({
  availableStudies,
  viewportSlots,
  onAssignment,
  onReorder,
  maxSlots = 4,
  className,
  showInstructions = true,
  layout = '2x2',
}) => {
  const [draggedItem, setDraggedItem] = useState<DragData | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [dropEffect, setDropEffect] = useState<'move' | 'copy' | 'none'>('none');
  const dragImageRef = useRef<HTMLDivElement>(null);

  // Handle drag start for studies
  const handleStudyDragStart = useCallback((
    e: React.DragEvent<HTMLDivElement>,
    study: StudyInfo,
    sourceIndex: number,
  ) => {
    const dragData: DragData = {
      type: 'study',
      study,
      sourceIndex,
    };

    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    setDraggedItem(dragData);

    // Create custom drag image
    if (dragImageRef.current) {
      e.dataTransfer.setDragImage(dragImageRef.current, 50, 20);
    }

    log.info('Study drag started', {
      component: 'DragDropStudyAssignment',
      metadata: {
        studyId: study.studyInstanceUID,
        patientId: study.patientId,
      },
    });
  }, []);

  // Handle drag start for assigned slots (for reordering)
  const handleSlotDragStart = useCallback((
    e: React.DragEvent<HTMLDivElement>,
    slot: ViewportSlot,
  ) => {
    if (!slot.assignedStudy) return;

    const dragData: DragData = {
      type: 'slot',
      study: slot.assignedStudy,
      slotId: slot.id,
    };

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    setDraggedItem(dragData);

    log.info('Slot drag started for reordering', {
      component: 'DragDropStudyAssignment',
      metadata: {
        slotId: slot.id,
        studyId: slot.assignedStudy.studyInstanceUID,
      },
    });
  }, []);

  // Handle drag over slot
  const handleSlotDragOver = useCallback((
    e: React.DragEvent<HTMLDivElement>,
    slot: ViewportSlot,
  ) => {
    e.preventDefault();

    if (!draggedItem) return;

    // Determine drop effect
    if (draggedItem.type === 'study') {
      e.dataTransfer.dropEffect = 'copy';
      setDropEffect('copy');
    } else if (draggedItem.type === 'slot' && draggedItem.slotId !== slot.id) {
      e.dataTransfer.dropEffect = 'move';
      setDropEffect('move');
    } else {
      e.dataTransfer.dropEffect = 'none';
      setDropEffect('none');
      return;
    }

    setDragOverSlot(slot.id);
  }, [draggedItem]);

  // Handle drag leave
  const handleSlotDragLeave = useCallback(() => {
    setDragOverSlot(null);
    setDropEffect('none');
  }, []);

  // Handle drop on slot
  const handleSlotDrop = useCallback((
    e: React.DragEvent<HTMLDivElement>,
    targetSlot: ViewportSlot,
  ) => {
    e.preventDefault();

    const dataText = e.dataTransfer.getData('application/json');
    if (!dataText) return;

    try {
      const dragData: DragData = JSON.parse(dataText);

      if (dragData.type === 'study' && dragData.study) {
        // Assign study to slot
        onAssignment(targetSlot.id, dragData.study);

        log.info('Study assigned to slot via drag-drop', {
          component: 'DragDropStudyAssignment',
          metadata: {
            slotId: targetSlot.id,
            studyId: dragData.study.studyInstanceUID,
          },
        });
      } else if (dragData.type === 'slot' && dragData.slotId && onReorder) {
        // Reorder slots
        if (dragData.slotId !== targetSlot.id) {
          onReorder(dragData.slotId, targetSlot.id);

          log.info('Slots reordered via drag-drop', {
            component: 'DragDropStudyAssignment',
            metadata: {
              fromSlotId: dragData.slotId,
              toSlotId: targetSlot.id,
            },
          });
        }
      }
    } catch (error) {
      log.error('Failed to process drop', {
        component: 'DragDropStudyAssignment',
      }, error as Error);
    }

    // Reset drag state
    setDragOverSlot(null);
    setDraggedItem(null);
    setDropEffect('none');
  }, [onAssignment, onReorder]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverSlot(null);
    setDropEffect('none');
  }, []);

  // Remove study from slot
  const handleRemoveStudy = useCallback((slotId: string) => {
    onAssignment(slotId, null);

    log.info('Study removed from slot', {
      component: 'DragDropStudyAssignment',
      metadata: { slotId },
    });
  }, [onAssignment]);

  // Get grid layout classes
  const getGridClasses = useCallback(() => {
    switch (layout) {
      case '1x2':
        return 'grid-cols-2 grid-rows-1';
      case '3x3':
        return 'grid-cols-3 grid-rows-3';
      case '2x2':
      default:
        return 'grid-cols-2 grid-rows-2';
    }
  }, [layout]);

  // Get unassigned studies
  const unassignedStudies = availableStudies.filter(study =>
    !viewportSlots.some(slot =>
      slot.assignedStudy?.studyInstanceUID === study.studyInstanceUID,
    ),
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Instructions */}
      {showInstructions && (
        <Alert>
          <AlertDescription>
            Drag studies from the list below to assign them to viewport slots.
            Drag between slots to reorder.
          </AlertDescription>
        </Alert>
      )}

      {/* Viewport Slots Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Viewport Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn('grid gap-3', getGridClasses())}>
            {viewportSlots.slice(0, maxSlots).map((slot) => (
              <div
                key={slot.id}
                className={cn(
                  'relative border-2 border-dashed rounded-lg p-4 min-h-[120px]',
                  'transition-all duration-200',
                  slot.assignedStudy && 'border-solid bg-muted/50',
                  dragOverSlot === slot.id && dropEffect !== 'none' && 'border-primary bg-primary/10',
                  slot.isActive && 'ring-2 ring-primary ring-offset-2',
                )}
                onDragOver={(e) => handleSlotDragOver(e, slot)}
                onDragLeave={handleSlotDragLeave}
                onDrop={(e) => handleSlotDrop(e, slot)}
              >
                <div className="absolute top-2 left-2">
                  <Badge variant="outline" className="text-xs">
                    {slot.label}
                  </Badge>
                </div>

                {slot.assignedStudy ? (
                  <div
                    draggable
                    onDragStart={(e) => handleSlotDragStart(e, slot)}
                    onDragEnd={handleDragEnd}
                    className="cursor-move pt-6"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-sm truncate">
                        {slot.assignedStudy.patientName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {slot.assignedStudy.studyDate}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {slot.assignedStudy.modality}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleRemoveStudy(slot.id)}
                        >
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full pt-6">
                    <p className="text-sm text-muted-foreground">
                      Drop study here
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Available Studies */}
      {unassignedStudies.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Available Studies</CardTitle>
              <Badge variant="outline">
                {unassignedStudies.length} unassigned
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {unassignedStudies.map((study, index) => (
                <div
                  key={study.studyInstanceUID}
                  draggable
                  onDragStart={(e) => handleStudyDragStart(e, study, index)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    'p-3 border rounded-lg cursor-move',
                    'hover:bg-muted/50 transition-colors',
                    draggedItem?.study?.studyInstanceUID === study.studyInstanceUID && 'opacity-50',
                  )}
                >
                  <div className="space-y-1">
                    <p className="font-medium text-sm truncate">
                      {study.patientName}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {study.studyDate}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {study.modality}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {study.seriesCount} series
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hidden drag image */}
      <div
        ref={dragImageRef}
        className="fixed -top-[1000px] left-0 p-2 bg-primary text-primary-foreground rounded shadow-lg pointer-events-none"
      >
        <span className="text-xs font-medium">Dragging Study</span>
      </div>
    </div>
  );
};

export default DragDropStudyAssignment;
