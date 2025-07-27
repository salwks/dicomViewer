/**
 * DicomMetadataViewer Component
 * Comprehensive DICOM metadata display and management for medical imaging
 */

import React, { useState, useCallback, useMemo } from 'react';
import './styles.css';

export interface DicomTag {
  tag: string;
  vr: string; // Value Representation
  keyword: string;
  value: any;
  group: string;
  element: string;
  length?: number;
  description?: string;
  isPrivate?: boolean;
  isSequence?: boolean;
  sequenceItems?: DicomTag[][];
}

export interface DicomMetadata {
  patientInfo: {
    patientName?: string;
    patientId?: string;
    patientBirthDate?: string;
    patientSex?: string;
    patientAge?: string;
    patientWeight?: string;
    patientHeight?: string;
  };
  studyInfo: {
    studyInstanceUID?: string;
    studyDate?: string;
    studyTime?: string;
    studyDescription?: string;
    studyId?: string;
    accessionNumber?: string;
    referringPhysician?: string;
    institutionName?: string;
  };
  seriesInfo: {
    seriesInstanceUID?: string;
    seriesNumber?: string;
    seriesDescription?: string;
    modality?: string;
    seriesDate?: string;
    seriesTime?: string;
    bodyPartExamined?: string;
    protocolName?: string;
    imageCount?: number;
  };
  imageInfo: {
    sopInstanceUID?: string;
    instanceNumber?: string;
    imageType?: string;
    imagePosition?: number[];
    imageOrientation?: number[];
    pixelSpacing?: number[];
    sliceThickness?: number;
    sliceLocation?: number;
    frameOfReferenceUID?: string;
    acquisitionDate?: string;
    acquisitionTime?: string;
  };
  technicalInfo: {
    manufacturer?: string;
    manufacturerModel?: string;
    deviceSerialNumber?: string;
    softwareVersion?: string;
    kvp?: number;
    xRayTubeCurrent?: number;
    exposureTime?: number;
    exposureInUas?: number;
    filterType?: string;
    convolutionKernel?: string;
    reconstructionDiameter?: number;
  };
  allTags: DicomTag[];
}

interface DicomMetadataViewerProps {
  metadata: DicomMetadata;
  onTagSelect?: (tag: DicomTag) => void;
  onExportMetadata?: (format: 'json' | 'csv' | 'xml') => void;
  enableSearch?: boolean;
  enableGrouping?: boolean;
  enableExport?: boolean;
  showPrivateTags?: boolean;
  className?: string;
}

type ViewMode = 'structured' | 'raw' | 'table';
type FilterMode = 'all' | 'standard' | 'private' | 'sequences';

const DICOM_VR_DESCRIPTIONS: Record<string, string> = {
  'AE': 'Application Entity',
  'AS': 'Age String',
  'AT': 'Attribute Tag',
  'CS': 'Code String',
  'DA': 'Date',
  'DS': 'Decimal String',
  'DT': 'Date Time',
  'FD': 'Floating Point Double',
  'FL': 'Floating Point Single',
  'IS': 'Integer String',
  'LO': 'Long String',
  'LT': 'Long Text',
  'OB': 'Other Byte',
  'OD': 'Other Double',
  'OF': 'Other Float',
  'OL': 'Other Long',
  'OW': 'Other Word',
  'PN': 'Person Name',
  'SH': 'Short String',
  'SL': 'Signed Long',
  'SQ': 'Sequence',
  'SS': 'Signed Short',
  'ST': 'Short Text',
  'TM': 'Time',
  'UC': 'Unlimited Characters',
  'UI': 'Unique Identifier',
  'UL': 'Unsigned Long',
  'UN': 'Unknown',
  'UR': 'Universal Resource',
  'US': 'Unsigned Short',
  'UT': 'Unlimited Text',
};

