/**
 * File Uploader Component
 * Simple drag-and-drop interface for DICOM files
 */

/* eslint-disable security/detect-object-injection */

import React, { useState, useRef, DragEvent } from 'react';
import './styles.css';

interface FileInfo {
  name: string;
  size: number;
  type: string;
  file: File;
}

interface FileUploaderProps {
  onFilesLoaded?: (files: File[]) => void;
  maxFiles?: number;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFilesLoaded,
  maxFiles = 100,
}) => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    processFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    processFiles(selectedFiles);
  };

  const processFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => {
      // Accept DICOM files and common medical image formats
      const validTypes = [
        'application/dicom',
        'image/dicom',
        'image/x-dicom',
        'application/octet-stream', // Many DICOM files come as this
      ];

      const validExtensions = ['.dcm', '.dicom', '.dic'];
      const hasValidExtension = validExtensions.some(ext =>
        file.name.toLowerCase().endsWith(ext),
      );

      return validTypes.includes(file.type) || hasValidExtension || file.type === '';
    });

    const fileInfos: FileInfo[] = validFiles.slice(0, maxFiles - files.length).map(file => ({
      name: file.name,
      size: file.size,
      type: file.type || 'DICOM',
      file,
    }));

    const updatedFiles = [...files, ...fileInfos];
    setFiles(updatedFiles);

    if (onFilesLoaded) {
      onFilesLoaded(updatedFiles.map(f => f.file));
    }
  };

  const removeFile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    setFiles(updatedFiles);

    if (onFilesLoaded) {
      onFilesLoaded(updatedFiles.map(f => f.file));
    }
  };

  const clearAllFiles = () => {
    setFiles([]);
    if (onFilesLoaded) {
      onFilesLoaded([]);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const safeIndex = Math.max(0, Math.min(i, sizes.length - 1));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[safeIndex]}`;
  };

  return (
    <div className="file-uploader">
      <div
        className={`upload-area ${isDragging ? 'dragging' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".dcm,.dicom,.dic,application/dicom"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <div className="upload-icon">📁</div>
        <h3>Drop DICOM files here</h3>
        <p>or click to browse</p>
        <div className="upload-hints">
          <span>Supported: .dcm, .dicom files</span>
          <span>• Max {maxFiles} files</span>
        </div>
      </div>

      {files.length > 0 && (
        <div className="files-section">
          <div className="files-header">
            <h4>Uploaded Files ({files.length})</h4>
            <button onClick={clearAllFiles} className="clear-btn">
              Clear All
            </button>
          </div>

          <div className="files-list">
            {files.map((file, index) => (
              <div key={index} className="file-item">
                <div className="file-icon">🏥</div>
                <div className="file-info">
                  <div className="file-name">{file.name}</div>
                  <div className="file-size">{formatFileSize(file.size)}</div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="remove-btn"
                  title="Remove file"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            className="view-btn"
            onClick={() => {
              if (onFilesLoaded) {
                onFilesLoaded(files.map(f => f.file));
              }
            }}
          >
            ✅ Load {files.length} Files into Viewer
          </button>
        </div>
      )}
    </div>
  );
};
