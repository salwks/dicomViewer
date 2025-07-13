import { AnnotationData } from './annotationManager';
import { TextAnnotationData } from './textAnnotation';
import { ArrowAnnotationData } from './arrowAnnotation';

export interface PersistenceConfig {
    enableAutoSave?: boolean;
    autoSaveInterval?: number;
    storageBackend?: 'localStorage' | 'sessionStorage' | 'indexedDB' | 'server';
    serverEndpoint?: string;
    apiKey?: string;
    enableCompression?: boolean;
    maxStorageSize?: number;
    enableBackup?: boolean;
    backupInterval?: number;
    retentionPeriod?: number; // days
    enableVersioning?: boolean;
    maxVersions?: number;
}

export interface PersistenceSession {
    sessionId: string;
    userId?: string;
    timestamp: string;
    annotations: AnnotationData[];
    metadata: {
        viewportId?: string;
        imageId?: string;
        studyId?: string;
        seriesId?: string;
        patientId?: string;
    };
    version: number;
}

export interface PersistenceStats {
    totalAnnotations: number;
    totalSessions: number;
    storageUsed: number;
    storageLimit: number;
    lastSaved: string;
    lastLoaded: string;
    autoSaveEnabled: boolean;
    backupEnabled: boolean;
}

export interface StorageBackend {
    save(key: string, data: any): Promise<boolean>;
    load(key: string): Promise<any>;
    delete(key: string): Promise<boolean>;
    exists(key: string): Promise<boolean>;
    list(): Promise<string[]>;
    clear(): Promise<boolean>;
    getStats(): Promise<{ used: number; limit: number }>;
}

export class AnnotationPersistence {
    private config: PersistenceConfig;
    private sessions: Map<string, PersistenceSession> = new Map();
    private currentSession: PersistenceSession | null = null;
    private autoSaveTimer: number | null = null;
    private backupTimer: number | null = null;
    private storageBackend: StorageBackend;
    private isInitialized: boolean = false;
    private changeQueue: AnnotationData[] = [];
    private isProcessingQueue: boolean = false;
    private compressionEnabled: boolean = false;

    constructor(config: PersistenceConfig = {}) {
        this.config = {
            enableAutoSave: true,
            autoSaveInterval: 30000, // 30 seconds
            storageBackend: 'localStorage',
            enableCompression: false,
            maxStorageSize: 100 * 1024 * 1024, // 100MB
            enableBackup: false,
            backupInterval: 3600000, // 1 hour
            retentionPeriod: 30, // 30 days
            enableVersioning: false,
            maxVersions: 10,
            ...config
        };

        this.storageBackend = this.createStorageBackend(this.config.storageBackend!);
        this.compressionEnabled = this.config.enableCompression || false;
        
        this.initialize();
    }

    private initialize(): void {
        try {
            this.setupAutoSave();
            this.setupBackup();
            this.loadSessions();
            this.isInitialized = true;
            
            console.log('✓ Annotation Persistence initialized');
        } catch (error) {
            console.error('❌ Error initializing Annotation Persistence:', error);
            throw error;
        }
    }

    private createStorageBackend(type: string): StorageBackend {
        switch (type) {
            case 'localStorage':
                return new LocalStorageBackend();
            case 'sessionStorage':
                return new SessionStorageBackend();
            case 'indexedDB':
                return new IndexedDBBackend();
            case 'server':
                return new ServerStorageBackend(this.config.serverEndpoint, this.config.apiKey);
            default:
                return new LocalStorageBackend();
        }
    }

    private setupAutoSave(): void {
        if (this.config.enableAutoSave && this.config.autoSaveInterval) {
            this.autoSaveTimer = window.setInterval(() => {
                this.processChangeQueue();
            }, this.config.autoSaveInterval);
        }
    }

    private setupBackup(): void {
        if (this.config.enableBackup && this.config.backupInterval) {
            this.backupTimer = window.setInterval(() => {
                this.createBackup();
            }, this.config.backupInterval);
        }
    }

