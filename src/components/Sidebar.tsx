import { 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Settings,
  Info,
  Database
} from 'lucide-react';
import { useDicomStore, selectCurrentSeries, selectAnnotations } from '../store/dicom-store';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const currentSeries = useDicomStore(selectCurrentSeries);
  const annotations = useDicomStore(selectAnnotations);

  return (
    <>
      {/* Sidebar Toggle Button */}
      <button 
        className="sidebar-toggle"
        onClick={onToggle}
        title={isOpen ? 'Close Sidebar' : 'Open Sidebar'}
      >
        {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {/* Sidebar Content */}
      <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-content">
          {/* Series Information */}
          <div className="sidebar-section">
            <h3 className="sidebar-section-title">
              <Database size={16} />
              Series Information
            </h3>
            {currentSeries ? (
              <div className="series-info">
                <div className="info-item">
                  <label>Description:</label>
                  <span>{currentSeries.seriesDescription}</span>
                </div>
                <div className="info-item">
                  <label>Modality:</label>
                  <span>{currentSeries.modality}</span>
                </div>
                <div className="info-item">
                  <label>Series Number:</label>
                  <span>{currentSeries.seriesNumber}</span>
                </div>
                <div className="info-item">
                  <label>Images:</label>
                  <span>{currentSeries.numberOfImages}</span>
                </div>
                {currentSeries.patientInfo && (
                  <>
                    <div className="info-item">
                      <label>Patient:</label>
                      <span>{currentSeries.patientInfo.patientName}</span>
                    </div>
                    <div className="info-item">
                      <label>Patient ID:</label>
                      <span>{currentSeries.patientInfo.patientId}</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="no-data">No series loaded</p>
            )}
          </div>

          {/* Annotations */}
          <div className="sidebar-section">
            <h3 className="sidebar-section-title">
              <FileText size={16} />
              Annotations ({annotations.length})
            </h3>
            {annotations.length > 0 ? (
              <div className="annotations-list">
                {annotations.map((annotation) => (
                  <div key={annotation.annotationUID} className="annotation-item">
                    <div className="annotation-header">
                      <span className="annotation-tool">{annotation.toolName}</span>
                      <span className="annotation-id">
                        {annotation.annotationUID.slice(0, 8)}...
                      </span>
                    </div>
                    {annotation.data?.label && (
                      <div className="annotation-label">
                        {annotation.data.label}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-data">No annotations</p>
            )}
          </div>

          {/* Settings */}
          <div className="sidebar-section">
            <h3 className="sidebar-section-title">
              <Settings size={16} />
              Settings
            </h3>
            <div className="settings-list">
              <div className="setting-item">
                <label>
                  <input type="checkbox" defaultChecked />
                  Show Annotations
                </label>
              </div>
              <div className="setting-item">
                <label>
                  <input type="checkbox" defaultChecked />
                  Enable Pan/Zoom
                </label>
              </div>
              <div className="setting-item">
                <label>
                  <input type="checkbox" />
                  Show Overlays
                </label>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="sidebar-section">
            <h3 className="sidebar-section-title">
              <Info size={16} />
              About
            </h3>
            <div className="about-info">
              <p>Modern DICOM Viewer v2.0</p>
              <p>Built with Cornerstone3D</p>
              <p>React + TypeScript</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}