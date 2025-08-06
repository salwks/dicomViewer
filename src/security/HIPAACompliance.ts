/**
 * HIPAA Compliance Module
 * Implements HIPAA (Health Insurance Portability and Accountability Act) compliance features
 * for medical imaging applications handling Protected Health Information (PHI)
 */

import { EventEmitter } from 'events';
import { securityManager, AuditEventType, SecurityViolation } from './SecurityManager';
// import { secureStorage } from './secureStorage'; // Removed unused import
import { log } from '../utils/logger';

// HIPAA-specific configuration
export interface HIPAAConfig {
  enableSafeguards: {
    administrative: boolean;
    physical: boolean;
    technical: boolean;
  };

  // Administrative Safeguards
  administrativeControls: {
    assignedSecurityResponsibility: boolean;
    workforceTraining: boolean;
    informationAccessManagement: boolean;
    securityAwarenessTraining: boolean;
    securityIncidentProcedures: boolean;
    contingencyPlan: boolean;
    regularSecurityEvaluations: boolean;
  };

  // Physical Safeguards
  physicalControls: {
    facilityAccessControls: boolean;
    workstationUse: boolean;
    deviceAndMediaControls: boolean;
  };

  // Technical Safeguards
  technicalControls: {
    accessControl: boolean;
    auditControls: boolean;
    integrity: boolean;
    personOrEntityAuthentication: boolean;
    transmissionSecurity: boolean;
  };

  // Data handling
  dataClassification: {
    enablePHIDetection: boolean;
    autoClassifyData: boolean;
    phiPatterns: RegExp[];
  };

  // Breach notification
  breachNotification: {
    enableAutomaticDetection: boolean;
    notificationThresholdMinutes: number;
    requireManualReview: boolean;
  };
}

// PHI (Protected Health Information) data types
export enum PHIType {
  PATIENT_NAME = 'patient_name',
  PATIENT_ID = 'patient_id',
  DATE_OF_BIRTH = 'date_of_birth',
  SSN = 'ssn',
  ADDRESS = 'address',
  PHONE = 'phone',
  EMAIL = 'email',
  MEDICAL_RECORD_NUMBER = 'medical_record_number',
  HEALTH_PLAN_NUMBER = 'health_plan_number',
  ACCOUNT_NUMBER = 'account_number',
  CERTIFICATE_NUMBER = 'certificate_number',
  VEHICLE_IDENTIFIER = 'vehicle_identifier',
  DEVICE_IDENTIFIER = 'device_identifier',
  WEB_URL = 'web_url',
  IP_ADDRESS = 'ip_address',
  BIOMETRIC_IDENTIFIER = 'biometric_identifier',
  PHOTO = 'photo',
  OTHER_UNIQUE_IDENTIFIER = 'other_unique_identifier',
}

