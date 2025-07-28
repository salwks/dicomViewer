/**
 * Tool Setup Hook
 * Handles Cornerstone3D tool initialization and management
 */

import { useCallback } from 'react';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { ToolType } from '../../ToolPanel/constants';
import { log } from '../../../utils/logger';

const {
  ToolGroupManager,
  Enums: csToolsEnums,
  ZoomTool,
  WindowLevelTool,
  PanTool,
  StackScrollMouseWheelTool,
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
const TextAnnotateTool = null;

export const useToolSetup = (toolGroupId: string) => {
  const setupTools = useCallback(() => {
    try {
      // Add tools to Cornerstone3D - core tools only
      const toolsToAdd = [
        // Navigation and manipulation tools
        WindowLevelTool,
        PanTool,
        ZoomTool,
        StackScrollMouseWheelTool,
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
        } catch {
          // Tool already exists, ignore the error
          if (!(error as Error).message.includes('already been added')) {
            log.error(`Failed to add tool: ${ToolClass?.toolName || 'unknown'}`, {
              component: 'useToolSetup',
              metadata: { toolIndex: index, toolClass: ToolClass },
            }, error as Error);
          }
        }
      });

      // Destroy existing tool group if it exists
      const existingToolGroup = ToolGroupManager.getToolGroup(toolGroupId);
      if (existingToolGroup) {
        ToolGroupManager.destroyToolGroup(toolGroupId);
      }

      // Create a new tool group
      const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);

      if (!toolGroup) return;

      // Add tools to the tool group
      const toolsForGroup = [
        WindowLevelTool,
        PanTool,
        ZoomTool,
        StackScrollMouseWheelTool,
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
        } catch {
          log.warn(`Failed to add tool to group: ${tool.toolName}`, {
            component: 'useToolSetup',
            metadata: { toolName: tool.toolName },
          });
        }
      });

      // Add TextAnnotateTool if available
      if (TextAnnotateTool) {
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
      if (TextAnnotateTool) {
        toolGroup.setToolPassive(TextAnnotateTool.toolName);
      }

      // Stack scroll is always active
      toolGroup.setToolActive(StackScrollMouseWheelTool.toolName);

      log.info('Tools setup completed', {
        component: 'useToolSetup',
        metadata: { toolGroupId, toolCount: toolsForGroup.length },
      });

    } catch (error) {
      log.error('Failed to setup tools', {
        component: 'useToolSetup',
        metadata: { toolGroupId },
      }, error as Error);
    }
  }, [toolGroupId]);

  const safeActivateTool = useCallback((toolGroup: any, toolClass: any, toolType: string) => {
    if (!toolClass || !toolClass.toolName) {
      log.warn(`Tool ${toolType} not available in this version`, {
        component: 'useToolSetup',
        metadata: { toolType },
      });
      return false;
    }

    try {
      toolGroup.setToolActive(toolClass.toolName, {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
      });
      log.info(`${toolType} tool activated successfully`, {
        component: 'useToolSetup',
        metadata: { toolName: toolClass.toolName },
      });
      return true;
    } catch (error) {
      log.error(`Failed to activate ${toolType} tool`, {
        component: 'useToolSetup',
        metadata: { toolName: toolClass.toolName },
      }, error as Error);
      return false;
    }
  }, []);

  const setActiveTool = useCallback((toolType: ToolType) => {
    try {
      const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
      if (!toolGroup) {
        log.warn('Tool group not found', {
          component: 'useToolSetup',
          metadata: { toolGroupId, toolType },
        });
        return;
      }

      log.info('Setting active tool', {
        component: 'useToolSetup',
        metadata: { toolType, toolGroupId },
      });

      // First set all available tools to passive
      const availableTools = [
        WindowLevelTool, PanTool, ZoomTool, LengthTool, BidirectionalTool,
        RectangleROITool, EllipticalROITool, AngleTool, ArrowAnnotateTool,
        ProbeTool, PlanarFreehandROITool,
      ].filter(tool => tool && tool.toolName);

      availableTools.forEach(tool => {
        try {
          toolGroup.setToolPassive(tool.toolName);
        } catch {
          // Ignore errors for tools not in the group
        }
      });

      // Set TextAnnotateTool to passive if available
      if (TextAnnotateTool) {
        toolGroup.setToolPassive(TextAnnotateTool.toolName);
      }

      // Map ToolType to cornerstone tool names and activate
      let toolActivated = false;

      switch (toolType) {
        case ToolType.WINDOW_LEVEL:
          toolActivated = safeActivateTool(toolGroup, WindowLevelTool, 'Window/Level');
          break;
        case ToolType.ZOOM:
          toolActivated = safeActivateTool(toolGroup, ZoomTool, 'Zoom');
          break;
        case ToolType.PAN:
          toolActivated = safeActivateTool(toolGroup, PanTool, 'Pan');
          break;
        case ToolType.LENGTH:
          toolActivated = safeActivateTool(toolGroup, LengthTool, 'Length');
          break;
        case ToolType.ANGLE:
          toolActivated = safeActivateTool(toolGroup, AngleTool, 'Angle');
          break;
        case ToolType.RECTANGLE_ROI:
          toolActivated = safeActivateTool(toolGroup, RectangleROITool, 'Rectangle ROI');
          break;
        case ToolType.ELLIPSE_ROI:
          toolActivated = safeActivateTool(toolGroup, EllipticalROITool, 'Ellipse ROI');
          break;
        case ToolType.PROBE:
          toolActivated = safeActivateTool(toolGroup, ProbeTool, 'Probe');
          break;
        case ToolType.BIDIRECTIONAL:
          toolActivated = safeActivateTool(toolGroup, BidirectionalTool, 'Bidirectional');
          break;
        case ToolType.ARROW:
          toolActivated = safeActivateTool(toolGroup, ArrowAnnotateTool, 'Arrow');
          break;
        case ToolType.FREEHAND:
          toolActivated = safeActivateTool(toolGroup, PlanarFreehandROITool, 'Freehand');
          break;
        case ToolType.HEIGHT:
          toolActivated = safeActivateTool(toolGroup, HeightTool, 'Height');
          break;
        case ToolType.COBB_ANGLE:
          toolActivated = safeActivateTool(toolGroup, CobbAngleTool, 'Cobb Angle');
          break;
        case ToolType.DRAG_PROBE:
          toolActivated = safeActivateTool(toolGroup, DragProbeTool, 'Drag Probe');
          break;
        case ToolType.TEXT:
          if (TextAnnotateTool) {
            toolActivated = safeActivateTool(toolGroup, TextAnnotateTool, 'Text');
          } else {
            log.warn('Text annotation tool not available, falling back to Window/Level', {
              component: 'useToolSetup',
              metadata: { toolType: ToolType.TEXT },
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
      if (toolType !== ToolType.PAN && PanTool && PanTool.toolName) {
        try {
          toolGroup.setToolActive(PanTool.toolName, {
            bindings: [{ mouseButton: csToolsEnums.MouseBindings.Auxiliary }],
          });
        } catch {
          log.warn('Failed to activate Pan as secondary tool', { component: 'useToolSetup' });
        }
      }

      if (toolType !== ToolType.ZOOM && ZoomTool && ZoomTool.toolName) {
        try {
          toolGroup.setToolActive(ZoomTool.toolName, {
            bindings: [{ mouseButton: csToolsEnums.MouseBindings.Secondary }],
          });
        } catch {
          log.warn('Failed to activate Zoom as secondary tool', { component: 'useToolSetup' });
        }
      }

      // Always keep stack scroll active if available
      if (StackScrollMouseWheelTool && StackScrollMouseWheelTool.toolName) {
        try {
          toolGroup.setToolActive(StackScrollMouseWheelTool.toolName);
        } catch {
          log.warn('Failed to activate Stack Scroll tool', { component: 'useToolSetup' });
        }
      }

      log.info('Tool activated', {
        component: 'useToolSetup',
        metadata: { toolType, toolGroupId },
      });

    } catch (error) {
      log.error('Failed to set active tool', {
        component: 'useToolSetup',
        metadata: { toolType, toolGroupId },
      }, error as Error);
    }
  }, [toolGroupId, safeActivateTool]);

  return {
    setupTools,
    setActiveTool,
  };
};