    private async loadSessions(): Promise<void> {
        try {
            const sessionKeys = await this.storageBackend.list();
            const sessionPromises = sessionKeys
                .filter(key => key.startsWith('session-'))
                .map(async (key) => {
                    const sessionData = await this.storageBackend.load(key);
                    if (sessionData) {
                        const session = this.deserializeSession(sessionData);
                        this.sessions.set(session.sessionId, session);
                    }
                });

            await Promise.all(sessionPromises);
            console.log(`✓ Loaded ${this.sessions.size} sessions`);

        } catch (error) {
            console.error('❌ Error loading sessions:', error);
        }
    }

    private serializeSession(session: PersistenceSession): string {
        const data = JSON.stringify(session);
        return this.compressionEnabled ? this.compress(data) : data;
    }

    private deserializeSession(data: string): PersistenceSession {
        const jsonData = this.compressionEnabled ? this.decompress(data) : data;
        return JSON.parse(jsonData);
    }

    private compress(data: string): string {
        // Simple compression using built-in compression
        // In production, use a proper compression library
        try {
            return btoa(data);
        } catch (error) {
            console.warn('Compression failed, using raw data');
            return data;
        }
    }

    private decompress(data: string): string {
        try {
            return atob(data);
        } catch (error) {
            console.warn('Decompression failed, using raw data');
            return data;
        }
    }

    private async processChangeQueue(): Promise<void> {
        if (this.isProcessingQueue || this.changeQueue.length === 0) return;

        this.isProcessingQueue = true;
        try {
            if (this.currentSession) {
                // Update current session with changes
                this.currentSession.annotations = [
                    ...this.currentSession.annotations,
                    ...this.changeQueue
                ];
                this.currentSession.timestamp = new Date().toISOString();
                
                if (this.config.enableVersioning) {
                    this.currentSession.version += 1;
                }

                await this.saveSession(this.currentSession);
                this.changeQueue = [];
            }

        } catch (error) {
            console.error('❌ Error processing change queue:', error);
        } finally {
            this.isProcessingQueue = false;
        }
    }

    public async createSession(metadata: PersistenceSession['metadata'], userId?: string): Promise<string> {
        try {
            const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            const session: PersistenceSession = {
                sessionId,
                userId,
                timestamp: new Date().toISOString(),
                annotations: [],
                metadata,
                version: 1
            };

            this.sessions.set(sessionId, session);
            this.currentSession = session;
            
            await this.saveSession(session);
            
            console.log('✓ Created new session:', sessionId);
            return sessionId;

        } catch (error) {
            console.error('❌ Error creating session:', error);
            throw error;
        }
    }

    public async loadSession(sessionId: string): Promise<PersistenceSession | null> {
        try {
            if (this.sessions.has(sessionId)) {
                const session = this.sessions.get(sessionId)!;
                this.currentSession = session;
                console.log('✓ Loaded session from memory:', sessionId);
                return session;
            }

            const sessionData = await this.storageBackend.load(`session-${sessionId}`);
            if (sessionData) {
                const session = this.deserializeSession(sessionData);
                this.sessions.set(sessionId, session);
                this.currentSession = session;
                console.log('✓ Loaded session from storage:', sessionId);
                return session;
            }

            return null;

        } catch (error) {
            console.error('❌ Error loading session:', error);
            return null;
        }
    }

    public async saveSession(session: PersistenceSession): Promise<boolean> {
        try {
            const key = `session-${session.sessionId}`;
            const data = this.serializeSession(session);
            
            const success = await this.storageBackend.save(key, data);
            if (success) {
                this.sessions.set(session.sessionId, session);
                console.log('✓ Session saved:', session.sessionId);
            }
            
            return success;

        } catch (error) {
            console.error('❌ Error saving session:', error);
            return false;
        }
    }

    public async deleteSession(sessionId: string): Promise<boolean> {
        try {
            const key = `session-${sessionId}`;
            const success = await this.storageBackend.delete(key);
            
            if (success) {
                this.sessions.delete(sessionId);
                if (this.currentSession?.sessionId === sessionId) {
                    this.currentSession = null;
                }
                console.log('✓ Session deleted:', sessionId);
            }
            
            return success;

        } catch (error) {
            console.error('❌ Error deleting session:', error);
            return false;
        }
    }