// PHI detection result
export interface PHIDetectionResult {
  hasPHI: boolean;
  phiTypes: PHIType[];
  confidenceScore: number; // 0-1
  locations: Array<{
    field: string;
    value: string;
    type: PHIType;
    masked: boolean;
  }>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// HIPAA breach incident
export interface HIPAABreachIncident {
  id: string;
  timestamp: Date;
  type: 'unauthorized_access' | 'data_theft' | 'accidental_disclosure' | 'system_compromise';
  severity: 'minor' | 'major' | 'critical';
  affectedRecords: number;
  phiInvolved: PHIType[];
  description: string;
  discoveryMethod: 'automated' | 'manual' | 'external_report';
  status: 'detected' | 'under_investigation' | 'contained' | 'resolved';
  containmentActions: string[];
  notificationRequired: boolean;
  notificationSent: boolean;
  investigationNotes: string[];
}

// Data masking configuration
export interface DataMaskingConfig {
  enableAutoMask: boolean;
  maskingRules: MaskingRule[];
  preserveLength: boolean;
  maskingCharacter: string;
}

export interface MaskingRule {
  phiType: PHIType;
  pattern: RegExp;
  replacement: string | ((match: string) => string);
  exceptions?: string[];
}

// Default HIPAA configuration
export const DEFAULT_HIPAA_CONFIG: HIPAAConfig = {
  enableSafeguards: {
    administrative: true,
    physical: true,
    technical: true,
  },

  administrativeControls: {
    assignedSecurityResponsibility: true,
    workforceTraining: true,
    informationAccessManagement: true,
    securityAwarenessTraining: true,
    securityIncidentProcedures: true,
    contingencyPlan: true,
    regularSecurityEvaluations: true,
  },

  physicalControls: {
    facilityAccessControls: true,
    workstationUse: true,
    deviceAndMediaControls: true,
  },

  technicalControls: {
    accessControl: true,
    auditControls: true,
    integrity: true,
    personOrEntityAuthentication: true,
    transmissionSecurity: true,
  },

  dataClassification: {
    enablePHIDetection: true,
    autoClassifyData: true,
    phiPatterns: [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{10,}\b/, // Medical record numbers
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d{3}-\d{3}-\d{4}\b/, // Phone numbers
    ],
  },

  breachNotification: {
    enableAutomaticDetection: true,
    notificationThresholdMinutes: 60,
    requireManualReview: true,
  },
};

export class HIPAAComplianceManager extends EventEmitter {
  private config: HIPAAConfig;
  private breachIncidents: Map<string, HIPAABreachIncident> = new Map();
  private maskingConfig: DataMaskingConfig;
  private complianceViolations: Map<string, SecurityViolation> = new Map();

  constructor(config: Partial<HIPAAConfig> = {}) {
    super();
    this.config = { ...DEFAULT_HIPAA_CONFIG, ...config };
    this.maskingConfig = this.createDefaultMaskingConfig();
    this.initializeHIPAACompliance();
  }

  /**
   * Initialize HIPAA compliance system
   */
  private async initializeHIPAACompliance(): Promise<void> {
    try {
      // Setup administrative safeguards
      if (this.config.enableSafeguards.administrative) {
        await this.setupAdministrativeSafeguards();
      }

      // Setup technical safeguards
      if (this.config.enableSafeguards.technical) {
        await this.setupTechnicalSafeguards();
      }

      // Setup physical safeguards monitoring
      if (this.config.enableSafeguards.physical) {
        await this.setupPhysicalSafeguards();
      }

      // Initialize breach detection
      if (this.config.breachNotification.enableAutomaticDetection) {
        this.initializeBreachDetection();
      }

      // Setup PHI detection
      if (this.config.dataClassification.enablePHIDetection) {
        this.initializePHIDetection();
      }

      log.info('HIPAA Compliance Manager initialized', {
        component: 'HIPAAComplianceManager',
        metadata: {
          safeguards: this.config.enableSafeguards,
          breachDetection: this.config.breachNotification.enableAutomaticDetection,
          phiDetection: this.config.dataClassification.enablePHIDetection,
        },
      });

      this.emit('hipaaInitialized', this.config);

    } catch (error) {
      log.error('Failed to initialize HIPAA compliance', {
        component: 'HIPAAComplianceManager',
      }, error as Error);
      throw error;
    }
  }

  /**
   * Setup administrative safeguards
   */
  private async setupAdministrativeSafeguards(): Promise<void> {
    // Assign security responsibility
    if (this.config.administrativeControls.assignedSecurityResponsibility) {
      securityManager.auditLog(AuditEventType.CONFIG_CHANGE, 'hipaa_administrative_safeguards_enabled', {
        controls: this.config.administrativeControls,
      });
    }

    // Setup security incident procedures
    if (this.config.administrativeControls.securityIncidentProcedures) {
      securityManager.on('securityViolation', (violation) => {
        this.handleSecurityIncident(violation);
      });
    }

    // Setup regular security evaluations
    if (this.config.administrativeControls.regularSecurityEvaluations) {
      this.scheduleSecurityEvaluations();
    }
  }

