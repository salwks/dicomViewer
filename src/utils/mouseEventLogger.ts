/**
 * Mouse Event Logger for debugging viewport interactions
 */

export class MouseEventLogger {
  private static instance: MouseEventLogger;
  private isEnabled = process.env.NODE_ENV === 'development';

  static getInstance(): MouseEventLogger {
    if (!MouseEventLogger.instance) {
      MouseEventLogger.instance = new MouseEventLogger();
    }
    return MouseEventLogger.instance;
  }

  attachToViewport(element: HTMLElement, viewportId: string) {
    if (!this.isEnabled) return;

    console.info('🖱️🖱️🖱️ MOUSE LOGGER: Attaching mouse event logger to viewport', { viewportId });

    // Mouse events
    element.addEventListener('mousedown', (event) => {
      console.info('🖱️🖱️🖱️ MOUSE EVENT: mousedown', {
        timestamp: new Date().toISOString(),
        viewportId,
        button: event.button,
        clientX: event.clientX,
        clientY: event.clientY,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
      });
    });

    element.addEventListener('mouseup', (event) => {
      console.info('🖱️🖱️🖱️ MOUSE EVENT: mouseup', {
        timestamp: new Date().toISOString(),
        viewportId,
        button: event.button,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    });

    element.addEventListener('mousemove', (event) => {
      // Only log mouse move when button is pressed to avoid spam
      if (event.buttons > 0) {
        console.info('🖱️🖱️🖱️ MOUSE EVENT: mousemove (dragging)', {
          timestamp: new Date().toISOString(),
          viewportId,
          buttons: event.buttons,
          clientX: event.clientX,
          clientY: event.clientY,
          movementX: event.movementX,
          movementY: event.movementY,
        });
      }
    });

    // Touch events for mobile
    element.addEventListener('touchstart', (event) => {
      console.info('👆👆👆 TOUCH EVENT: touchstart', {
        timestamp: new Date().toISOString(),
        viewportId,
        touches: event.touches.length,
        clientX: event.touches[0]?.clientX,
        clientY: event.touches[0]?.clientY,
      });
    });

    element.addEventListener('touchend', (event) => {
      console.info('👆👆👆 TOUCH EVENT: touchend', {
        timestamp: new Date().toISOString(),
        viewportId,
        touches: event.touches.length,
      });
    });

    // Wheel events
    element.addEventListener('wheel', (event) => {
      console.info('🎡🎡🎡 WHEEL EVENT: wheel', {
        timestamp: new Date().toISOString(),
        viewportId,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaZ: event.deltaZ,
        ctrlKey: event.ctrlKey,
      });
    });

    console.info('✅✅✅ MOUSE LOGGER: Event listeners attached to viewport', { viewportId });
  }

  logViewportAction(action: string, viewportId: string, data?: any) {
    if (!this.isEnabled) return;

    console.info('📊📊📊 VIEWPORT ACTION:', {
      timestamp: new Date().toISOString(),
      action,
      viewportId,
      data,
    });
  }

  logToolRendering(toolName: string, viewportId: string, data?: any) {
    if (!this.isEnabled) return;

    console.info('🎨🎨🎨 TOOL RENDERING:', {
      timestamp: new Date().toISOString(),
      toolName,
      viewportId,
      data,
    });
  }
}

export const mouseEventLogger = MouseEventLogger.getInstance();
