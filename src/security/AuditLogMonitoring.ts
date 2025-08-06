/**
 * Real-time Audit Log Monitoring System
 * Provides real-time monitoring, alerting, and analytics for audit logs
 * Supports webhooks, WebSocket connections, and dashboard integration
 */

import { AuditEvent, AuditEventType, AuditSeverity } from './AuditLogger';
import { log } from '../utils/logger';

export interface MonitoringConfig {
  enabled: boolean;
  websocketUrl?: string;
  pollingInterval: number; // ms
  alertChannels: ('email' | 'webhook' | 'dashboard' | 'sms')[];
  alertThresholds: {
    failedLoginAttempts: number;
    suspiciousActivities: number;
    criticalEvents: number;
    errorRate: number; // percentage
  };
  webhookEndpoints?: {
    [channel: string]: {
      url: string;
      headers?: Record<string, string>;
      method?: 'POST' | 'PUT';
    };
  };
}

export interface MonitoringAlert {
  id: string;
  timestamp: string;
  alertType: 'threshold_exceeded' | 'anomaly_detected' | 'policy_violation' | 'system_error';
  severity: AuditSeverity;
  title: string;
  description: string;
  affectedResources: string[];
  metrics: Record<string, number>;
  recommendations: string[];
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface RealtimeMetrics {
  eventsPerMinute: number;
  eventsPerHour: number;
  activeUsers: number;
  failedLoginAttempts: number;
  suspiciousActivities: number;
  criticalEvents: number;
  errorRate: number;
  topEventTypes: { type: AuditEventType; count: number }[];
  topUsers: { userId: string; eventCount: number }[];
  resourceAccess: { resource: string; accessCount: number }[];
}

export interface MonitoringDashboardData {
  metrics: RealtimeMetrics;
  alerts: MonitoringAlert[];
  trends: {
    hourly: { hour: string; eventCount: number }[];
    daily: { date: string; eventCount: number }[];
    weekly: { week: string; eventCount: number }[];
  };
  heatmap: {
    hour: number;
    dayOfWeek: number;
    intensity: number;
  }[];
}

/**
 * Audit Log Monitoring Service
 * Provides real-time monitoring and alerting capabilities
 */
export class AuditLogMonitoringService {
  private config: MonitoringConfig;
  private websocket?: WebSocket;
  private pollingTimer?: NodeJS.Timeout;
  private metricsCache: Map<string, any> = new Map();
  private alertHistory: MonitoringAlert[] = [];
  private listeners: Map<string, Set<Function>> = new Map();
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      enabled: false,
      pollingInterval: 5000, // 5 seconds
      alertChannels: ['dashboard'],
      alertThresholds: {
        failedLoginAttempts: 5,
        suspiciousActivities: 10,
        criticalEvents: 1,
        errorRate: 10, // 10%
      },
      ...config,
    };