  /**
   * Setup technical safeguards
   */
  private async setupTechnicalSafeguards(): Promise<void> {
    // Audit controls
    if (this.config.technicalControls.auditControls) {
      // Ensure all DICOM access is audited
      this.setupDICOMAuditLogging();
    }

    // Data integrity controls
    if (this.config.technicalControls.integrity) {
      this.setupDataIntegrityChecks();
    }

    // Transmission security
    if (this.config.technicalControls.transmissionSecurity) {
      this.setupTransmissionSecurity();
    }
  }

  /**
   * Setup physical safeguards
   */
  private async setupPhysicalSafeguards(): Promise<void> {
    // Workstation use monitoring
    if (this.config.physicalControls.workstationUse) {
      this.setupWorkstationMonitoring();
    }

    // Device and media controls
    if (this.config.physicalControls.deviceAndMediaControls) {
      this.setupDeviceControls();
    }
  }

  /**
   * Initialize breach detection system
   */
  private initializeBreachDetection(): void {
    // Monitor for suspicious activities
    securityManager.on('securityViolation', (violation) => {
      this.evaluateBreachRisk(violation);
    });

    // Monitor data access patterns
    securityManager.on('auditEvent', (event) => {
      if (event.eventType === AuditEventType.DATA_ACCESS) {
        this.analyzeDataAccessPattern(event);
      }
    });
  }

  /**
   * Initialize PHI detection system
   */
  private initializePHIDetection(): void {
    // Setup automatic PHI scanning for incoming data
    this.emit('phiDetectionReady');
  }

  /**
   * Detect PHI in data
   */
  public detectPHI(data: Record<string, unknown>): PHIDetectionResult {
    const result: PHIDetectionResult = {
      hasPHI: false,
      phiTypes: [],
      confidenceScore: 0,
      locations: [],
      riskLevel: 'low',
    };

    // Scan each field for PHI patterns
    for (const [field, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        const phiDetection = this.scanFieldForPHI(field, value);
        if (phiDetection.length > 0) {
          result.hasPHI = true;
          result.locations.push(...phiDetection);
          phiDetection.forEach(detection => {
            if (!result.phiTypes.includes(detection.type)) {
              result.phiTypes.push(detection.type);
            }
          });
        }
      }
    }

    // Calculate confidence score and risk level
    result.confidenceScore = this.calculateConfidenceScore(result.locations);
    result.riskLevel = this.calculateRiskLevel(result.phiTypes, result.locations.length);

    // Audit PHI detection
    if (result.hasPHI) {
      securityManager.auditLog(AuditEventType.DATA_ACCESS, 'phi_detected', {
        phiTypes: result.phiTypes,
        confidenceScore: result.confidenceScore,
        riskLevel: result.riskLevel,
        fieldCount: result.locations.length,
      }, 'success', result.riskLevel);
    }

    return result;
  }

  /**
   * Mask PHI data
   */
  public maskPHI(data: Record<string, unknown>): Record<string, unknown> {
    if (!this.maskingConfig.enableAutoMask) return data;

    const maskedData = { ...data };
    const phiDetection = this.detectPHI(data);

    if (phiDetection.hasPHI) {
      for (const location of phiDetection.locations) {
        const rule = this.maskingConfig.maskingRules.find(r => r.phiType === location.type);
        if (rule) {


          maskedData[location.field] = this.applyMaskingRule(location.value, rule);
          location.masked = true;
        }
      }

      // Audit masking action
      securityManager.auditLog(AuditEventType.DATA_MODIFICATION, 'phi_masked', {
        fieldsCount: phiDetection.locations.filter(l => l.masked).length,
        phiTypes: phiDetection.phiTypes,
      });
    }

    return maskedData;
  }

