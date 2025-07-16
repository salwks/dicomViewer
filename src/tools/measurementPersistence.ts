import { AllMeasurementData } from "./measurementManager";
import { LengthMeasurementData } from "./lengthTool";
import { AngleMeasurementData } from "./angleTool";
import { AreaMeasurementData } from "./areaTool";

export interface MeasurementPersistenceConfig {
  storageType:
    | "localStorage"
    | "sessionStorage"
    | "indexedDB"
    | "server"
    | "file";
  autoSave?: boolean;
  autoSaveInterval?: number; // in milliseconds
  maxStorageSize?: number; // in bytes
  compression?: boolean;
  encryption?: boolean;
  serverConfig?: {
    baseUrl: string;
    apiKey?: string;
    endpoints: {
      save: string;
      load: string;
      delete: string;
      list: string;
    };
  };
  fileConfig?: {
    format: "json" | "csv" | "xml";
    includeMetadata?: boolean;
    includeImages?: boolean;
  };
}

export interface MeasurementSession {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  measurements: AllMeasurementData[];
  metadata: {
    version: string;
    totalMeasurements: number;
    measurementTypes: string[];
    patientId?: string;
    studyId?: string;
    seriesId?: string;
  };
}

export interface MeasurementBackup {
  id: string;
  sessionId: string;
  timestamp: string;
  measurements: AllMeasurementData[];
  reason: "auto" | "manual" | "beforeDelete" | "beforeClear";
}

export class MeasurementPersistence {
  private config: MeasurementPersistenceConfig;
  private autoSaveTimer: number | null = null;
  private isInitialized: boolean = false;
  private currentSessionId: string | null = null;
  private backupHistory: MeasurementBackup[] = [];
  private maxBackupHistory: number = 10;

  constructor(config: MeasurementPersistenceConfig) {
    this.config = {
      autoSave: true,
      autoSaveInterval: 30000, // 30 seconds
      maxStorageSize: 50 * 1024 * 1024, // 50MB
      compression: false,
      encryption: false,
      ...config,
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize storage based on type
      switch (this.config.storageType) {
        case "indexedDB":
          await this.initializeIndexedDB();
          break;
        case "server":
          await this.initializeServerStorage();
          break;
        case "localStorage":
        case "sessionStorage":
        case "file":
          // No special initialization needed
          break;
      }

      // Start auto-save if enabled
      if (this.config.autoSave) {
        this.startAutoSave();
      }

      this.isInitialized = true;
      console.log("✓ Measurement Persistence initialized");
    } catch (error) {
      console.error("❌ Error initializing Measurement Persistence:", error);
      throw error;
    }
  }

