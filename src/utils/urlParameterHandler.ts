/**
 * URL Parameter Handler
 * Handles URL-based study loading and state management for deep linking
 * Medical imaging viewer URL parameter handling
 */

import { log } from './logger';

// URL parameter interface
export interface ViewerUrlParams {
  studies?: string[]; // Array of study instance UIDs
  layout?: string; // Layout configuration (e.g., "2x2", "1x3")
  mode?: 'single' | 'comparison'; // Viewer mode
  viewport?: string; // Active viewport ID
  tool?: string; // Active tool name
}

// URL state management class
export class UrlParameterHandler {
  private static instance: UrlParameterHandler;
  private listeners: Set<(params: ViewerUrlParams) => void> = new Set();

  private constructor() {
    // Listen for browser navigation events
    window.addEventListener('popstate', this.handlePopState.bind(this));
  }

  static getInstance(): UrlParameterHandler {
    if (!UrlParameterHandler.instance) {
      UrlParameterHandler.instance = new UrlParameterHandler();
    }
    return UrlParameterHandler.instance;
  }

  /**
   * Parse current URL parameters
   */
  parseUrlParams(): ViewerUrlParams {
    const urlParams = new URLSearchParams(window.location.search);
    const params: ViewerUrlParams = {};

    // Parse studies (comma-separated)
    const studiesParam = urlParams.get('studies');
    if (studiesParam) {
      params.studies = studiesParam.split(',').filter(s => s.trim().length > 0);
    }

    // Parse layout
    const layoutParam = urlParams.get('layout');
    if (layoutParam) {
      params.layout = layoutParam;
    }

    // Parse mode
    const modeParam = urlParams.get('mode');
    if (modeParam === 'single' || modeParam === 'comparison') {
      params.mode = modeParam;
    }

    // Parse viewport
    const viewportParam = urlParams.get('viewport');
    if (viewportParam) {
      params.viewport = viewportParam;
    }

    // Parse tool
    const toolParam = urlParams.get('tool');
    if (toolParam) {
      params.tool = toolParam;
    }

    log.info('Parsed URL parameters', {
      component: 'UrlParameterHandler',
      params,
    });

    return params;
  }

  /**
   * Update URL with new parameters
   */
  updateUrlParams(params: Partial<ViewerUrlParams>, replace = false): void {
    const current = this.parseUrlParams();
    const updated = { ...current, ...params };

    const urlParams = new URLSearchParams();

    // Add studies
    if (updated.studies && updated.studies.length > 0) {
      urlParams.set('studies', updated.studies.join(','));
    }

    // Add layout
    if (updated.layout) {
      urlParams.set('layout', updated.layout);
    }

    // Add mode
    if (updated.mode) {
      urlParams.set('mode', updated.mode);
    }

    // Add viewport
    if (updated.viewport) {
      urlParams.set('viewport', updated.viewport);
    }

    // Add tool
    if (updated.tool) {
      urlParams.set('tool', updated.tool);
    }

    const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ''}`;

    try {
      if (replace) {
        window.history.replaceState(null, '', newUrl);
      } else {
        window.history.pushState(null, '', newUrl);
      }

      log.info('Updated URL parameters', {
        component: 'UrlParameterHandler',
        newUrl,
        params: updated,
      });
    } catch (error) {
      log.error(
        'Failed to update URL parameters',
        {
          component: 'UrlParameterHandler',
        },
        error as Error,
      );
    }
  }

  /**
   * Add listener for URL parameter changes
   */
  addListener(callback: (params: ViewerUrlParams) => void): void {
    this.listeners.add(callback);
  }

  /**
   * Remove listener
   */
  removeListener(callback: (params: ViewerUrlParams) => void): void {
    this.listeners.delete(callback);
  }

  /**
   * Handle browser back/forward navigation
   */
  private handlePopState(): void {
    const params = this.parseUrlParams();

    log.info('Browser navigation detected', {
      component: 'UrlParameterHandler',
      params,
    });

    // Notify all listeners
    this.listeners.forEach(callback => {
      try {
        callback(params);
      } catch (error) {
        log.error(
          'Error in URL parameter listener',
          {
            component: 'UrlParameterHandler',
          },
          error as Error,
        );
      }
    });
  }

  /**
   * Generate shareable URL for current state
   */
  generateShareableUrl(params: ViewerUrlParams): string {
    const urlParams = new URLSearchParams();

    if (params.studies && params.studies.length > 0) {
      urlParams.set('studies', params.studies.join(','));
    }

    if (params.layout) {
      urlParams.set('layout', params.layout);
    }

    if (params.mode) {
      urlParams.set('mode', params.mode);
    }

    if (params.viewport) {
      urlParams.set('viewport', params.viewport);
    }

    if (params.tool) {
      urlParams.set('tool', params.tool);
    }

    const baseUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
    return `${baseUrl}${urlParams.toString() ? `?${urlParams.toString()}` : ''}`;
  }

  /**
   * Validate study parameters for security
   */
  validateStudyParams(studies: string[]): boolean {
    // 보안: ReDoS 방지를 위한 안전한 DICOM Study UID 검증
    return studies.every(study => {
      // 길이 제한 (DICOM Study Instance UID는 보통 64자 이하)
      if (study.length > 64 || study.length < 5) {
        return false;
      }

      // 안전한 문자 검증 - 숫자와 점만 허용
      for (let i = 0; i < study.length; i++) {
        const char = study.charAt(i);
        if (char !== '.' && (char < '0' || char > '9')) {
          return false;
        }
      }

      // 점으로 시작하거나 끝나지 않고, 연속된 점이 없어야 함
      if (study.startsWith('.') || study.endsWith('.') || study.includes('..')) {
        log.warn('Invalid study instance UID format: invalid dot pattern', {
          component: 'UrlParameterHandler',
          studyUID: study,
        });
        return false;
      }

      return true;
    });
  }

  /**
   * Clear all URL parameters
   */
  clearUrlParams(): void {
    const newUrl = window.location.pathname;
    window.history.replaceState(null, '', newUrl);

    log.info('Cleared URL parameters', {
      component: 'UrlParameterHandler',
    });
  }
}

// Convenience functions
export const urlHandler = UrlParameterHandler.getInstance();

export const parseCurrentUrl = (): ViewerUrlParams => {
  return urlHandler.parseUrlParams();
};

export const updateUrl = (params: Partial<ViewerUrlParams>, replace = false): void => {
  urlHandler.updateUrlParams(params, replace);
};

export const generateShareUrl = (params: ViewerUrlParams): string => {
  return urlHandler.generateShareableUrl(params);
};