  /**
   * Record HIPAA breach incident
   */
  public recordBreachIncident(
    type: HIPAABreachIncident['type'],
    severity: HIPAABreachIncident['severity'],
    description: string,
    affectedRecords: number,
    phiInvolved: PHIType[] = [],
  ): string {
    const incident: HIPAABreachIncident = {
      id: this.generateId(),
      timestamp: new Date(),
      type,
      severity,
      affectedRecords,
      phiInvolved,
      description,
      discoveryMethod: 'automated',
      status: 'detected',
      containmentActions: [],
      notificationRequired: this.determineNotificationRequirement(severity, affectedRecords),
      notificationSent: false,
      investigationNotes: [],
    };

    this.breachIncidents.set(incident.id, incident);

    // Log the breach
    log.error('HIPAA breach incident recorded', {
      component: 'HIPAAComplianceManager',
      metadata: incident,
    });

    // Create security violation
    const violationId = securityManager.recordViolation(
      'data_breach',
      severity === 'minor' ? 'low' : severity === 'major' ? 'medium' : severity,
      `HIPAA breach: ${description}`,
      { breachId: incident.id, affectedRecords, phiInvolved },
    );

    // Audit the breach
    securityManager.auditLog(AuditEventType.SECURITY_VIOLATION, 'hipaa_breach_detected', {
      breachId: incident.id,
      violationId,
      type,
      severity,
      affectedRecords,
      phiInvolved,
    }, 'failure', 'critical');

    // Emit breach event
    this.emit('breachDetected', incident);

    // Auto-trigger containment if critical
    if (severity === 'critical') {
      this.initiateEmergencyContainment(incident.id);
    }

    return incident.id;
  }

  /**
   * Generate compliance report
   */
  public generateComplianceReport(): {
    overallCompliance: number;
    safeguardCompliance: Record<string, boolean>;
    breachSummary: {
      total: number;
      byType: Record<string, number>;
      bySeverity: Record<string, number>;
      unresolved: number;
    };
    auditSummary: {
      totalEvents: number;
      phiAccess: number;
      violations: number;
    };
    recommendations: string[];
    } {
    const auditLogs = securityManager.getAuditLogs(1000);
    const violations = securityManager.getViolations();
    const breaches = Array.from(this.breachIncidents.values());

    // Calculate overall compliance score
    const safeguardCompliance = {
      administrative: this.evaluateAdministrativeCompliance(),
      physical: this.evaluatePhysicalCompliance(),
      technical: this.evaluateTechnicalCompliance(),
    };

    const overallCompliance = (
      (safeguardCompliance.administrative ? 1 : 0) +
      (safeguardCompliance.physical ? 1 : 0) +
      (safeguardCompliance.technical ? 1 : 0)
    ) / 3 * 100;

    // Breach summary
    const breachSummary = {
      total: breaches.length,
      byType: this.groupBy(breaches, 'type'),
      bySeverity: this.groupBy(breaches, 'severity'),
      unresolved: breaches.filter(b => b.status !== 'resolved').length,
    };

    // Audit summary
    const auditSummary = {
      totalEvents: auditLogs.length,
      phiAccess: auditLogs.filter(log => log.eventType === AuditEventType.DATA_ACCESS).length,
      violations: violations.length,
    };

    // Generate recommendations
    const recommendations = this.generateComplianceRecommendations(
      safeguardCompliance,
      breachSummary,
      auditSummary,
    );

    return {
      overallCompliance,
      safeguardCompliance,
      breachSummary,
      auditSummary,
      recommendations,
    };
  }

  // Private helper methods

