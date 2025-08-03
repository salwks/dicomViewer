/**
 * Tool Setup Hook
 * Handles Cornerstone3D tool initialization and management
 */

import { useCallback } from 'react';
import * as cornerstoneTools from '@cornerstonejs/tools';
// Define tool types inline since ToolPanel/constants doesn't exist
type ToolType = string;
import { log } from '../../../utils/logger';

const {
  ToolGroupManager,
  Enums: csToolsEnums,
  ZoomTool,
  WindowLevelTool,
  PanTool,
  StackScrollTool,
  LengthTool,
  BidirectionalTool,
  RectangleROITool,
  EllipticalROITool,
  CircleROITool,
  AngleTool,
  ArrowAnnotateTool,
  ProbeTool,
  DragProbeTool,
  PlanarFreehandROITool,
  CobbAngleTool,
  HeightTool,
} = cornerstoneTools;

// TextAnnotateTool is not available in this version of Cornerstone3D
const TextAnnotateTool: any = null;

export const useToolSetup = (toolGroupId: string) => {
  const setupTools = useCallback(() => {
    try {
      // Add tools to Cornerstone3D - core tools only
      const toolsToAdd = [
        // Navigation and manipulation tools
        WindowLevelTool,
        PanTool,
        ZoomTool,
        StackScrollTool,
        // Measurement and annotation tools
        LengthTool,
        BidirectionalTool,
        RectangleROITool,
        EllipticalROITool,
        CircleROITool,
        AngleTool,
        ArrowAnnotateTool,
        ProbeTool,
        DragProbeTool,
        PlanarFreehandROITool,
        CobbAngleTool,
        HeightTool,
      ].filter(tool => tool && tool.toolName); // Filter out undefined tools

      // Add TextAnnotateTool if available
      if (TextAnnotateTool) {
        toolsToAdd.push(TextAnnotateTool);
      }

      toolsToAdd.forEach((ToolClass, index) => {
        try {
          if (!ToolClass || !ToolClass.toolName) {
            log.error(`Tool at index ${index} is undefined or missing toolName`, {
              component: 'useToolSetup',
              metadata: { toolIndex: index, toolClass: ToolClass },
            });
            return; // Skip this tool
          }
          cornerstoneTools.addTool(ToolClass);
        } catch (error) {
          // Tool already exists, ignore the error
          if (!(error as Error).message.includes('already been added')) {
            log.error(
              `Failed to add tool: ${ToolClass?.toolName || 'unknown'}`,
              {
                component: 'useToolSetup',
                metadata: { toolIndex: index, toolClass: ToolClass },
              },
              error as Error,
            );
          }
        }
      });

      // Destroy existing tool group if it exists
      const existingToolGroup = ToolGroupManager.getToolGroup(toolGroupId);
      if (existingToolGroup) {
        ToolGroupManager.destroyToolGroup(toolGroupId);
      }

      // Create a new tool group
      log.info('Creating new tool group', {
        component: 'useToolSetup',
        metadata: {
          toolGroupId,
          timestamp: new Date().toISOString(),
          existingGroupDestroyed: !!existingToolGroup,
        },
      });
      const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);

      if (!toolGroup) {
        log.error('Failed to create tool group', {
          component: 'useToolSetup',
          metadata: { toolGroupId },
        });
        return;
      }

      // Add tools to the tool group
      const toolsForGroup = [
        WindowLevelTool,
        PanTool,
        ZoomTool,
        StackScrollTool,
        LengthTool,
        BidirectionalTool,
        RectangleROITool,
        EllipticalROITool,
        CircleROITool,
        AngleTool,
        ArrowAnnotateTool,
        ProbeTool,
        DragProbeTool,
        PlanarFreehandROITool,
        CobbAngleTool,
        HeightTool,
      ].filter(tool => tool && tool.toolName);

      toolsForGroup.forEach(tool => {
        try {
          toolGroup.addTool(tool.toolName);
        } catch (error) {
          log.warn(`Failed to add tool to group: ${tool.toolName}`, {
            component: 'useToolSetup',
            metadata: {
              toolName: tool.toolName,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        }
      });

      // Add TextAnnotateTool if available
      if (TextAnnotateTool && TextAnnotateTool.toolName) {
        toolGroup.addTool(TextAnnotateTool.toolName);
      }

      // Initial tool setup - all tools set to passive initially
      toolsForGroup.forEach(tool => {
        try {
          toolGroup.setToolPassive(tool.toolName);
        } catch {
          log.warn(`Failed to set tool passive: ${tool.toolName}`, {
            component: 'useToolSetup',
            metadata: { toolName: tool.toolName },
          });
        }
      });

      // Set TextAnnotateTool to passive if available
      if (TextAnnotateTool && TextAnnotateTool.toolName) {
        toolGroup.setToolPassive(TextAnnotateTool.toolName);
      }

      // Stack scroll is always active with wheel binding
      try {
        toolGroup.setToolActive(StackScrollTool.toolName, {
          bindings: [{ mouseButton: csToolsEnums.MouseBindings.Wheel }],
        });
      } catch (error) {
        log.warn('Failed to activate StackScrollTool with wheel binding', {
          component: 'useToolSetup',
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
        });
      }

      log.info('Tools setup completed', {
        component: 'useToolSetup',
        metadata: { toolGroupId, toolCount: toolsForGroup.length },
      });
    } catch (error) {
      log.error(
        'Failed to setup tools',
        {
          component: 'useToolSetup',
          metadata: { toolGroupId },
        },
        error as Error,
      );
    }
  }, [toolGroupId]);

  const safeActivateTool = useCallback((toolGroup: any, toolClass: any, toolType: string, customBindings?: any) => {
    log.info('Attempting to activate tool', {
      component: 'useToolSetup',
      metadata: { toolType, hasToolClass: !!toolClass, toolName: toolClass?.toolName },
    });

    if (!toolClass || !toolClass.toolName) {
      log.warn(`Tool ${toolType} not available in this version`, {
        component: 'useToolSetup',
        metadata: { toolType, toolClass },
      });
      return false;
    }

    try {
      const bindings = customBindings || [{ mouseButton: csToolsEnums.MouseBindings.Primary }];
      log.info('Setting tool active', {
        component: 'useToolSetup',
        metadata: { toolName: toolClass.toolName, bindings },
      });
      toolGroup.setToolActive(toolClass.toolName, { bindings });

      log.info(`${toolType} tool activated successfully`, {
        component: 'useToolSetup',
        metadata: { toolName: toolClass.toolName },
      });
      return true;
    } catch (error) {
      log.error(
        `Failed to activate ${toolType} tool`,
        {
          component: 'useToolSetup',
          metadata: { toolName: toolClass.toolName },
        },
        error as Error,
      );
      return false;
    }
  }, []);

  const setActiveTool = useCallback(
    (toolType: ToolType) => {
      try {
        log.info('setActiveTool called', {
          component: 'useToolSetup',
          metadata: {
            timestamp: new Date().toISOString(),
            toolType,
            toolGroupId,
          },
        });

        const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
        if (!toolGroup) {
          const allGroups = ToolGroupManager.getAllToolGroups();
          log.error('Tool group not found', {
            component: 'useToolSetup',
            metadata: {
              toolGroupId,
              toolType,
              availableGroups: allGroups.map(g => ({ id: g.id, viewports: g.getViewportIds() })),
              totalGroups: allGroups.length,
            },
          });
          return;
        }

        log.info('Tool group found, setting active tool', {
          component: 'useToolSetup',
          metadata: {
            toolType,
            toolGroupId,
            toolGroupExists: !!toolGroup,
          },
        });

        log.info('Setting active tool', {
          component: 'useToolSetup',
          metadata: { toolType, toolGroupId },
        });

        // Only set primary tools to passive to minimize viewport disruption
        const primaryTools = [
          WindowLevelTool,
          PanTool,
          ZoomTool,
          StackScrollTool,
          LengthTool,
          BidirectionalTool,
          RectangleROITool,
          EllipticalROITool,
          AngleTool,
          ArrowAnnotateTool,
          ProbeTool,
          PlanarFreehandROITool,
          HeightTool,
          CobbAngleTool,
          DragProbeTool,
        ].filter(tool => tool && tool.toolName);

        // Set all primary tools to passive first (required for proper tool switching)
        primaryTools.forEach(tool => {
          try {
            toolGroup.setToolPassive(tool.toolName);
          } catch {
            // Ignore errors for tools not in the group
          }
        });

        // Set TextAnnotateTool to passive if available
        if (TextAnnotateTool && TextAnnotateTool.toolName) {
          try {
            toolGroup.setToolPassive(TextAnnotateTool.toolName);
          } catch {
            // Ignore if not available
          }
        }

        // Map ToolType to cornerstone tool names and activate
        let toolActivated = false;

        log.info('Starting tool activation', {
          component: 'useToolSetup',
          metadata: {
            toolType,
            toolGroupId,
            allViewportsInGroup: toolGroup.getViewportIds(),
            timestamp: new Date().toISOString(),
            allToolGroups: ToolGroupManager.getAllToolGroups().map(g => ({
              id: g.id,
              viewports: g.getViewportIds(),
            })),
          },
        });

        switch (toolType) {
          case 'windowLevel':
            toolActivated = safeActivateTool(toolGroup, WindowLevelTool, 'Window/Level');
            break;
          case 'zoom':
            toolActivated = safeActivateTool(toolGroup, ZoomTool, 'Zoom');
            break;
          case 'pan':
            toolActivated = safeActivateTool(toolGroup, PanTool, 'Pan');
            break;
          case 'selection':
            // Selection mode - activate pan tool but with special instructions for selection
            toolActivated = safeActivateTool(toolGroup, PanTool, 'Selection (Click annotations to select)');
            break;
          case 'length':
            toolActivated = safeActivateTool(toolGroup, LengthTool, 'Length');
            break;
          case 'angle':
            toolActivated = safeActivateTool(toolGroup, AngleTool, 'Angle');
            break;
          case 'rectangleROI':
            toolActivated = safeActivateTool(toolGroup, RectangleROITool, 'Rectangle ROI');
            break;
          case 'ellipseROI':
            toolActivated = safeActivateTool(toolGroup, EllipticalROITool, 'Ellipse ROI');
            break;
          case 'probe':
            toolActivated = safeActivateTool(toolGroup, ProbeTool, 'Probe');
            break;
          case 'bidirectional':
            toolActivated = safeActivateTool(toolGroup, BidirectionalTool, 'Bidirectional');
            break;
          case 'arrow':
            toolActivated = safeActivateTool(toolGroup, ArrowAnnotateTool, 'Arrow');
            break;
          case 'freehand':
            toolActivated = safeActivateTool(toolGroup, PlanarFreehandROITool, 'Freehand');
            break;
          case 'height':
            toolActivated = safeActivateTool(toolGroup, HeightTool, 'Height');
            break;
          case 'cobbAngle':
            toolActivated = safeActivateTool(toolGroup, CobbAngleTool, 'Cobb Angle');
            break;
          case 'dragProbe':
            toolActivated = safeActivateTool(toolGroup, DragProbeTool, 'Drag Probe');
            break;
          case 'text':
            if (TextAnnotateTool) {
              toolActivated = safeActivateTool(toolGroup, TextAnnotateTool, 'Text');
            } else {
              log.warn('Text annotation tool not available, falling back to Window/Level', {
                component: 'useToolSetup',
                metadata: { toolType: 'Text' },
              });
              toolActivated = safeActivateTool(toolGroup, WindowLevelTool, 'Window/Level (fallback)');
            }
            break;
          default:
            // Default to window/level
            toolActivated = safeActivateTool(toolGroup, WindowLevelTool, 'Window/Level (default)');
        }

        // If no tool was activated, fallback to Window/Level
        if (!toolActivated) {
          safeActivateTool(toolGroup, WindowLevelTool, 'Window/Level (emergency fallback)');
        }

        // Keep secondary tools active only if not the primary tool
        if (toolType !== 'pan' && PanTool && PanTool.toolName) {
          try {
            toolGroup.setToolActive(PanTool.toolName, {
              bindings: [{ mouseButton: csToolsEnums.MouseBindings.Auxiliary }],
            });
          } catch {
            log.warn('Failed to activate Pan as secondary tool', { component: 'useToolSetup' });
          }
        }

        if (toolType !== 'zoom' && ZoomTool && ZoomTool.toolName) {
          try {
            toolGroup.setToolActive(ZoomTool.toolName, {
              bindings: [{ mouseButton: csToolsEnums.MouseBindings.Secondary }],
            });
          } catch {
            log.warn('Failed to activate Zoom as secondary tool', { component: 'useToolSetup' });
          }
        }

        // Always keep stack scroll active if available
        if (StackScrollTool && StackScrollTool.toolName) {
          try {
            toolGroup.setToolActive(StackScrollTool.toolName, {
              bindings: [{ mouseButton: csToolsEnums.MouseBindings.Wheel }],
            });
          } catch {
            log.warn('Failed to activate Stack Scroll tool', { component: 'useToolSetup' });
          }
        }

        // DO NOT trigger viewport render here - let the viewport maintain its current state
        // This prevents zoom/pan reset when switching tools

        log.info('Tool activated', {
          component: 'useToolSetup',
          metadata: { toolType, toolGroupId },
        });
      } catch (error) {
        log.error(
          'Failed to set active tool',
          {
            component: 'useToolSetup',
            metadata: { toolType, toolGroupId },
          },
          error as Error,
        );
      }
    },
    [toolGroupId, safeActivateTool],
  );

  return {
    setupTools,
    setActiveTool,
  };
};