export const DicomMetadataViewer: React.FC<DicomMetadataViewerProps> = ({
  metadata,
  onTagSelect,
  onExportMetadata,
  enableSearch = true,
  enableGrouping: _enableGrouping = true,
  enableExport = true,
  showPrivateTags: _showPrivateTags = false,
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('structured');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['patient', 'study', 'series']));
  const [selectedTag, setSelectedTag] = useState<DicomTag | null>(null);

  // Filter and search tags
  const filteredTags = useMemo(() => {
    let tags = metadata.allTags;

    // Apply filter mode
    switch (filterMode) {
      case 'standard':
        tags = tags.filter(tag => !tag.isPrivate);
        break;
      case 'private':
        tags = tags.filter(tag => tag.isPrivate);
        break;
      case 'sequences':
        tags = tags.filter(tag => tag.isSequence);
        break;
    }

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      tags = tags.filter(tag =>
        tag.keyword.toLowerCase().includes(query) ||
        tag.tag.toLowerCase().includes(query) ||
        tag.description?.toLowerCase().includes(query) ||
        String(tag.value).toLowerCase().includes(query),
      );
    }

    return tags;
  }, [metadata.allTags, filterMode, searchQuery]);

  const handleTagClick = useCallback((tag: DicomTag) => {
    setSelectedTag(tag);
    onTagSelect?.(tag);
  }, [onTagSelect]);

  const toggleGroup = useCallback((groupName: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  }, []);

  const formatTagValue = useCallback((tag: DicomTag): string => {
    if (tag.value === undefined || tag.value === null) return '';

    if (Array.isArray(tag.value)) {
      return tag.value.join(', ');
    }

    if (typeof tag.value === 'object') {
      return JSON.stringify(tag.value, null, 2);
    }

    return String(tag.value);
  }, []);

  const formatDate = useCallback((dateStr: string): string => {
    if (!dateStr || dateStr.length !== 8) return dateStr;

    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);

    try {
      const date = new Date(`${year}-${month}-${day}`);
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  }, []);

  const formatTime = useCallback((timeStr: string): string => {
    if (!timeStr || timeStr.length < 6) return timeStr;

    const hour = timeStr.substring(0, 2);
    const minute = timeStr.substring(2, 4);
    const second = timeStr.substring(4, 6);

    return `${hour}:${minute}:${second}`;
  }, []);

  const renderStructuredView = () => (
    <div className="dicom-metadata__structured">
      {/* Patient Information */}
      <div className="dicom-metadata__group">
        <button
          className="dicom-metadata__group-header"
          onClick={() => toggleGroup('patient')}
          aria-expanded={expandedGroups.has('patient')}
        >
          <span className="dicom-metadata__group-title">Patient Information</span>
          <svg
            className={`dicom-metadata__group-icon ${
              expandedGroups.has('patient') ? 'dicom-metadata__group-icon--expanded' : ''
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {expandedGroups.has('patient') && (
          <div className="dicom-metadata__group-content">
            <div className="dicom-metadata__field">
              <span className="dicom-metadata__field-label">Patient Name:</span>
              <span className="dicom-metadata__field-value">{metadata.patientInfo.patientName || 'N/A'}</span>
            </div>
            <div className="dicom-metadata__field">
              <span className="dicom-metadata__field-label">Patient ID:</span>
              <span className="dicom-metadata__field-value">{metadata.patientInfo.patientId || 'N/A'}</span>
            </div>
            <div className="dicom-metadata__field">
              <span className="dicom-metadata__field-label">Birth Date:</span>
              <span className="dicom-metadata__field-value">
                {metadata.patientInfo.patientBirthDate ? formatDate(metadata.patientInfo.patientBirthDate) : 'N/A'}
              </span>
            </div>
            <div className="dicom-metadata__field">
              <span className="dicom-metadata__field-label">Sex:</span>
              <span className="dicom-metadata__field-value">{metadata.patientInfo.patientSex || 'N/A'}</span>
            </div>
            <div className="dicom-metadata__field">
              <span className="dicom-metadata__field-label">Age:</span>
              <span className="dicom-metadata__field-value">{metadata.patientInfo.patientAge || 'N/A'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Study Information */}
      <div className="dicom-metadata__group">
        <button
          className="dicom-metadata__group-header"
          onClick={() => toggleGroup('study')}
          aria-expanded={expandedGroups.has('study')}
        >
          <span className="dicom-metadata__group-title">Study Information</span>
          <svg
            className={`dicom-metadata__group-icon ${
              expandedGroups.has('study') ? 'dicom-metadata__group-icon--expanded' : ''
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {expandedGroups.has('study') && (
          <div className="dicom-metadata__group-content">
            <div className="dicom-metadata__field">
              <span className="dicom-metadata__field-label">Study Date:</span>
              <span className="dicom-metadata__field-value">
                {metadata.studyInfo.studyDate ? formatDate(metadata.studyInfo.studyDate) : 'N/A'}
              </span>
            </div>
            <div className="dicom-metadata__field">
              <span className="dicom-metadata__field-label">Study Time:</span>
              <span className="dicom-metadata__field-value">
                {metadata.studyInfo.studyTime ? formatTime(metadata.studyInfo.studyTime) : 'N/A'}
              </span>
            </div>
            <div className="dicom-metadata__field">
              <span className="dicom-metadata__field-label">Study Description:</span>
              <span className="dicom-metadata__field-value">{metadata.studyInfo.studyDescription || 'N/A'}</span>
            </div>
            <div className="dicom-metadata__field">
              <span className="dicom-metadata__field-label">Institution:</span>
              <span className="dicom-metadata__field-value">{metadata.studyInfo.institutionName || 'N/A'}</span>
            </div>
            <div className="dicom-metadata__field">
              <span className="dicom-metadata__field-label">Referring Physician:</span>
              <span className="dicom-metadata__field-value">{metadata.studyInfo.referringPhysician || 'N/A'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Series Information */}
      <div className="dicom-metadata__group">
        <button
          className="dicom-metadata__group-header"
          onClick={() => toggleGroup('series')}
          aria-expanded={expandedGroups.has('series')}
        >
          <span className="dicom-metadata__group-title">Series Information</span>
          <svg
            className={`dicom-metadata__group-icon ${
              expandedGroups.has('series') ? 'dicom-metadata__group-icon--expanded' : ''
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {expandedGroups.has('series') && (
          <div className="dicom-metadata__group-content">
            <div className="dicom-metadata__field">
              <span className="dicom-metadata__field-label">Modality:</span>
              <span className="dicom-metadata__field-value">{metadata.seriesInfo.modality || 'N/A'}</span>
            </div>
            <div className="dicom-metadata__field">
              <span className="dicom-metadata__field-label">Series Number:</span>
              <span className="dicom-metadata__field-value">{metadata.seriesInfo.seriesNumber || 'N/A'}</span>
            </div>
            <div className="dicom-metadata__field">
              <span className="dicom-metadata__field-label">Series Description:</span>
              <span className="dicom-metadata__field-value">{metadata.seriesInfo.seriesDescription || 'N/A'}</span>
            </div>
            <div className="dicom-metadata__field">
              <span className="dicom-metadata__field-label">Body Part:</span>
              <span className="dicom-metadata__field-value">{metadata.seriesInfo.bodyPartExamined || 'N/A'}</span>
            </div>
            <div className="dicom-metadata__field">
              <span className="dicom-metadata__field-label">Image Count:</span>
              <span className="dicom-metadata__field-value">{metadata.seriesInfo.imageCount || 'N/A'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Image Information */}
      <div className="dicom-metadata__group">
        <button
          className="dicom-metadata__group-header"
          onClick={() => toggleGroup('image')}
          aria-expanded={expandedGroups.has('image')}
        >
          <span className="dicom-metadata__group-title">Image Information</span>
          <svg
            className={`dicom-metadata__group-icon ${
              expandedGroups.has('image') ? 'dicom-metadata__group-icon--expanded' : ''
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {expandedGroups.has('image') && (
          <div className="dicom-metadata__group-content">
            <div className="dicom-metadata__field">
              <span className="dicom-metadata__field-label">Instance Number:</span>
              <span className="dicom-metadata__field-value">{metadata.imageInfo.instanceNumber || 'N/A'}</span>
            </div>
            <div className="dicom-metadata__field">
              <span className="dicom-metadata__field-label">Slice Thickness:</span>
              <span className="dicom-metadata__field-value">
                {metadata.imageInfo.sliceThickness ? `${metadata.imageInfo.sliceThickness} mm` : 'N/A'}
              </span>
            </div>
            <div className="dicom-metadata__field">
              <span className="dicom-metadata__field-label">Pixel Spacing:</span>
              <span className="dicom-metadata__field-value">
                {metadata.imageInfo.pixelSpacing ? `${metadata.imageInfo.pixelSpacing.join(' x ')} mm` : 'N/A'}
              </span>
            </div>
            <div className="dicom-metadata__field">
              <span className="dicom-metadata__field-label">Slice Location:</span>
              <span className="dicom-metadata__field-value">
                {metadata.imageInfo.sliceLocation ? `${metadata.imageInfo.sliceLocation} mm` : 'N/A'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Technical Information */}
      <div className="dicom-metadata__group">
        <button
          className="dicom-metadata__group-header"
          onClick={() => toggleGroup('technical')}
          aria-expanded={expandedGroups.has('technical')}
        >
          <span className="dicom-metadata__group-title">Technical Information</span>
          <svg
            className={`dicom-metadata__group-icon ${
              expandedGroups.has('technical') ? 'dicom-metadata__group-icon--expanded' : ''
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {expandedGroups.has('technical') && (
          <div className="dicom-metadata__group-content">
            <div className="dicom-metadata__field">
              <span className="dicom-metadata__field-label">Manufacturer:</span>
              <span className="dicom-metadata__field-value">{metadata.technicalInfo.manufacturer || 'N/A'}</span>
            </div>
            <div className="dicom-metadata__field">
              <span className="dicom-metadata__field-label">Model:</span>
              <span className="dicom-metadata__field-value">{metadata.technicalInfo.manufacturerModel || 'N/A'}</span>
            </div>
            <div className="dicom-metadata__field">
              <span className="dicom-metadata__field-label">Software Version:</span>
              <span className="dicom-metadata__field-value">{metadata.technicalInfo.softwareVersion || 'N/A'}</span>
            </div>
            {metadata.technicalInfo.kvp && (
              <div className="dicom-metadata__field">
                <span className="dicom-metadata__field-label">kVp:</span>
                <span className="dicom-metadata__field-value">{metadata.technicalInfo.kvp}</span>
              </div>
            )}
            {metadata.technicalInfo.xRayTubeCurrent && (
              <div className="dicom-metadata__field">
                <span className="dicom-metadata__field-label">Tube Current:</span>
                <span className="dicom-metadata__field-value">{metadata.technicalInfo.xRayTubeCurrent} mA</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderRawView = () => (
    <div className="dicom-metadata__raw">
      {filteredTags.map((tag, index) => (
        <div
          key={`${tag.tag}-${index}`}
          className={`dicom-metadata__tag ${
            selectedTag?.tag === tag.tag ? 'dicom-metadata__tag--selected' : ''
          } ${
            tag.isPrivate ? 'dicom-metadata__tag--private' : ''
          }`}
          onClick={() => handleTagClick(tag)}
        >
          <div className="dicom-metadata__tag-header">
            <span className="dicom-metadata__tag-id">{tag.tag}</span>
            <span className="dicom-metadata__tag-vr">{tag.vr}</span>
            {tag.isPrivate && (
              <span className="dicom-metadata__tag-private">Private</span>
            )}
          </div>
          <div className="dicom-metadata__tag-content">
            <div className="dicom-metadata__tag-keyword">{tag.keyword}</div>
            {tag.description && (
              <div className="dicom-metadata__tag-description">{tag.description}</div>
            )}
            <div className="dicom-metadata__tag-value">
              {formatTagValue(tag)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderTableView = () => (
    <div className="dicom-metadata__table-container">
      <table className="dicom-metadata__table">
        <thead>
          <tr>
            <th>Tag</th>
            <th>VR</th>
            <th>Keyword</th>
            <th>Value</th>
            <th>Length</th>
          </tr>
        </thead>
        <tbody>
          {filteredTags.map((tag, index) => (
            <tr
              key={`${tag.tag}-${index}`}
              className={`${
                selectedTag?.tag === tag.tag ? 'dicom-metadata__table-row--selected' : ''
              } ${
                tag.isPrivate ? 'dicom-metadata__table-row--private' : ''
              }`}
              onClick={() => handleTagClick(tag)}
            >
              <td className="dicom-metadata__table-tag">{tag.tag}</td>
              <td className="dicom-metadata__table-vr" title={DICOM_VR_DESCRIPTIONS[tag.vr] || tag.vr}>
                {tag.vr}
              </td>
              <td className="dicom-metadata__table-keyword">{tag.keyword}</td>
              <td className="dicom-metadata__table-value">{formatTagValue(tag)}</td>
              <td className="dicom-metadata__table-length">{tag.length || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className={`dicom-metadata ${className}`}>
      {/* Header */}
      <div className="dicom-metadata__header">
        <h3 className="dicom-metadata__title">DICOM Metadata</h3>

        <div className="dicom-metadata__controls">
          {/* View Mode Selector */}
          <div className="dicom-metadata__view-modes">
            <button
              className={`dicom-metadata__view-mode ${
                viewMode === 'structured' ? 'dicom-metadata__view-mode--active' : ''
              }`}
              onClick={() => setViewMode('structured')}
              title="Structured view"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="9" x2="15" y2="9" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </button>
            <button
              className={`dicom-metadata__view-mode ${
                viewMode === 'raw' ? 'dicom-metadata__view-mode--active' : ''
              }`}
              onClick={() => setViewMode('raw')}
              title="Raw tags view"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 3h5v5M16 21H3V8M21 3l-7 7M10 7l-3 3M14 14l-3 3" />
              </svg>
            </button>
            <button
              className={`dicom-metadata__view-mode ${
                viewMode === 'table' ? 'dicom-metadata__view-mode--active' : ''
              }`}
              onClick={() => setViewMode('table')}
              title="Table view"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <line x1="15" y1="3" x2="15" y2="21" />
              </svg>
            </button>
          </div>

          {/* Export Button */}
          {enableExport && (
            <div className="dicom-metadata__export">
              <button
                className="dicom-metadata__export-button"
                onClick={() => onExportMetadata?.('json')}
                title="Export metadata"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search and Filter Controls */}
      {(enableSearch || viewMode !== 'structured') && (
        <div className="dicom-metadata__filters">
          {/* Search */}
          {enableSearch && (
            <div className="dicom-metadata__search">
              <svg className="dicom-metadata__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                className="dicom-metadata__search-input"
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          {/* Filter Mode */}
          {viewMode !== 'structured' && (
            <select
              className="dicom-metadata__filter"
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as FilterMode)}
            >
              <option value="all">All Tags</option>
              <option value="standard">Standard Tags</option>
              <option value="private">Private Tags</option>
              <option value="sequences">Sequences</option>
            </select>
          )}
        </div>
      )}

      {/* Content */}
      <div className="dicom-metadata__content">
        {viewMode === 'structured' && renderStructuredView()}
        {viewMode === 'raw' && renderRawView()}
        {viewMode === 'table' && renderTableView()}
      </div>

      {/* Tag Count */}
      <div className="dicom-metadata__footer">
        <span className="dicom-metadata__tag-count">
          {filteredTags.length} tag{filteredTags.length !== 1 ? 's' : ''} displayed
        </span>
      </div>
    </div>
  );
};
