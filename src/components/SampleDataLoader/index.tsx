/**
 * Sample Data Loader Component
 * UI for downloading and managing sample DICOM files
 */

import React, { useState, useEffect } from 'react';
import { sampleDataService, SampleDicomFile } from '../../services/sampleDataService';
import './styles.css';

interface SampleDataLoaderProps {
  onDataLoaded?: (data: any) => void;
  autoLoad?: boolean;
  className?: string;
}

interface DownloadProgress {
  fileId: string;
  progress: number;
  downloadedSize: number;
  totalSize: number;
}

export const SampleDataLoader: React.FC<SampleDataLoaderProps> = ({
  onDataLoaded,
  autoLoad = false,
  className = '',
}) => {
  const [sampleFiles, setSampleFiles] = useState<SampleDicomFile[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<Map<string, DownloadProgress>>(new Map());
  const [isPreloading, setIsPreloading] = useState(false);
  const [stats, setStats] = useState<any>({});

  useEffect(() => {
    // Initialize sample files
    setSampleFiles(sampleDataService.getSampleFiles());
    updateStats();

    // Set up event listeners
    const handleDownloadStarted = (event: CustomEvent) => {
      const { fileId } = event.detail;
      setSampleFiles(prev => prev.map(file => 
        file.id === fileId ? { ...file, loading: true } : file
      ));
    };

    const handleDownloadProgress = (event: CustomEvent) => {
      const { fileId, progress, downloadedSize, totalSize } = event.detail;
      setDownloadProgress(prev => new Map(prev.set(fileId, {
        fileId,
        progress,
        downloadedSize,
        totalSize,
      })));
    };

    const handleDownloadCompleted = (event: CustomEvent) => {
      const { fileId } = event.detail;
      setSampleFiles(prev => prev.map(file => 
        file.id === fileId ? { ...file, loading: false, downloaded: true } : file
      ));
      setDownloadProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(fileId);
        return newMap;
      });
      updateStats();
      
      if (onDataLoaded) {
        const viewerData = sampleDataService.getSampleDataForViewer();
        onDataLoaded(viewerData);
      }
    };

    const handleDownloadFailed = (event: CustomEvent) => {
      const { fileId, error } = event.detail;
      setSampleFiles(prev => prev.map(file => 
        file.id === fileId ? { ...file, loading: false } : file
      ));
      setDownloadProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(fileId);
        return newMap;
      });
      console.error(`Download failed for ${fileId}:`, error);
    };

    const handlePreloadStarted = () => {
      setIsPreloading(true);
    };

    const handlePreloadCompleted = () => {
      setIsPreloading(false);
      updateStats();
      
      if (onDataLoaded) {
        const viewerData = sampleDataService.getSampleDataForViewer();
        onDataLoaded(viewerData);
      }
    };

    const handlePreloadFailed = () => {
      setIsPreloading(false);
    };

    sampleDataService.addEventListener('download:started', handleDownloadStarted);
    sampleDataService.addEventListener('download:progress', handleDownloadProgress);
    sampleDataService.addEventListener('download:completed', handleDownloadCompleted);
    sampleDataService.addEventListener('download:failed', handleDownloadFailed);
    sampleDataService.addEventListener('preload:started', handlePreloadStarted);
    sampleDataService.addEventListener('preload:completed', handlePreloadCompleted);
    sampleDataService.addEventListener('preload:failed', handlePreloadFailed);

    // Auto-load if requested
    if (autoLoad) {
      handlePreloadEssentialFiles();
    }

    return () => {
      sampleDataService.removeEventListener('download:started', handleDownloadStarted);
      sampleDataService.removeEventListener('download:progress', handleDownloadProgress);
      sampleDataService.removeEventListener('download:completed', handleDownloadCompleted);
      sampleDataService.removeEventListener('download:failed', handleDownloadFailed);
      sampleDataService.removeEventListener('preload:started', handlePreloadStarted);
      sampleDataService.removeEventListener('preload:completed', handlePreloadCompleted);
      sampleDataService.removeEventListener('preload:failed', handlePreloadFailed);
    };
  }, [autoLoad, onDataLoaded]);

  const updateStats = () => {
    setStats(sampleDataService.getStats());
  };

  const handleDownloadFile = async (fileId: string) => {
    try {
      await sampleDataService.downloadSampleFile(fileId);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handlePreloadEssentialFiles = async () => {
    try {
      await sampleDataService.preloadEssentialFiles();
    } catch (error) {
      console.error('Preload failed:', error);
    }
  };

  const handleClearCache = () => {
    sampleDataService.clearCache();
    setSampleFiles(sampleDataService.getSampleFiles());
    setDownloadProgress(new Map());
    updateStats();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getModalityIcon = (modality: string): string => {
    const icons: Record<string, string> = {
      CT: '🏥',
      MR: '🧠',
      US: '🔊',
      CR: '📷',
      XR: '📷',
    };
    return icons[modality] || '📋';
  };

  const getModalityColor = (modality: string): string => {
    const colors: Record<string, string> = {
      CT: '#4CAF50',
      MR: '#2196F3',
      US: '#FF9800',
      CR: '#9C27B0',
      XR: '#607D8B',
    };
    return colors[modality] || '#757575';
  };

  return (
    <div className={`sample-data-loader ${className}`}>
      <div className="sample-data-header">
        <h3>Sample DICOM Data</h3>
        <div className="sample-data-stats">
          <span className="stat">
            {stats.downloadedFiles || 0}/{stats.totalFiles || 0} files
          </span>
          <span className="stat">
            Cache: {stats.cacheSizeFormatted || '0 Bytes'}
          </span>
        </div>
      </div>

      <div className="sample-data-actions">
        <button
          className="btn btn-primary"
          onClick={handlePreloadEssentialFiles}
          disabled={isPreloading}
        >
          {isPreloading ? 'Loading Essential Files...' : 'Load Essential Files'}
        </button>
        
        <button
          className="btn btn-secondary"
          onClick={handleClearCache}
          disabled={stats.downloadedFiles === 0}
        >
          Clear Cache
        </button>
      </div>

      {isPreloading && (
        <div className="preload-indicator">
          <div className="loading-spinner"></div>
          <span>Loading essential sample files...</span>
        </div>
      )}

      <div className="sample-files-list">
        {sampleFiles.map(file => {
          const progress = downloadProgress.get(file.id);
          
          return (
            <div key={file.id} className="sample-file-item">
              <div className="file-header">
                <div className="file-info">
                  <div className="file-title">
                    <span 
                      className="modality-icon"
                      style={{ color: getModalityColor(file.modality) }}
                    >
                      {getModalityIcon(file.modality)}
                    </span>
                    <span className="file-name">{file.name}</span>
                    <span className="modality-badge" style={{ backgroundColor: getModalityColor(file.modality) }}>
                      {file.modality}
                    </span>
                  </div>
                  <div className="file-description">{file.description}</div>
                  <div className="file-details">
                    <span>Size: {formatBytes(file.size)}</span>
                    <span>Instances: {file.instances}</span>
                  </div>
                </div>

                <div className="file-actions">
                  {file.downloaded ? (
                    <span className="status-downloaded">✅ Downloaded</span>
                  ) : file.loading ? (
                    <span className="status-loading">⏳ Loading...</span>
                  ) : (
                    <button
                      className="btn btn-small btn-outline"
                      onClick={() => handleDownloadFile(file.id)}
                    >
                      Download
                    </button>
                  )}
                </div>
              </div>

              {progress && (
                <div className="download-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${progress.progress}%` }}
                    ></div>
                  </div>
                  <div className="progress-text">
                    {Math.round(progress.progress)}% - 
                    {formatBytes(progress.downloadedSize)} / {formatBytes(progress.totalSize)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {stats.downloadedFiles > 0 && (
        <div className="sample-data-summary">
          <h4>Available Data</h4>
          <div className="data-summary">
            <div className="summary-item">
              <span className="label">Single Images:</span>
              <span className="value">{stats.downloadedFiles}</span>
            </div>
            <div className="summary-item">
              <span className="label">Total Cache Size:</span>
              <span className="value">{stats.cacheSizeFormatted}</span>
            </div>
            <div className="summary-item">
              <span className="label">Ready for Viewing:</span>
              <span className="value">✅ Yes</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};