    public async saveAnnotation(annotation: AnnotationData): Promise<boolean> {
        try {
            if (!this.currentSession) {
                throw new Error('No active session');
            }

            // Add to change queue for batch processing
            this.changeQueue.push(annotation);
            
            // If auto-save is disabled, save immediately
            if (!this.config.enableAutoSave) {
                await this.processChangeQueue();
            }

            return true;

        } catch (error) {
            console.error('❌ Error saving annotation:', error);
            return false;
        }
    }

    public async saveAnnotations(annotations: AnnotationData[]): Promise<boolean> {
        try {
            if (!this.currentSession) {
                throw new Error('No active session');
            }

            // Add all annotations to change queue
            this.changeQueue.push(...annotations);
            
            // If auto-save is disabled, save immediately
            if (!this.config.enableAutoSave) {
                await this.processChangeQueue();
            }

            return true;

        } catch (error) {
            console.error('❌ Error saving annotations:', error);
            return false;
        }
    }

    public async loadAnnotations(sessionId?: string): Promise<AnnotationData[]> {
        try {
            const targetSession = sessionId ? 
                await this.loadSession(sessionId) : 
                this.currentSession;

            if (!targetSession) {
                console.warn('No session found for loading annotations');
                return [];
            }

            console.log(`✓ Loaded ${targetSession.annotations.length} annotations from session`);
            return targetSession.annotations;

        } catch (error) {
            console.error('❌ Error loading annotations:', error);
            return [];
        }
    }

    public async exportSession(sessionId: string, format: 'json' | 'csv' = 'json'): Promise<string> {
        try {
            const session = await this.loadSession(sessionId);
            if (!session) {
                throw new Error(`Session not found: ${sessionId}`);
            }

            if (format === 'json') {
                return JSON.stringify(session, null, 2);
            } else if (format === 'csv') {
                return this.convertSessionToCSV(session);
            }

            throw new Error(`Unsupported export format: ${format}`);

        } catch (error) {
            console.error('❌ Error exporting session:', error);
            throw error;
        }
    }

    public async importSession(data: string, format: 'json' | 'csv' = 'json'): Promise<string> {
        try {
            let session: PersistenceSession;

            if (format === 'json') {
                session = JSON.parse(data);
            } else if (format === 'csv') {
                session = this.parseSessionFromCSV(data);
            } else {
                throw new Error(`Unsupported import format: ${format}`);
            }

            // Generate new session ID to avoid conflicts
            const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            session.sessionId = newSessionId;
            session.timestamp = new Date().toISOString();

            await this.saveSession(session);
            
            console.log('✓ Session imported:', newSessionId);
            return newSessionId;

        } catch (error) {
            console.error('❌ Error importing session:', error);
            throw error;
        }
    }

    private convertSessionToCSV(session: PersistenceSession): string {
        const headers = ['AnnotationUID', 'ToolName', 'Text', 'X', 'Y', 'ImageID', 'ViewportID', 'Timestamp'];
        const rows = session.annotations.map(annotation => {
            const x = annotation.position?.[0] || annotation.handles?.start?.[0] || '';
            const y = annotation.position?.[1] || annotation.handles?.start?.[1] || '';
            
            return [
                annotation.annotationUID,
                annotation.toolName,
                annotation.text || '',
                x,
                y,
                annotation.imageId,
                annotation.viewportId,
                annotation.timestamp
            ];
        });

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    private parseSessionFromCSV(csvData: string): PersistenceSession {
        const lines = csvData.trim().split('\n');
        const annotations: AnnotationData[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length >= 8) {
                const annotation: AnnotationData = {
                    annotationUID: values[0],
                    toolName: values[1],
                    text: values[2],
                    position: values[3] && values[4] ? [parseFloat(values[3]), parseFloat(values[4])] : undefined,
                    imageId: values[5],
                    viewportId: values[6],
                    timestamp: values[7]
                };
                annotations.push(annotation);
            }
        }

        return {
            sessionId: `imported-${Date.now()}`,
            timestamp: new Date().toISOString(),
            annotations,
            metadata: {},
            version: 1
        };
    }