  private scanFieldForPHI(field: string, value: string): Array<{
    field: string;
    value: string;
    type: PHIType;
    masked: boolean;
  }> {
    const detections: Array<{
      field: string;
      value: string;
      type: PHIType;
      masked: boolean;
    }> = [];

    // Check known PHI fields

    const phiFieldMap: Record<string, PHIType> = {
      'PatientName': PHIType.PATIENT_NAME,
      'PatientID': PHIType.PATIENT_ID,
      'PatientBirthDate': PHIType.DATE_OF_BIRTH,
      'PatientAddress': PHIType.ADDRESS,
      'PatientPhone': PHIType.PHONE,
      'PatientEmail': PHIType.EMAIL,
    };

    // eslint-disable-next-line security/detect-object-injection -- Safe field access
    if (phiFieldMap[field]) {
      detections.push({
        field,
        value,
        // eslint-disable-next-line security/detect-object-injection -- Safe field access
        type: phiFieldMap[field],
        masked: false,
      });
    }

    // Check patterns
    for (const pattern of this.config.dataClassification.phiPatterns) {
      if (pattern.test(value)) {
        detections.push({
          field,
          value,
          type: this.getPhiTypeFromPattern(pattern),
          masked: false,
        });
      }
    }

    return detections;
  }

  private getPhiTypeFromPattern(pattern: RegExp): PHIType {
    const patternString = pattern.toString();
    if (patternString.includes('\\d{3}-\\d{2}-\\d{4}')) return PHIType.SSN;
    if (patternString.includes('@')) return PHIType.EMAIL;
    if (patternString.includes('\\d{3}-\\d{3}-\\d{4}')) return PHIType.PHONE;
    return PHIType.OTHER_UNIQUE_IDENTIFIER;
  }

  private calculateConfidenceScore(locations: Array<{ field: string; value: string; type: PHIType; masked: boolean }>): number {
    if (locations.length === 0) return 0;

    // Higher confidence for known PHI field names
    let score = 0;
    for (const location of locations) {
      if (['PatientName', 'PatientID', 'PatientBirthDate'].includes(location.field)) {
        score += 0.9;
      } else {
        score += 0.6;
      }
    }

    return Math.min(score / locations.length, 1);
  }

  private calculateRiskLevel(phiTypes: PHIType[], locationCount: number): 'low' | 'medium' | 'high' | 'critical' {
    if (locationCount === 0) return 'low';

    // Critical PHI types
    const criticalTypes = [PHIType.SSN, PHIType.MEDICAL_RECORD_NUMBER];
    if (phiTypes.some(type => criticalTypes.includes(type))) return 'critical';

    // High risk for multiple PHI fields
    if (locationCount >= 3) return 'high';
    if (locationCount >= 2) return 'medium';

    return 'low';
  }

  private applyMaskingRule(value: string, rule: MaskingRule): string {
    if (typeof rule.replacement === 'function') {
      return rule.replacement(value);
    }

    if (this.maskingConfig.preserveLength) {
      return this.maskingConfig.maskingCharacter.repeat(value.length);
    }

    return rule.replacement;
  }

  private createDefaultMaskingConfig(): DataMaskingConfig {
    return {
      enableAutoMask: true,
      preserveLength: true,
      maskingCharacter: '*',
      maskingRules: [
        {
          phiType: PHIType.SSN,
          pattern: /\b\d{3}-\d{2}-\d{4}\b/,
          replacement: 'XXX-XX-XXXX',
        },
        {
          phiType: PHIType.PATIENT_NAME,
          pattern: /.*/,
          replacement: (value: string) => value.replace(/./g, '*'),
        },
        {
          phiType: PHIType.EMAIL,
          pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
          replacement: '***@***.***',
        },
      ],
    };
  }

  private handleSecurityIncident(violation: SecurityViolation): void {
    // Evaluate if this constitutes a HIPAA breach
    if (this.isHIPAABreach(violation)) {
      this.recordBreachIncident(
        'unauthorized_access',
        violation.severity === 'low' ? 'minor' : violation.severity === 'medium' ? 'major' : 'critical',
        violation.description,
        1, // Assume 1 record affected unless specified
        [PHIType.OTHER_UNIQUE_IDENTIFIER], // Default PHI type
      );
    }
  }