  private async initializeIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("MeasurementDB", 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create sessions store
        if (!db.objectStoreNames.contains("sessions")) {
          const sessionStore = db.createObjectStore("sessions", {
            keyPath: "id",
          });
          sessionStore.createIndex("name", "name", { unique: false });
          sessionStore.createIndex("createdAt", "createdAt", { unique: false });
        }

        // Create backups store
        if (!db.objectStoreNames.contains("backups")) {
          const backupStore = db.createObjectStore("backups", {
            keyPath: "id",
          });
          backupStore.createIndex("sessionId", "sessionId", { unique: false });
          backupStore.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });
  }

  private async initializeServerStorage(): Promise<void> {
    if (!this.config.serverConfig) {
      throw new Error("Server configuration required for server storage");
    }

    // Test server connectivity
    try {
      const response = await fetch(
        `${this.config.serverConfig.baseUrl}/health`
      );
      if (!response.ok) {
        throw new Error(`Server health check failed: ${response.status}`);
      }
    } catch (error) {
      console.warn(
        "⚠️ Server storage initialization failed, falling back to localStorage"
      );
      this.config.storageType = "localStorage";
    }
  }

  private startAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = window.setInterval(() => {
      this.autoSaveCurrentSession();
    }, this.config.autoSaveInterval);
  }

  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  private async autoSaveCurrentSession(): Promise<void> {
    if (!this.currentSessionId) return;

    try {
      const session = await this.loadSession(this.currentSessionId);
      if (session) {
        await this.saveSession(session);
        console.log("✓ Auto-saved measurement session");
      }
    } catch (error) {
      console.error("❌ Auto-save failed:", error);
    }
  }

  public async createSession(
    name: string,
    description?: string
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    const session: MeasurementSession = {
      id: sessionId,
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      measurements: [],
      metadata: {
        version: "0.1.0",
        totalMeasurements: 0,
        measurementTypes: [],
      },
    };

    await this.saveSession(session);
    this.currentSessionId = sessionId;

    console.log(`✓ Created measurement session: ${name} (${sessionId})`);
    return sessionId;
  }

  public async saveSession(session: MeasurementSession): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Measurement Persistence not initialized");
    }

    try {
      // Update session metadata
      session.updatedAt = new Date().toISOString();
      session.metadata.totalMeasurements = session.measurements.length;
      session.metadata.measurementTypes = this.extractMeasurementTypes(
        session.measurements
      );

      // Create backup before saving
      if (session.measurements.length > 0) {
        await this.createBackup(session.id, session.measurements, "manual");
      }

      const data = this.config.compression
        ? this.compressData(session)
        : session;
      const encryptedData = this.config.encryption
        ? this.encryptData(data)
        : data;

      switch (this.config.storageType) {
        case "localStorage":
          await this.saveToLocalStorage(session.id, encryptedData);
          break;
        case "sessionStorage":
          await this.saveToSessionStorage(session.id, encryptedData);
          break;
        case "indexedDB":
          await this.saveToIndexedDB(session.id, encryptedData);
          break;
        case "server":
          await this.saveToServer(session.id, encryptedData);
          break;
        case "file":
          await this.saveToFile(session.id, encryptedData);
          break;
      }

      console.log(`✓ Saved measurement session: ${session.name}`);
    } catch (error) {
      console.error("❌ Error saving measurement session:", error);
      throw error;
    }
  }

  public async loadSession(
    sessionId: string
  ): Promise<MeasurementSession | null> {
    if (!this.isInitialized) {
      throw new Error("Measurement Persistence not initialized");
    }

    try {
      let data: any;

      switch (this.config.storageType) {
        case "localStorage":
          data = await this.loadFromLocalStorage(sessionId);
          break;
        case "sessionStorage":
          data = await this.loadFromSessionStorage(sessionId);
          break;
        case "indexedDB":
          data = await this.loadFromIndexedDB(sessionId);
          break;
        case "server":
          data = await this.loadFromServer(sessionId);
          break;
        case "file":
          data = await this.loadFromFile(sessionId);
          break;
      }

      if (!data) return null;

      const decryptedData = this.config.encryption
        ? this.decryptData(data)
        : data;
      const session = this.config.compression
        ? this.decompressData(decryptedData)
        : decryptedData;

      this.currentSessionId = sessionId;
      console.log(`✓ Loaded measurement session: ${session.name}`);

      return session;
    } catch (error) {
      console.error("❌ Error loading measurement session:", error);
      return null;
    }
  }

  public async deleteSession(sessionId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Measurement Persistence not initialized");
    }

    try {
      // Create backup before deletion
      const session = await this.loadSession(sessionId);
      if (session) {
        await this.createBackup(
          sessionId,
          session.measurements,
          "beforeDelete"
        );
      }

      switch (this.config.storageType) {
        case "localStorage":
          await this.deleteFromLocalStorage(sessionId);
          break;
        case "sessionStorage":
          await this.deleteFromSessionStorage(sessionId);
          break;
        case "indexedDB":
          await this.deleteFromIndexedDB(sessionId);
          break;
        case "server":
          await this.deleteFromServer(sessionId);
          break;
        case "file":
          await this.deleteFromFile(sessionId);
          break;
      }

      if (this.currentSessionId === sessionId) {
        this.currentSessionId = null;
      }

      console.log(`✓ Deleted measurement session: ${sessionId}`);
    } catch (error) {
      console.error("❌ Error deleting measurement session:", error);
      throw error;
    }
  }

  public async listSessions(): Promise<MeasurementSession[]> {
    if (!this.isInitialized) {
      throw new Error("Measurement Persistence not initialized");
    }

    try {
      let sessions: MeasurementSession[] = [];

      switch (this.config.storageType) {
        case "localStorage":
          sessions = await this.listFromLocalStorage();
          break;
        case "sessionStorage":
          sessions = await this.listFromSessionStorage();
          break;
        case "indexedDB":
          sessions = await this.listFromIndexedDB();
          break;
        case "server":
          sessions = await this.listFromServer();
          break;
        case "file":
          sessions = await this.listFromFile();
          break;
      }

      return sessions.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } catch (error) {
      console.error("❌ Error listing measurement sessions:", error);
      return [];
    }
  }

  public async saveMeasurements(
    measurements: AllMeasurementData[],
    sessionId?: string
  ): Promise<void> {
    const targetSessionId = sessionId || this.currentSessionId;

    if (!targetSessionId) {
      throw new Error("No active session. Create a session first.");
    }

    const session = await this.loadSession(targetSessionId);
    if (!session) {
      throw new Error(`Session ${targetSessionId} not found`);
    }

    session.measurements = measurements;
    await this.saveSession(session);
  }

  public async loadMeasurements(
    sessionId?: string
  ): Promise<AllMeasurementData[]> {
    const targetSessionId = sessionId || this.currentSessionId;

    if (!targetSessionId) {
      throw new Error("No active session. Create a session first.");
    }

    const session = await this.loadSession(targetSessionId);
    return session?.measurements || [];
  }

  public async exportMeasurements(
    sessionId: string,
    format: "json" | "csv" | "xml" = "json"
  ): Promise<string> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    switch (format) {
      case "json":
        return JSON.stringify(session, null, 2);
      case "csv":
        return this.convertToCSV(session.measurements);
      case "xml":
        return this.convertToXML(session);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  public async importMeasurements(
    data: string,
    format: "json" | "csv" | "xml" = "json"
  ): Promise<string> {
    let measurements: AllMeasurementData[] = [];

    try {
      switch (format) {
        case "json":
          const parsed = JSON.parse(data);
          measurements = parsed.measurements || parsed;
          break;
        case "csv":
          measurements = this.parseCSV(data);
          break;
        case "xml":
          measurements = this.parseXML(data);
          break;
        default:
          throw new Error(`Unsupported import format: ${format}`);
      }

      // Validate measurements
      measurements = measurements.filter((m) => this.validateMeasurement(m));

      // Create new session for imported measurements
      const sessionId = await this.createSession(
        `Imported ${format.toUpperCase()}`,
        `Imported ${measurements.length} measurements`
      );
      await this.saveMeasurements(measurements, sessionId);

      return sessionId;
    } catch (error) {
      console.error("❌ Error importing measurements:", error);
      throw error;
    }
  }

  public async createBackup(
    sessionId: string,
    measurements: AllMeasurementData[],
    reason: MeasurementBackup["reason"]
  ): Promise<string> {
    const backupId = this.generateBackupId();
    const backup: MeasurementBackup = {
      id: backupId,
      sessionId,
      timestamp: new Date().toISOString(),
      measurements: JSON.parse(JSON.stringify(measurements)), // Deep copy
      reason,
    };

    this.backupHistory.push(backup);

    // Limit backup history
    if (this.backupHistory.length > this.maxBackupHistory) {
      this.backupHistory.shift();
    }

    // Save backup to storage
    await this.saveBackup(backup);

    console.log(`✓ Created measurement backup: ${backupId} (${reason})`);
    return backupId;
  }

  public async restoreBackup(backupId: string): Promise<void> {
    const backup = await this.loadBackup(backupId);
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }

    await this.saveMeasurements(backup.measurements, backup.sessionId);
    console.log(`✓ Restored measurement backup: ${backupId}`);
  }

  public getBackupHistory(): MeasurementBackup[] {
    return [...this.backupHistory];
  }

  public async clearAllData(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Measurement Persistence not initialized");
    }

    try {
      // Create backup before clearing
      if (this.currentSessionId) {
        const measurements = await this.loadMeasurements();
        if (measurements.length > 0) {
          await this.createBackup(
            this.currentSessionId,
            measurements,
            "beforeClear"
          );
        }
      }

      switch (this.config.storageType) {
        case "localStorage":
          await this.clearLocalStorage();
          break;
        case "sessionStorage":
          await this.clearSessionStorage();
          break;
        case "indexedDB":
          await this.clearIndexedDB();
          break;
        case "server":
          await this.clearServer();
          break;
        case "file":
          await this.clearFiles();
          break;
      }

      this.currentSessionId = null;
      console.log("✓ Cleared all measurement data");
    } catch (error) {
      console.error("❌ Error clearing measurement data:", error);
      throw error;
    }
  }

  // Storage-specific implementations
  private async saveToLocalStorage(
    sessionId: string,
    data: any
  ): Promise<void> {
    const key = `measurement_session_${sessionId}`;
    try {
      const { secureStore } = require('../utils/secure-storage');
      secureStore(data, key);
    } catch (error) {
      console.warn('Failed to use secure storage, falling back to regular localStorage:', error);
      localStorage.setItem(key, JSON.stringify(data));
    }
  }

  private async loadFromLocalStorage(sessionId: string): Promise<any> {
    const key = `measurement_session_${sessionId}`;
    try {
      const { secureRetrieve } = require('../utils/secure-storage');
      const data = secureRetrieve(key);
      if (data) return data;
      
      // Fallback to regular localStorage
      const legacyData = localStorage.getItem(key);
      if (legacyData) {
        const parsed = JSON.parse(legacyData);
        // Migrate to secure storage
        try {
          const { secureStore } = require('../utils/secure-storage');
          secureStore(parsed, key);
          localStorage.removeItem(key);
        } catch (migrationError) {
          console.warn('Failed to migrate measurement data to secure storage:', migrationError);
        }
        return parsed;
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to load from secure storage, trying regular localStorage:', error);
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    }
  }

  private async deleteFromLocalStorage(sessionId: string): Promise<void> {
    const key = `measurement_session_${sessionId}`;
    try {
      const { secureRemove } = require('../utils/secure-storage');
      secureRemove(key);
    } catch (error) {
      console.warn('Failed to use secure storage removal, falling back to regular localStorage:', error);
    }
    // Always try regular localStorage removal as fallback
    localStorage.removeItem(key);
  }

  private async listFromLocalStorage(): Promise<MeasurementSession[]> {
    const sessions: MeasurementSession[] = [];
    const prefix = "measurement_session_";

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const session = JSON.parse(data);
            sessions.push(session);
          } catch (error) {
            console.warn(`Invalid session data for key ${key}:`, error);
          }
        }
      }
    }

    return sessions;
  }

  private async clearLocalStorage(): Promise<void> {
    const keysToRemove: string[] = [];
    const prefix = "measurement_session_";

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }

  private async saveToSessionStorage(
    sessionId: string,
    data: any
  ): Promise<void> {
    const key = `measurement_session_${sessionId}`;
    sessionStorage.setItem(key, JSON.stringify(data));
  }

  private async loadFromSessionStorage(sessionId: string): Promise<any> {
    const key = `measurement_session_${sessionId}`;
    const data = sessionStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }

  private async deleteFromSessionStorage(sessionId: string): Promise<void> {
    const key = `measurement_session_${sessionId}`;
    sessionStorage.removeItem(key);
  }

  private async listFromSessionStorage(): Promise<MeasurementSession[]> {
    const sessions: MeasurementSession[] = [];
    const prefix = "measurement_session_";

    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(prefix)) {
        const data = sessionStorage.getItem(key);
        if (data) {
          try {
            const session = JSON.parse(data);
            sessions.push(session);
          } catch (error) {
            console.warn(`Invalid session data for key ${key}:`, error);
          }
        }
      }
    }

    return sessions;
  }

  private async clearSessionStorage(): Promise<void> {
    const keysToRemove: string[] = [];
    const prefix = "measurement_session_";

    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
  }

  private async saveToIndexedDB(sessionId: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("MeasurementDB", 1);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(["sessions"], "readwrite");
        const store = transaction.objectStore("sessions");

        const putRequest = store.put(data);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async loadFromIndexedDB(sessionId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("MeasurementDB", 1);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(["sessions"], "readonly");
        const store = transaction.objectStore("sessions");

        const getRequest = store.get(sessionId);
        getRequest.onsuccess = () => resolve(getRequest.result);
        getRequest.onerror = () => reject(getRequest.error);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async deleteFromIndexedDB(sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("MeasurementDB", 1);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(["sessions"], "readwrite");
        const store = transaction.objectStore("sessions");

        const deleteRequest = store.delete(sessionId);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async listFromIndexedDB(): Promise<MeasurementSession[]> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("MeasurementDB", 1);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(["sessions"], "readonly");
        const store = transaction.objectStore("sessions");

        const getAllRequest = store.getAll();
        getAllRequest.onsuccess = () => resolve(getAllRequest.result);
        getAllRequest.onerror = () => reject(getAllRequest.error);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async clearIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("MeasurementDB", 1);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(
          ["sessions", "backups"],
          "readwrite"
        );

        const sessionStore = transaction.objectStore("sessions");
        const backupStore = transaction.objectStore("backups");

        const clearSessions = sessionStore.clear();
        const clearBackups = backupStore.clear();

        let completed = 0;
        const checkCompletion = () => {
          completed++;
          if (completed === 2) resolve();
        };

        clearSessions.onsuccess = checkCompletion;
        clearBackups.onsuccess = checkCompletion;

        clearSessions.onerror = () => reject(clearSessions.error);
        clearBackups.onerror = () => reject(clearBackups.error);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async saveToServer(sessionId: string, data: any): Promise<void> {
    if (!this.config.serverConfig) {
      throw new Error("Server configuration not provided");
    }

    const response = await fetch(
      `${this.config.serverConfig.baseUrl}${this.config.serverConfig.endpoints.save}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.serverConfig.apiKey && {
            Authorization: `Bearer ${this.config.serverConfig.apiKey}`,
          }),
        },
        body: JSON.stringify({ sessionId, data }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Server save failed: ${response.status} ${response.statusText}`
      );
    }
  }

  private async loadFromServer(sessionId: string): Promise<any> {
    if (!this.config.serverConfig) {
      throw new Error("Server configuration not provided");
    }

    const response = await fetch(
      `${this.config.serverConfig.baseUrl}${this.config.serverConfig.endpoints.load}/${sessionId}`,
      {
        headers: {
          ...(this.config.serverConfig.apiKey && {
            Authorization: `Bearer ${this.config.serverConfig.apiKey}`,
          }),
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(
        `Server load failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  private async deleteFromServer(sessionId: string): Promise<void> {
    if (!this.config.serverConfig) {
      throw new Error("Server configuration not provided");
    }

    const response = await fetch(
      `${this.config.serverConfig.baseUrl}${this.config.serverConfig.endpoints.delete}/${sessionId}`,
      {
        method: "DELETE",
        headers: {
          ...(this.config.serverConfig.apiKey && {
            Authorization: `Bearer ${this.config.serverConfig.apiKey}`,
          }),
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Server delete failed: ${response.status} ${response.statusText}`
      );
    }
  }

  private async listFromServer(): Promise<MeasurementSession[]> {
    if (!this.config.serverConfig) {
      throw new Error("Server configuration not provided");
    }

    const response = await fetch(
      `${this.config.serverConfig.baseUrl}${this.config.serverConfig.endpoints.list}`,
      {
        headers: {
          ...(this.config.serverConfig.apiKey && {
            Authorization: `Bearer ${this.config.serverConfig.apiKey}`,
          }),
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Server list failed: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  private async clearServer(): Promise<void> {
    // This would typically call a server endpoint to clear all data
    // Implementation depends on server API
    console.warn("Server clear not implemented");
  }

  private async saveToFile(sessionId: string, data: any): Promise<void> {
    const fileName = `measurement_session_${sessionId}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();

    URL.revokeObjectURL(url);
  }

  private async loadFromFile(sessionId: string): Promise<any> {
    // File loading would typically be handled by a file input
    // This is a placeholder implementation
    throw new Error("File loading not implemented in this context");
  }

  private async deleteFromFile(sessionId: string): Promise<void> {
    // File deletion would be handled by the file system
    // This is a placeholder implementation
    console.warn("File deletion not implemented");
  }

  private async listFromFile(): Promise<MeasurementSession[]> {
    // File listing would be handled by the file system
    // This is a placeholder implementation
    return [];
  }

  private async clearFiles(): Promise<void> {
    // File clearing would be handled by the file system
    // This is a placeholder implementation
    console.warn("File clearing not implemented");
  }

  private async saveBackup(backup: MeasurementBackup): Promise<void> {
    // Save backup based on storage type
    // For simplicity, we'll use localStorage for backups
    const key = `measurement_backup_${backup.id}`;
    try {
      const { secureStore } = require('../utils/secure-storage');
      secureStore(backup, key);
    } catch (error) {
      console.warn('Failed to use secure storage for backup, falling back to regular localStorage:', error);
      localStorage.setItem(key, JSON.stringify(backup));
    }
  }

  private async loadBackup(
    backupId: string
  ): Promise<MeasurementBackup | null> {
    const key = `measurement_backup_${backupId}`;
    try {
      const { secureRetrieve } = require('../utils/secure-storage');
      const data = secureRetrieve(key);
      if (data) return data;
      
      // Fallback to regular localStorage
      const legacyData = localStorage.getItem(key);
      return legacyData ? JSON.parse(legacyData) : null;
    } catch (error) {
      console.warn('Failed to load backup from secure storage, trying regular localStorage:', error);
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    }
  }

  // Utility methods
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractMeasurementTypes(
    measurements: AllMeasurementData[]
  ): string[] {
    const types = new Set<string>();
    measurements.forEach((measurement) => {
      if ("length" in measurement) types.add("length");
      if ("angle" in measurement) types.add("angle");
      if ("area" in measurement) types.add("area");
    });
    return Array.from(types);
  }

  private validateMeasurement(measurement: any): boolean {
    return (
      measurement &&
      typeof measurement.id === "string" &&
      typeof measurement.toolName === "string" &&
      typeof measurement.timestamp === "string" &&
      (("length" in measurement && typeof measurement.length === "number") ||
        ("angle" in measurement && typeof measurement.angle === "number") ||
        ("area" in measurement && typeof measurement.area === "number"))
    );
  }

  private convertToCSV(measurements: AllMeasurementData[]): string {
    if (measurements.length === 0) return "";

    const headers = [
      "ID",
      "Tool Name",
      "Value",
      "Unit",
      "Timestamp",
      "Viewport ID",
      "Image ID",
    ];
    const rows = measurements.map((measurement) => {
      let value = "";
      if ("length" in measurement) value = measurement.length.toString();
      if ("angle" in measurement) value = measurement.angle.toString();
      if ("area" in measurement) value = measurement.area.toString();

      return [
        measurement.id,
        measurement.toolName,
        value,
        measurement.unit,
        measurement.timestamp,
        measurement.viewportId,
        measurement.imageId,
      ];
    });

    return [headers, ...rows].map((row) => row.join(",")).join("\n");
  }

  private parseCSV(csvData: string): AllMeasurementData[] {
    // Simple CSV parsing - in production, use a proper CSV parser
    const lines = csvData.trim().split("\n");
    const headers = lines[0].split(",");
    const measurements: AllMeasurementData[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",");
      // This is a simplified parsing - implement proper CSV parsing
      // based on your data structure
    }

    return measurements;
  }

  private convertToXML(session: MeasurementSession): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += "<measurementSession>\n";
    xml += `  <id>${session.id}</id>\n`;
    xml += `  <name><![CDATA[${session.name}]]></name>\n`;
    xml += `  <description><![CDATA[${
      session.description || ""
    }]]></description>\n`;
    xml += `  <createdAt>${session.createdAt}</createdAt>\n`;
    xml += `  <updatedAt>${session.updatedAt}</updatedAt>\n`;
    xml += "  <measurements>\n";

    session.measurements.forEach((measurement) => {
      xml += "    <measurement>\n";
      xml += `      <id>${measurement.id}</id>\n`;
      xml += `      <toolName>${measurement.toolName}</toolName>\n`;
      xml += `      <timestamp>${measurement.timestamp}</timestamp>\n`;
      xml += `      <viewportId>${measurement.viewportId}</viewportId>\n`;
      xml += `      <imageId>${measurement.imageId}</imageId>\n`;
      xml += `      <unit>${measurement.unit}</unit>\n`;

      if ("length" in measurement) {
        xml += `      <length>${measurement.length}</length>\n`;
      }
      if ("angle" in measurement) {
        xml += `      <angle>${measurement.angle}</angle>\n`;
      }
      if ("area" in measurement) {
        xml += `      <area>${measurement.area}</area>\n`;
      }

      xml += "    </measurement>\n";
    });

    xml += "  </measurements>\n";
    xml += "</measurementSession>\n";

    return xml;
  }

  private parseXML(xmlData: string): AllMeasurementData[] {
    // Simple XML parsing - in production, use a proper XML parser
    const measurements: AllMeasurementData[] = [];
    // Implementation would depend on XML structure
    return measurements;
  }

  private compressData(data: any): any {
    // Implement data compression if needed
    return data;
  }

  private decompressData(data: any): any {
    // Implement data decompression if needed
    return data;
  }

  private encryptData(data: any): any {
    // Implement data encryption if needed
    return data;
  }

  private decryptData(data: any): any {
    // Implement data decryption if needed
    return data;
  }

  public getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  public setCurrentSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  public getConfig(): MeasurementPersistenceConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<MeasurementPersistenceConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart auto-save if configuration changed
    if (this.config.autoSave) {
      this.startAutoSave();
    } else {
      this.stopAutoSave();
    }
  }

  public getInitializationStatus(): boolean {
    return this.isInitialized;
  }

  public dispose(): void {
    try {
      this.stopAutoSave();
      this.backupHistory = [];
      this.currentSessionId = null;
      this.isInitialized = false;

      console.log("✓ Measurement Persistence disposed");
    } catch (error) {
      console.error("❌ Error disposing Measurement Persistence:", error);
    }
  }
}

// Convenience functions
export function createMeasurementPersistence(
  config: MeasurementPersistenceConfig
): MeasurementPersistence {
  return new MeasurementPersistence(config);
}

export function getDefaultPersistenceConfig(): MeasurementPersistenceConfig {
  return {
    storageType: "localStorage",
    autoSave: true,
    autoSaveInterval: 30000,
    maxStorageSize: 50 * 1024 * 1024,
    compression: false,
    encryption: false,
  };
}