    public async createBackup(): Promise<string> {
        try {
            const backupId = `backup-${Date.now()}`;
            const backupData = {
                backupId,
                timestamp: new Date().toISOString(),
                sessions: Array.from(this.sessions.values()),
                config: this.config
            };

            const success = await this.storageBackend.save(backupId, JSON.stringify(backupData));
            if (success) {
                console.log('✓ Backup created:', backupId);
                
                // Clean up old backups
                await this.cleanupOldBackups();
                
                return backupId;
            }

            throw new Error('Failed to create backup');

        } catch (error) {
            console.error('❌ Error creating backup:', error);
            throw error;
        }
    }

    public async restoreBackup(backupId: string): Promise<boolean> {
        try {
            const backupData = await this.storageBackend.load(backupId);
            if (!backupData) {
                throw new Error(`Backup not found: ${backupId}`);
            }

            const backup = JSON.parse(backupData);
            
            // Clear current sessions
            this.sessions.clear();
            this.currentSession = null;

            // Restore sessions
            backup.sessions.forEach((session: PersistenceSession) => {
                this.sessions.set(session.sessionId, session);
            });

            // Save all restored sessions
            const savePromises = backup.sessions.map((session: PersistenceSession) => 
                this.saveSession(session)
            );
            await Promise.all(savePromises);

            console.log(`✓ Restored ${backup.sessions.length} sessions from backup:`, backupId);
            return true;

        } catch (error) {
            console.error('❌ Error restoring backup:', error);
            return false;
        }
    }

    private async cleanupOldBackups(): Promise<void> {
        try {
            const allKeys = await this.storageBackend.list();
            const backupKeys = allKeys.filter(key => key.startsWith('backup-'));
            
            // Sort by timestamp (newest first)
            backupKeys.sort((a, b) => {
                const timestampA = parseInt(a.split('-')[1]);
                const timestampB = parseInt(b.split('-')[1]);
                return timestampB - timestampA;
            });

            // Keep only the most recent backups
            const maxBackups = 5;
            const oldBackups = backupKeys.slice(maxBackups);
            
            const deletePromises = oldBackups.map(key => this.storageBackend.delete(key));
            await Promise.all(deletePromises);

            if (oldBackups.length > 0) {
                console.log(`✓ Cleaned up ${oldBackups.length} old backups`);
            }

        } catch (error) {
            console.error('❌ Error cleaning up old backups:', error);
        }
    }

    public async cleanupOldSessions(): Promise<void> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - (this.config.retentionPeriod || 30));

            const sessionsToDelete: string[] = [];
            
            for (const [sessionId, session] of this.sessions) {
                const sessionDate = new Date(session.timestamp);
                if (sessionDate < cutoffDate) {
                    sessionsToDelete.push(sessionId);
                }
            }

            const deletePromises = sessionsToDelete.map(sessionId => this.deleteSession(sessionId));
            await Promise.all(deletePromises);

            if (sessionsToDelete.length > 0) {
                console.log(`✓ Cleaned up ${sessionsToDelete.length} old sessions`);
            }

        } catch (error) {
            console.error('❌ Error cleaning up old sessions:', error);
        }
    }

    public async getStats(): Promise<PersistenceStats> {
        try {
            const storageStats = await this.storageBackend.getStats();
            const totalAnnotations = Array.from(this.sessions.values())
                .reduce((sum, session) => sum + session.annotations.length, 0);

            return {
                totalAnnotations,
                totalSessions: this.sessions.size,
                storageUsed: storageStats.used,
                storageLimit: storageStats.limit,
                lastSaved: this.currentSession?.timestamp || '',
                lastLoaded: new Date().toISOString(),
                autoSaveEnabled: this.config.enableAutoSave || false,
                backupEnabled: this.config.enableBackup || false
            };

        } catch (error) {
            console.error('❌ Error getting stats:', error);
            return {
                totalAnnotations: 0,
                totalSessions: 0,
                storageUsed: 0,
                storageLimit: 0,
                lastSaved: '',
                lastLoaded: '',
                autoSaveEnabled: false,
                backupEnabled: false
            };
        }
    }

    public getSessions(): PersistenceSession[] {
        return Array.from(this.sessions.values());
    }

    public getCurrentSession(): PersistenceSession | null {
        return this.currentSession;
    }

    public async forceSave(): Promise<boolean> {
        try {
            await this.processChangeQueue();
            return true;
        } catch (error) {
            console.error('❌ Error forcing save:', error);
            return false;
        }
    }

    public updateConfig(newConfig: Partial<PersistenceConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        // Restart timers if configuration changed
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
        
        if (this.backupTimer) {
            clearInterval(this.backupTimer);
            this.backupTimer = null;
        }
        
        this.setupAutoSave();
        this.setupBackup();
        
        console.log('✓ Annotation Persistence configuration updated');
    }

    public getConfig(): PersistenceConfig {
        return { ...this.config };
    }

    public getInitializationStatus(): boolean {
        return this.isInitialized;
    }

    public dispose(): void {
        try {
            // Force save any pending changes
            if (this.changeQueue.length > 0) {
                this.processChangeQueue();
            }

            // Clear timers
            if (this.autoSaveTimer) {
                clearInterval(this.autoSaveTimer);
                this.autoSaveTimer = null;
            }
            
            if (this.backupTimer) {
                clearInterval(this.backupTimer);
                this.backupTimer = null;
            }

            // Clear data
            this.sessions.clear();
            this.currentSession = null;
            this.changeQueue = [];
            this.isInitialized = false;

            console.log('✓ Annotation Persistence disposed');

        } catch (error) {
            console.error('❌ Error disposing Annotation Persistence:', error);
        }
    }
}