  private isHIPAABreach(violation: SecurityViolation): boolean {
    // Determine if violation constitutes a HIPAA breach
    const breachKeywords = ['phi', 'patient', 'medical', 'health', 'dicom'];
    return breachKeywords.some(keyword =>
      violation.description.toLowerCase().includes(keyword),
    );
  }

  private scheduleSecurityEvaluations(): void {
    // Schedule monthly security evaluations
    setInterval(() => {
      this.performSecurityEvaluation();
    }, 30 * 24 * 60 * 60 * 1000); // 30 days
  }

  private performSecurityEvaluation(): void {
    const report = this.generateComplianceReport();

    securityManager.auditLog(AuditEventType.CONFIG_CHANGE, 'security_evaluation_performed', {
      overallCompliance: report.overallCompliance,
      breachCount: report.breachSummary.total,
      recommendations: report.recommendations.length,
    });

    this.emit('securityEvaluationComplete', report);
  }

  private setupDICOMAuditLogging(): void {
    // Ensure all DICOM-related activities are audited
    // This would integrate with the DICOM viewer components
  }

  private setupDataIntegrityChecks(): void {
    // Implement data integrity verification
    // This would include checksums and digital signatures
  }

  private setupTransmissionSecurity(): void {
    // Ensure all data transmission is encrypted
    // This would enforce HTTPS and other secure protocols
  }

  private setupWorkstationMonitoring(): void {
    // Monitor workstation activities
    if (typeof navigator !== 'undefined') {
      // Monitor for screen sharing or recording
      this.detectScreenSharing();
    }
  }

  private detectScreenSharing(): void {
    // Simplified screen sharing detection
    // In production, this would be more sophisticated
    if ('mediaDevices' in navigator) {
      // Monitor for screen capture attempts
      const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
      navigator.mediaDevices.getDisplayMedia = function(...args) {
        securityManager.auditLog(AuditEventType.SECURITY_VIOLATION, 'screen_sharing_attempt', {
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }, 'failure', 'high');

        return originalGetDisplayMedia.apply(this, args);
      };
    }
  }

  private setupDeviceControls(): void {
    // Monitor device access and media usage
    // This would include USB device monitoring, print monitoring, etc.
  }

  private evaluateBreachRisk(violation: SecurityViolation): void {
    if (violation.severity === 'critical' || violation.severity === 'high') {
      // Potential breach - investigate further
      setTimeout(() => {
        if (!this.complianceViolations.has(violation.id)) {
          // If violation hasn't been resolved, escalate
          this.recordBreachIncident(
            'unauthorized_access',
            violation.severity === 'low' ? 'minor' : violation.severity === 'medium' ? 'major' : 'critical',
            `Unresolved security violation escalated to breach: ${violation.description}`,
            1,
            [PHIType.OTHER_UNIQUE_IDENTIFIER],
          );
        }
      }, this.config.breachNotification.notificationThresholdMinutes * 60 * 1000);
    }
  }

  private analyzeDataAccessPattern(event: any): void {
    // Analyze patterns that might indicate unauthorized access
    // This would implement machine learning or rule-based detection
    if (event.riskLevel === 'high' || event.riskLevel === 'critical') {
      this.recordBreachIncident(
        'unauthorized_access',
        event.riskLevel === 'critical' ? 'critical' : 'major',
        `Suspicious data access pattern detected: ${event.action}`,
        1,
        [PHIType.OTHER_UNIQUE_IDENTIFIER],
      );
    }
  }

  private determineNotificationRequirement(severity: string, affectedRecords: number): boolean {
    // HIPAA requires notification for breaches affecting 500+ individuals
    // or any breach deemed significant
    return severity === 'critical' || affectedRecords >= 500;
  }