    if (this.config.enabled) {
      this.initialize();
    }
  }

  /**
   * Initialize monitoring service
   */
  private async initialize(): Promise<void> {
    try {
      // Start WebSocket connection if configured
      if (this.config.websocketUrl) {
        await this.connectWebSocket();
      }

      // Start polling timer
      this.startPolling();

      log.info('Audit log monitoring service initialized', {
        component: 'AuditLogMonitoring',
        metadata: {
          websocketEnabled: !!this.config.websocketUrl,
          pollingInterval: this.config.pollingInterval,
          alertChannels: this.config.alertChannels,
        },
      });
    } catch (error) {
      log.error('Failed to initialize monitoring service', {
        component: 'AuditLogMonitoring',
      }, error as Error);
    }
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  private async connectWebSocket(): Promise<void> {
    if (!this.config.websocketUrl) return;

    try {
      this.websocket = new WebSocket(this.config.websocketUrl);

      this.websocket.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        log.info('WebSocket connected for real-time monitoring', {
          component: 'AuditLogMonitoring',
        });
        this.emit('connected');
      };

      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleRealtimeUpdate(data);
        } catch (error) {
          log.error('Failed to parse WebSocket message', {
            component: 'AuditLogMonitoring',
          }, error as Error);
        }
      };

      this.websocket.onerror = () => {
        log.error('WebSocket error', {
          component: 'AuditLogMonitoring',
        }, new Error('WebSocket connection error'));
      };

      this.websocket.onclose = () => {
        this.isConnected = false;
        this.emit('disconnected');

        // Attempt reconnection
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => this.connectWebSocket(), 5000 * this.reconnectAttempts);
        }
      };
    } catch (error) {
      log.error('Failed to connect WebSocket', {
        component: 'AuditLogMonitoring',
      }, error as Error);
    }
  }

  /**
   * Start polling for metrics updates
   */
  private startPolling(): void {
    this.pollingTimer = setInterval(() => {
      this.updateMetrics();
    }, this.config.pollingInterval);
  }

  /**
   * Handle real-time updates from WebSocket
   */
  private handleRealtimeUpdate(data: any): void {
    if (data.type === 'event') {
      this.processNewEvent(data.event as AuditEvent);
    } else if (data.type === 'metrics') {
      this.updateMetricsCache(data.metrics);
    } else if (data.type === 'alert') {
      // Handle incoming alert from external source
      this.alertHistory.unshift(data.alert);
      this.emit('alert', data.alert);
    }
  }

  /**
   * Process new audit event
   */
  public processNewEvent(event: AuditEvent): void {
    // Update real-time metrics
    this.updateEventMetrics(event);

    // Check for threshold violations
    this.checkThresholds(event);

    // Detect anomalies
    this.detectAnomalies(event);

    // Emit event for listeners
    this.emit('event', event);
  }

  /**
   * Update event-based metrics
   */
  private updateEventMetrics(event: AuditEvent): void {
    // Update events per minute/hour counters
    const now = new Date();
    const minuteKey = `events_${now.getHours()}_${now.getMinutes()}`;
    const hourKey = `events_${now.getHours()}`;

    this.incrementMetric(minuteKey, 1);
    this.incrementMetric(hourKey, 1);

    // Track event types
    this.incrementMetric(`eventType_${event.eventType}`, 1);

    // Track user activity
    if (event.userId) {
      this.incrementMetric(`user_${event.userId}`, 1);
    }

    // Track failed logins
    if (event.eventType === AuditEventType.LOGIN_FAILURE) {
      this.incrementMetric('failedLogins', 1);
    }

    // Track suspicious activities
    if (event.severity === AuditSeverity.HIGH || event.severity === AuditSeverity.CRITICAL) {
      this.incrementMetric('suspiciousActivities', 1);
    }

    // Track critical events
    if (event.severity === AuditSeverity.CRITICAL) {
      this.incrementMetric('criticalEvents', 1);
    }

    // Track errors
    if (event.outcome === 'failure') {
      this.incrementMetric('errors', 1);
    }
  }

  /**
   * Check threshold violations
   */
  private checkThresholds(event: AuditEvent): void {
    const metrics = this.getCurrentMetrics();

    // Check failed login threshold
    if (metrics.failedLoginAttempts >= this.config.alertThresholds.failedLoginAttempts) {
      this.createAlert({
        alertType: 'threshold_exceeded',
        severity: AuditSeverity.HIGH,
        title: 'Failed Login Threshold Exceeded',
        description: `Failed login attempts (${metrics.failedLoginAttempts}) exceeded threshold (${this.config.alertThresholds.failedLoginAttempts})`,
        affectedResources: [event.resource || 'authentication'],
        metrics: { failedLoginAttempts: metrics.failedLoginAttempts },
        recommendations: [
          'Review failed login attempts for potential brute force attack',
          'Consider implementing rate limiting',
          'Check for compromised credentials',
        ],
      });
    }

    // Check suspicious activities threshold
    if (metrics.suspiciousActivities >= this.config.alertThresholds.suspiciousActivities) {
      this.createAlert({
        alertType: 'threshold_exceeded',
        severity: AuditSeverity.CRITICAL,
        title: 'Suspicious Activity Threshold Exceeded',
        description: `Suspicious activities (${metrics.suspiciousActivities}) exceeded threshold (${this.config.alertThresholds.suspiciousActivities})`,
        affectedResources: [event.resource || 'system'],
        metrics: { suspiciousActivities: metrics.suspiciousActivities },
        recommendations: [
          'Investigate recent high-severity events',
          'Review user access patterns',
          'Consider enabling additional security measures',
        ],
      });
    }

    // Check error rate threshold
    const totalEvents = metrics.eventsPerHour || 1;
    const errorRate = (metrics.errorRate / totalEvents) * 100;
    if (errorRate >= this.config.alertThresholds.errorRate) {
      this.createAlert({
        alertType: 'threshold_exceeded',
        severity: AuditSeverity.MEDIUM,
        title: 'Error Rate Threshold Exceeded',
        description: `Error rate (${errorRate.toFixed(2)}%) exceeded threshold (${this.config.alertThresholds.errorRate}%)`,
        affectedResources: ['system'],
        metrics: { errorRate },
        recommendations: [
          'Review recent errors for patterns',
          'Check system health and performance',
          'Investigate potential system issues',
        ],
      });
    }
  }

  /**
   * Detect anomalies in audit patterns
   */
  private detectAnomalies(event: AuditEvent): void {
    // Detect unusual access patterns
    const hour = new Date(event.timestamp).getHours();
    if (hour >= 0 && hour <= 5) { // Late night access
      if (event.eventType.includes('PHI') || event.eventType.includes('EXPORT')) {
        this.createAlert({
          alertType: 'anomaly_detected',
          severity: AuditSeverity.MEDIUM,
          title: 'Unusual Access Pattern Detected',
          description: `Sensitive data access detected during off-hours (${hour}:00)`,
          affectedResources: [event.resource || 'data'],
          metrics: { accessHour: hour },
          recommendations: [
            'Verify if access was authorized',
            'Review user\'s typical access patterns',
            'Consider implementing time-based access controls',
          ],
        });
      }
    }

    // Detect rapid successive events from same user
    if (event.userId) {
      const userEventCount = this.getMetric(`user_${event.userId}_rapid`) || 0;
      if (userEventCount > 50) { // More than 50 events in monitoring window
        this.createAlert({
          alertType: 'anomaly_detected',
          severity: AuditSeverity.HIGH,
          title: 'Rapid Activity Detected',
          description: `User ${event.username || event.userId} generated unusually high number of events`,
          affectedResources: ['user_activity'],
          metrics: { eventCount: userEventCount },
          recommendations: [
            'Check for automated scripts or tools',
            'Verify user activity is legitimate',
            'Consider rate limiting user actions',
          ],
        });
      }
    }
  }

  /**
   * Create and dispatch alert
   */
  private createAlert(alertData: Partial<MonitoringAlert>): void {
    const alert: MonitoringAlert = {
      id: this.generateAlertId(),
      timestamp: new Date().toISOString(),
      acknowledged: false,
      ...alertData,
    } as MonitoringAlert;

    // Store in history
    this.alertHistory.unshift(alert);
    if (this.alertHistory.length > 1000) {
      this.alertHistory.pop();
    }

    // Dispatch to configured channels
    this.dispatchAlert(alert);

    // Emit alert event
    this.emit('alert', alert);
  }

  /**
   * Dispatch alert to configured channels
   */
  private async dispatchAlert(alert: MonitoringAlert): Promise<void> {
    for (const channel of this.config.alertChannels) {
      try {
        switch (channel) {
          case 'webhook':
            await this.sendWebhookAlert(alert);
            break;
          case 'dashboard':
            this.sendDashboardAlert(alert);
            break;
          case 'email':
            // Email integration would go here
            log.info('Email alert would be sent', {
              component: 'AuditLogMonitoring',
              metadata: { alertId: alert.id },
            });
            break;
          case 'sms':
            // SMS integration would go here
            log.info('SMS alert would be sent', {
              component: 'AuditLogMonitoring',
              metadata: { alertId: alert.id },
            });
            break;
        }
      } catch (error) {
        log.error(`Failed to dispatch alert to ${channel}`, {
          component: 'AuditLogMonitoring',
          metadata: { alertId: alert.id },
        }, error as Error);
      }
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(alert: MonitoringAlert): Promise<void> {
    const webhookConfig = this.config.webhookEndpoints?.webhook;
    if (!webhookConfig) return;

    try {
      const response = await fetch(webhookConfig.url, {
        method: webhookConfig.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...webhookConfig.headers,
        },
        body: JSON.stringify({
          alert,
          timestamp: new Date().toISOString(),
          source: 'audit_log_monitoring',
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }

      log.info('Webhook alert sent successfully', {
        component: 'AuditLogMonitoring',
        metadata: { alertId: alert.id },
      });
    } catch (error) {
      log.error('Failed to send webhook alert', {
        component: 'AuditLogMonitoring',
        metadata: { alertId: alert.id },
      }, error as Error);
    }
  }

  /**
   * Send dashboard alert
   */
  private sendDashboardAlert(alert: MonitoringAlert): void {
    // In a real implementation, this would update a dashboard UI
    this.emit('dashboard-alert', alert);
  }

  /**
   * Get current metrics
   */
  public getCurrentMetrics(): RealtimeMetrics {
    const now = new Date();
    const currentMinute = `events_${now.getHours()}_${now.getMinutes()}`;
    const currentHour = `events_${now.getHours()}`;

    // Calculate top event types
    const eventTypeCounts = new Map<AuditEventType, number>();
    for (const [key, value] of this.metricsCache.entries()) {
      if (key.startsWith('eventType_')) {
        const eventType = key.replace('eventType_', '') as AuditEventType;
        eventTypeCounts.set(eventType, value as number);
      }
    }
    const topEventTypes = Array.from(eventTypeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate top users
    const userCounts = new Map<string, number>();
    for (const [key, value] of this.metricsCache.entries()) {
      if (key.startsWith('user_') && !key.includes('_rapid')) {
        const userId = key.replace('user_', '');
        userCounts.set(userId, value as number);
      }
    }
    const topUsers = Array.from(userCounts.entries())
      .map(([userId, eventCount]) => ({ userId, eventCount }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 5);

    return {
      eventsPerMinute: this.getMetric(currentMinute) || 0,
      eventsPerHour: this.getMetric(currentHour) || 0,
      activeUsers: userCounts.size,
      failedLoginAttempts: this.getMetric('failedLogins') || 0,
      suspiciousActivities: this.getMetric('suspiciousActivities') || 0,
      criticalEvents: this.getMetric('criticalEvents') || 0,
      errorRate: this.getMetric('errors') || 0,
      topEventTypes,
      topUsers,
      resourceAccess: [], // Would be populated from resource tracking
    };
  }

  /**
   * Get dashboard data
   */
  public getDashboardData(): MonitoringDashboardData {
    const metrics = this.getCurrentMetrics();
    const alerts = this.alertHistory.slice(0, 20); // Last 20 alerts

    // Generate trend data (simplified for demo)
    const hourly = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      eventCount: this.getMetric(`events_${i}`) || 0,
    }));

    // Generate heatmap data
    const heatmap = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let day = 0; day < 7; day++) {
        heatmap.push({
          hour,
          dayOfWeek: day,
          intensity: Math.random() * 100, // Would use real data
        });
      }
    }

    return {
      metrics,
      alerts,
      trends: {
        hourly,
        daily: [], // Would aggregate daily data
        weekly: [], // Would aggregate weekly data
      },
      heatmap,
    };
  }

  /**
   * Acknowledge alert
   */
  public acknowledgeAlert(alertId: string, userId: string): boolean {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      alert.acknowledgedBy = userId;
      alert.acknowledgedAt = new Date().toISOString();
      this.emit('alert-acknowledged', alert);
      return true;
    }
    return false;
  }

  /**
   * Update metrics from external source
   */
  private updateMetrics(): void {
    // This would fetch metrics from the audit logger
    // For now, we'll just emit an update event
    this.emit('metrics-update', this.getCurrentMetrics());
  }

  /**
   * Helper methods for metrics management
   */
  private incrementMetric(key: string, value: number): void {
    const current = this.metricsCache.get(key) || 0;
    this.metricsCache.set(key, current + value);
  }

  private getMetric(key: string): any {
    return this.metricsCache.get(key);
  }

  private updateMetricsCache(metrics: any): void {
    Object.entries(metrics).forEach(([key, value]) => {
      this.metricsCache.set(key, value);
    });
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Event emitter methods
   */
  private emit(event: string, data?: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  public on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  public off(event: string, listener: Function): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Start monitoring
   */
  public start(): void {
    if (!this.config.enabled) {
      this.config.enabled = true;
      this.initialize();
    }
  }

  /**
   * Stop monitoring
   */
  public stop(): void {
    this.config.enabled = false;

    if (this.websocket) {
      this.websocket.close();
      this.websocket = undefined;
    }

    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }

    this.isConnected = false;
  }

  /**
   * Get monitoring status
   */
  public getStatus(): {
    enabled: boolean;
    connected: boolean;
    alertCount: number;
    unacknowledgedAlerts: number;
    } {
    const unacknowledgedAlerts = this.alertHistory.filter(a => !a.acknowledged).length;

    return {
      enabled: this.config.enabled,
      connected: this.isConnected,
      alertCount: this.alertHistory.length,
      unacknowledgedAlerts,
    };
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.stop();
    this.metricsCache.clear();
    this.alertHistory = [];
    this.listeners.clear();
  }
}

// Export singleton instance
export const auditLogMonitoring = new AuditLogMonitoringService();