// Storage Backend Implementations
class LocalStorageBackend implements StorageBackend {
    async save(key: string, data: any): Promise<boolean> {
        try {
            localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('LocalStorage save error:', error);
            return false;
        }
    }

    async load(key: string): Promise<any> {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            console.error('LocalStorage load error:', error);
            return null;
        }
    }

    async delete(key: string): Promise<boolean> {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('LocalStorage delete error:', error);
            return false;
        }
    }

    async exists(key: string): Promise<boolean> {
        return localStorage.getItem(key) !== null;
    }

    async list(): Promise<string[]> {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) keys.push(key);
        }
        return keys;
    }

    async clear(): Promise<boolean> {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('LocalStorage clear error:', error);
            return false;
        }
    }

    async getStats(): Promise<{ used: number; limit: number }> {
        let used = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                const value = localStorage.getItem(key);
                if (value) {
                    used += key.length + value.length;
                }
            }
        }
        return { used, limit: 5 * 1024 * 1024 }; // 5MB typical limit
    }
}

class SessionStorageBackend implements StorageBackend {
    async save(key: string, data: any): Promise<boolean> {
        try {
            sessionStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('SessionStorage save error:', error);
            return false;
        }
    }

    async load(key: string): Promise<any> {
        try {
            return sessionStorage.getItem(key);
        } catch (error) {
            console.error('SessionStorage load error:', error);
            return null;
        }
    }

    async delete(key: string): Promise<boolean> {
        try {
            sessionStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('SessionStorage delete error:', error);
            return false;
        }
    }

    async exists(key: string): Promise<boolean> {
        return sessionStorage.getItem(key) !== null;
    }

    async list(): Promise<string[]> {
        const keys: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key) keys.push(key);
        }
        return keys;
    }

    async clear(): Promise<boolean> {
        try {
            sessionStorage.clear();
            return true;
        } catch (error) {
            console.error('SessionStorage clear error:', error);
            return false;
        }
    }

    async getStats(): Promise<{ used: number; limit: number }> {
        let used = 0;
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key) {
                const value = sessionStorage.getItem(key);
                if (value) {
                    used += key.length + value.length;
                }
            }
        }
        return { used, limit: 5 * 1024 * 1024 }; // 5MB typical limit
    }
}

class IndexedDBBackend implements StorageBackend {
    private dbName = 'AnnotationPersistence';
    private storeName = 'annotations';
    private db: IDBDatabase | null = null;

