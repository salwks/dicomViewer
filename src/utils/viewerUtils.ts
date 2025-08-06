/**
 * Viewer Utilities
 * 뷰어 관련 유틸리티 함수들
 */

import type { LayoutType, GridLayoutConfig } from '@/types/viewer';

export function getViewportCountForLayout(layout: LayoutType): number {
  switch (layout) {
    case '1x1':
      return 1;
    case '1x2':
    case '2x1':
      return 2;
    case '2x2':
      return 4;
    default:
      return 1;
  }
}

export function getGridLayoutConfig(layout: LayoutType): GridLayoutConfig {
  switch (layout) {
    case '1x1':
      return {
        layout,
        gridTemplate: {
          columns: '1fr',
          rows: '1fr',
          areas: [['viewport-0']],
        },
        viewportCount: 1,
      };
    case '1x2':
      return {
        layout,
        gridTemplate: {
          columns: '1fr',
          rows: '1fr 1fr',
          areas: [['viewport-0'], ['viewport-1']],
        },
        viewportCount: 2,
      };
    case '2x1':
      return {
        layout,
        gridTemplate: {
          columns: '1fr 1fr',
          rows: '1fr',
          areas: [['viewport-0', 'viewport-1']],
        },
        viewportCount: 2,
      };
    case '2x2':
      return {
        layout,
        gridTemplate: {
          columns: '1fr 1fr',
          rows: '1fr 1fr',
          areas: [
            ['viewport-0', 'viewport-1'],
            ['viewport-2', 'viewport-3'],
          ],
        },
        viewportCount: 4,
      };
    default:
      return getGridLayoutConfig('1x1');
  }
}

export function generateGridAreas(areas: string[][]): string {
  return areas.map(row => `"${row.join(' ')}"`).join(' ');
}
