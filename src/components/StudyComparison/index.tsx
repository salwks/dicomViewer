/**
 * StudyComparison Component
 * Allows side-by-side comparison of multiple DICOM studies
 */

import React, { useState, useCallback, useMemo } from 'react';
import { log } from '../../utils/logger';
import './styles.css';

interface DicomStudy {
  studyInstanceUID: string;
  studyDescription: string;
  studyDate: string;
  patientName: string;
  patientID: string;
  modality: string;
  seriesCount: number;
  accessionNumber?: string;
  institution?: string;
  thumbnail?: string;
}

interface StudyComparisonProps {
  studies: DicomStudy[];
  onStudySelect: (studyInstanceUID: string, position: number) => void;
  onStudyLoad: (studyInstanceUID: string, position: number) => void;
  maxComparisons?: number;
  className?: string;
}

interface ComparisonSlot {
  id: number;
  study?: DicomStudy;
  isActive: boolean;
}

export const StudyComparison: React.FC<StudyComparisonProps> = ({
  studies,
  onStudySelect,
  onStudyLoad,
  maxComparisons = 4,
  className = '',
}) => {
  const [comparisonSlots, setComparisonSlots] = useState<ComparisonSlot[]>(() =>
    Array.from({ length: maxComparisons }, (_, i) => ({
      id: i,
      study: undefined,
      isActive: false,
    })),
  );

  const [selectedStudy, setSelectedStudy] = useState<string>('');
  const [viewMode, setViewMode] = useState<'2x1' | '2x2' | '1x4'>('2x2');
  const [showStudyList, setShowStudyList] = useState(true);

  // Get available studies (not already in comparison slots)
  const availableStudies = useMemo(() => {
    const usedStudyUIDs = comparisonSlots
      .filter(slot => slot.study)
      .map(slot => slot.study!.studyInstanceUID);

    return studies.filter(study => !usedStudyUIDs.includes(study.studyInstanceUID));
  }, [studies, comparisonSlots]);

  const handleStudyDrop = useCallback((studyInstanceUID: string, slotId: number) => {
    const study = studies.find(s => s.studyInstanceUID === studyInstanceUID);
    if (!study) return;

    setComparisonSlots(prev => prev.map(slot =>
      slot.id === slotId
        ? { ...slot, study, isActive: true }
        : slot,
    ));

    onStudySelect(studyInstanceUID, slotId);

    log.info('Study added to comparison slot', {
      component: 'StudyComparison',
      metadata: { studyInstanceUID, slotId },
    });
  }, [studies, onStudySelect]);

  const handleStudyRemove = useCallback((slotId: number) => {
    setComparisonSlots(prev => prev.map(slot =>
      slot.id === slotId
        ? { ...slot, study: undefined, isActive: false }
        : slot,
    ));

    log.info('Study removed from comparison slot', {
      component: 'StudyComparison',
      metadata: { slotId },
    });
  }, []);

  const handleStudyLoad = useCallback((study: DicomStudy, slotId: number) => {
    onStudyLoad(study.studyInstanceUID, slotId);

    log.info('Study loaded in comparison viewer', {
      component: 'StudyComparison',
      metadata: { studyInstanceUID: study.studyInstanceUID, slotId },
    });
  }, [onStudyLoad]);

  const handleClearAll = useCallback(() => {
    setComparisonSlots(prev => prev.map(slot => ({
      ...slot,
      study: undefined,
      isActive: false,
    })));

    log.info('All comparison slots cleared', {
      component: 'StudyComparison',
    });
  }, []);

  const getViewModeClass = useCallback(() => {
    switch (viewMode) {
      case '2x1':
        return 'comparison-grid--2x1';
      case '2x2':
        return 'comparison-grid--2x2';
      case '1x4':
        return 'comparison-grid--1x4';
      default:
        return 'comparison-grid--2x2';
    }
  }, [viewMode]);

  const generateStudyThumbnail = useCallback((study: DicomStudy): string => {
    const modalityColors: Record<string, string> = {
      'CT': '#4a90e2',
      'MR': '#7ed321',
      'US': '#f5a623',
      'XA': '#bd10e0',
      'CR': '#50e3c2',
      'DX': '#9013fe',
      'PT': '#ff9800',
      'NM': '#795548',
    };

    const color = modalityColors[study.modality] || '#607d8b';

    return `data:image/svg+xml,${encodeURIComponent(`
      <svg width="80" height="80" xmlns="http://www.w3.org/2000/svg">
        <rect width="80" height="80" fill="${color}20"/>
        <rect x="5" y="5" width="70" height="70" fill="none" stroke="${color}" stroke-width="2"/>
        <text x="40" y="35" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="${color}">${study.modality}</text>
        <text x="40" y="50" text-anchor="middle" font-family="Arial" font-size="9" fill="${color}">${study.seriesCount} series</text>
      </svg>
    `)}`;
  }, []);

  return (
    <div className={`study-comparison ${className}`}>
      {/* Header Controls */}
      <div className="study-comparison__header">
        <div className="study-comparison__title">
          <h3>Study Comparison</h3>
          <span className="study-comparison__count">
            {comparisonSlots.filter(slot => slot.study).length} / {maxComparisons} studies
          </span>
        </div>

        <div className="study-comparison__controls">
          {/* View Mode Selector */}
          <div className="view-mode-selector">
            <label>Layout:</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as any)}
            >
              <option value="2x1">2 × 1</option>
              <option value="2x2">2 × 2</option>
              <option value="1x4">1 × 4</option>
            </select>
          </div>

          {/* Toggle Study List */}
          <button
            className={`toggle-btn ${showStudyList ? 'toggle-btn--active' : ''}`}
            onClick={() => setShowStudyList(!showStudyList)}
            title="Toggle Study List"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            Studies
          </button>

          {/* Clear All */}
          <button
            className="clear-btn"
            onClick={handleClearAll}
            disabled={comparisonSlots.every(slot => !slot.study)}
            title="Clear All Studies"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
            </svg>
            Clear All
          </button>
        </div>
      </div>

      <div className="study-comparison__body">
        {/* Study List Panel */}
        {showStudyList && (
          <div className="study-list-panel">
            <div className="study-list-panel__header">
              <h4>Available Studies</h4>
              <span className="study-count">{availableStudies.length} studies</span>
            </div>

            <div className="study-list">
              {availableStudies.length === 0 ? (
                <div className="study-list__empty">
                  <p>All studies are in comparison</p>
                </div>
              ) : (
                availableStudies.map((study) => (
                  <div
                    key={study.studyInstanceUID}
                    className={`study-item ${
                      selectedStudy === study.studyInstanceUID ? 'study-item--selected' : ''
                    }`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', study.studyInstanceUID);
                      setSelectedStudy(study.studyInstanceUID);
                    }}
                    onClick={() => setSelectedStudy(study.studyInstanceUID)}
                  >
                    <div className="study-item__thumbnail">
                      <img
                        src={study.thumbnail || generateStudyThumbnail(study)}
                        alt={`${study.modality} Study`}
                        loading="lazy"
                      />
                    </div>

                    <div className="study-item__info">
                      <div className="study-item__header">
                        <span className="study-item__modality">{study.modality}</span>
                        <span className="study-item__date">{study.studyDate}</span>
                      </div>
                      <h5 className="study-item__description">
                        {study.studyDescription}
                      </h5>
                      <p className="study-item__patient">
                        {study.patientName} ({study.patientID})
                      </p>
                      <p className="study-item__details">
                        {study.seriesCount} series
                        {study.institution && ` • ${study.institution}`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Comparison Grid */}
        <div className={`comparison-grid ${getViewModeClass()}`}>
          {comparisonSlots.slice(0, maxComparisons).map((slot) => (
            <div
              key={slot.id}
              className={`comparison-slot ${slot.isActive ? 'comparison-slot--active' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const studyInstanceUID = e.dataTransfer.getData('text/plain');
                if (studyInstanceUID) {
                  handleStudyDrop(studyInstanceUID, slot.id);
                }
              }}
            >
              {slot.study ? (
                <>
                  {/* Study Content */}
                  <div className="comparison-slot__content">
                    <div className="comparison-slot__header">
                      <div className="slot-info">
                        <span className="slot-modality">{slot.study.modality}</span>
                        <span className="slot-date">{slot.study.studyDate}</span>
                      </div>
                      <div className="slot-actions">
                        <button
                          className="slot-action"
                          onClick={() => handleStudyLoad(slot.study!, slot.id)}
                          title="Load Study"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="5,3 19,12 5,21"/>
                          </svg>
                        </button>
                        <button
                          className="slot-action slot-action--remove"
                          onClick={() => handleStudyRemove(slot.id)}
                          title="Remove Study"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="comparison-slot__viewer">
                      {/* Placeholder for DICOM viewer */}
                      <div className="slot-placeholder">
                        <div className="slot-placeholder__content">
                          <img
                            src={slot.study.thumbnail || generateStudyThumbnail(slot.study)}
                            alt={`${slot.study.modality} Study Preview`}
                          />
                          <div className="slot-placeholder__info">
                            <h6>{slot.study.studyDescription}</h6>
                            <p>{slot.study.patientName}</p>
                            <span>{slot.study.seriesCount} series</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="comparison-slot__footer">
                      <span className="slot-position">Slot {slot.id + 1}</span>
                      <span className="slot-description">{slot.study.studyDescription}</span>
                    </div>
                  </div>
                </>
              ) : (
                /* Empty Slot */
                <div className="comparison-slot__empty">
                  <div className="empty-slot-content">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <line x1="9" y1="9" x2="15" y2="15"/>
                      <line x1="15" y1="9" x2="9" y2="15"/>
                    </svg>
                    <h4>Slot {slot.id + 1}</h4>
                    <p>Drag a study here</p>
                    <span>or click to select</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