    private async openDB(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
        });
    }

    async save(key: string, data: any): Promise<boolean> {
        try {
            const db = await this.openDB();
            const transaction = db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            return new Promise((resolve, reject) => {
                const request = store.put(data, key);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(true);
            });
        } catch (error) {
            console.error('IndexedDB save error:', error);
            return false;
        }
    }

    async load(key: string): Promise<any> {
        try {
            const db = await this.openDB();
            const transaction = db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            
            return new Promise((resolve, reject) => {
                const request = store.get(key);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
            });
        } catch (error) {
            console.error('IndexedDB load error:', error);
            return null;
        }
    }

    async delete(key: string): Promise<boolean> {
        try {
            const db = await this.openDB();
            const transaction = db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            return new Promise((resolve, reject) => {
                const request = store.delete(key);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(true);
            });
        } catch (error) {
            console.error('IndexedDB delete error:', error);
            return false;
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            const data = await this.load(key);
            return data !== undefined;
        } catch (error) {
            return false;
        }
    }

    async list(): Promise<string[]> {
        try {
            const db = await this.openDB();
            const transaction = db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            
            return new Promise((resolve, reject) => {
                const request = store.getAllKeys();
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result as string[]);
            });
        } catch (error) {
            console.error('IndexedDB list error:', error);
            return [];
        }
    }

    async clear(): Promise<boolean> {
        try {
            const db = await this.openDB();
            const transaction = db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            return new Promise((resolve, reject) => {
                const request = store.clear();
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(true);
            });
        } catch (error) {
            console.error('IndexedDB clear error:', error);
            return false;
        }
    }

    async getStats(): Promise<{ used: number; limit: number }> {
        try {
            const estimate = await navigator.storage.estimate();
            return {
                used: estimate.usage || 0,
                limit: estimate.quota || 0
            };
        } catch (error) {
            return { used: 0, limit: 0 };
        }
    }
}

class ServerStorageBackend implements StorageBackend {
    private endpoint: string;
    private apiKey?: string;

    constructor(endpoint?: string, apiKey?: string) {
        this.endpoint = endpoint || '/api/annotations';
        this.apiKey = apiKey;
    }

    private getHeaders(): HeadersInit {
        const headers: HeadersInit = {
            'Content-Type': 'application/json'
        };
        
        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }
        
        return headers;
    }

    async save(key: string, data: any): Promise<boolean> {
        try {
            const response = await fetch(`${this.endpoint}/${key}`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(data)
            });
            
            return response.ok;
        } catch (error) {
            console.error('Server save error:', error);
            return false;
        }
    }

    async load(key: string): Promise<any> {
        try {
            const response = await fetch(`${this.endpoint}/${key}`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            
            if (response.ok) {
                return await response.json();
            }
            
            return null;
        } catch (error) {
            console.error('Server load error:', error);
            return null;
        }
    }

    async delete(key: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.endpoint}/${key}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });
            
            return response.ok;
        } catch (error) {
            console.error('Server delete error:', error);
            return false;
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.endpoint}/${key}`, {
                method: 'HEAD',
                headers: this.getHeaders()
            });
            
            return response.ok;
        } catch (error) {
            console.error('Server exists error:', error);
            return false;
        }
    }

    async list(): Promise<string[]> {
        try {
            const response = await fetch(`${this.endpoint}`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.keys || [];
            }
            
            return [];
        } catch (error) {
            console.error('Server list error:', error);
            return [];
        }
    }

    async clear(): Promise<boolean> {
        try {
            const response = await fetch(`${this.endpoint}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });
            
            return response.ok;
        } catch (error) {
            console.error('Server clear error:', error);
            return false;
        }
    }

    async getStats(): Promise<{ used: number; limit: number }> {
        try {
            const response = await fetch(`${this.endpoint}/stats`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                return {
                    used: data.used || 0,
                    limit: data.limit || 0
                };
            }
            
            return { used: 0, limit: 0 };
        } catch (error) {
            console.error('Server stats error:', error);
            return { used: 0, limit: 0 };
        }
    }
}

// Convenience functions
export function createAnnotationPersistence(config?: PersistenceConfig): AnnotationPersistence {
    return new AnnotationPersistence(config);
}

export function getDefaultPersistenceConfig(): PersistenceConfig {
    return {
        enableAutoSave: true,
        autoSaveInterval: 30000,
        storageBackend: 'localStorage',
        enableCompression: false,
        maxStorageSize: 100 * 1024 * 1024,
        enableBackup: false,
        backupInterval: 3600000,
        retentionPeriod: 30,
        enableVersioning: false,
        maxVersions: 10
    };
}