  private initiateEmergencyContainment(breachId: string): void {
    const incident = this.breachIncidents.get(breachId);
    if (!incident) return;

    // Implement emergency containment procedures
    incident.containmentActions.push('Emergency containment initiated');
    incident.status = 'contained';

    securityManager.auditLog(AuditEventType.SECURITY_VIOLATION, 'emergency_containment_initiated', {
      breachId,
      timestamp: new Date().toISOString(),
    });

    this.emit('emergencyContainment', incident);
  }

  private evaluateAdministrativeCompliance(): boolean {
    const controls = this.config.administrativeControls;
    return Object.values(controls).every(enabled => enabled);
  }

  private evaluatePhysicalCompliance(): boolean {
    const controls = this.config.physicalControls;
    return Object.values(controls).every(enabled => enabled);
  }

  private evaluateTechnicalCompliance(): boolean {
    const controls = this.config.technicalControls;
    return Object.values(controls).every(enabled => enabled);
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, number> {
    return array.reduce((groups, item) => {
      // eslint-disable-next-line security/detect-object-injection -- Safe property access with typed key
      const value = String(item[key]);
      // eslint-disable-next-line security/detect-object-injection -- Safe property access with string key
      groups[value] = (groups[value] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);
  }

  private generateComplianceRecommendations(
    safeguardCompliance: Record<string, boolean>,
    breachSummary: { total: number; unresolved: number },
    auditSummary: { violations: number },
  ): string[] {
    const recommendations: string[] = [];

    if (!safeguardCompliance.administrative) {
      recommendations.push('Enable all administrative safeguards for full HIPAA compliance');
    }

    if (!safeguardCompliance.technical) {
      recommendations.push('Implement all technical safeguards including audit controls and data integrity');
    }

    if (!safeguardCompliance.physical) {
      recommendations.push('Establish physical safeguards for workstation and device security');
    }

    if (breachSummary.unresolved > 0) {
      recommendations.push(`Resolve ${breachSummary.unresolved} outstanding breach incidents`);
    }

    if (auditSummary.violations > 10) {
      recommendations.push('Review and address recurring security violations');
    }

    if (breachSummary.total > 0) {
      recommendations.push('Conduct breach risk assessment and update incident response procedures');
    }

    return recommendations;
  }

  private generateId(): string {
    return `hipaa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get HIPAA compliance status
   */
  public getComplianceStatus(): {
    isCompliant: boolean;
    safeguards: Record<string, boolean>;
    breachCount: number;
    lastEvaluation: Date | null;
    } {
    const safeguards = {
      administrative: this.evaluateAdministrativeCompliance(),
      physical: this.evaluatePhysicalCompliance(),
      technical: this.evaluateTechnicalCompliance(),
    };

    return {
      isCompliant: Object.values(safeguards).every(compliant => compliant),
      safeguards,
      breachCount: this.breachIncidents.size,
      lastEvaluation: null, // Would track last evaluation date
    };
  }

  /**
   * Get breach incidents
   */
  public getBreachIncidents(status?: HIPAABreachIncident['status']): HIPAABreachIncident[] {
    const incidents = Array.from(this.breachIncidents.values());
    return status ? incidents.filter(incident => incident.status === status) : incidents;
  }

  /**
   * Update HIPAA configuration
   */
  public updateConfig(updates: Partial<HIPAAConfig>): void {
    this.config = { ...this.config, ...updates };

    securityManager.auditLog(AuditEventType.CONFIG_CHANGE, 'hipaa_config_updated', {
      changes: Object.keys(updates),
    });

    this.emit('configUpdated', this.config);
  }

  /**
   * Dispose HIPAA compliance manager
   */
  public dispose(): void {
    // Clear sensitive data
    this.breachIncidents.clear();
    this.complianceViolations.clear();

    // Remove all listeners
    this.removeAllListeners();

    log.info('HIPAA Compliance Manager disposed', {
      component: 'HIPAAComplianceManager',
    });
  }
}

// Singleton instance
export const hipaaComplianceManager = new HIPAAComplianceManager();
