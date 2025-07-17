import React from 'react';
import { X, FileText, Copy, Search } from 'lucide-react';
import { validateAnnotationLabel } from '../utils/input-validation';
import { useUIStore } from '../store/uiStore';
import { useTranslation } from '../utils/i18n';

interface DicomMetaModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataSet: any;
  inline?: boolean; // inline 모드 추가
}

interface DicomTag {
  tag: string;
  vr: string;
  name: string;
  value: string;
}

// 일반적인 DICOM 태그 이름 매핑
const dicomTagNames: Record<string, string> = {
  'x00080005': 'Specific Character Set',
  'x00080008': 'Image Type',
  'x00080012': 'Instance Creation Date',
  'x00080013': 'Instance Creation Time',
  'x00080016': 'SOP Class UID',
  'x00080018': 'SOP Instance UID',
  'x00080020': 'Study Date',
  'x00080021': 'Series Date',
  'x00080022': 'Acquisition Date',
  'x00080023': 'Content Date',
  'x00080030': 'Study Time',
  'x00080031': 'Series Time',
  'x00080032': 'Acquisition Time',
  'x00080033': 'Content Time',
  'x00080050': 'Accession Number',
  'x00080060': 'Modality',
  'x00080064': 'Conversion Type',
  'x00080070': 'Manufacturer',
  'x00080080': 'Institution Name',
  'x00080081': 'Institution Address',
  'x00080090': 'Referring Physician Name',
  'x00081010': 'Station Name',
  'x00081030': 'Study Description',
  'x0008103e': 'Series Description',
  'x00081040': 'Institutional Department Name',
  'x00081050': 'Performing Physician Name',
  'x00081060': 'Name of Physician Reading Study',
  'x00081070': 'Operators Name',
  'x00081080': 'Admitting Diagnoses Description',
  'x00081090': 'Manufacturers Model Name',
  'x00100010': 'Patient Name',
  'x00100020': 'Patient ID',
  'x00100030': 'Patient Birth Date',
  'x00100040': 'Patient Sex',
  'x00100050': 'Patient Insurance Plan Code Sequence',
  'x00101010': 'Patient Age',
  'x00101020': 'Patient Size',
  'x00101030': 'Patient Weight',
  'x0018001': 'Contrast/Bolus Agent',
  'x00180015': 'Body Part Examined',
  'x00180050': 'Slice Thickness',
  'x00180060': 'KVP',
  'x00180088': 'Spacing Between Slices',
  'x00180090': 'Data Collection Diameter',
  'x001800a0': 'Data Collection Diameter',
  'x00181000': 'Device Serial Number',
  'x00181020': 'Software Version(s)',
  'x00181030': 'Protocol Name',
  'x00181040': 'Contrast/Bolus Route',
  'x00181041': 'Contrast/Bolus Volume',
  'x00181050': 'Spatial Resolution',
  'x00181060': 'Trigger Time',
  'x00181088': 'Heart Rate',
  'x00181090': 'Cardiac Number of Images',
  'x001810a0': 'Number of Phase Encoding Steps',
  'x00181100': 'Reconstruction Diameter',
  'x00181110': 'Distance Source to Detector',
  'x00181111': 'Distance Source to Patient',
  'x00181120': 'Gantry/Detector Tilt',
  'x00181130': 'Table Height',
  'x00181140': 'Rotation Direction',
  'x00181150': 'Exposure Time',
  'x00181151': 'X-Ray Tube Current',
  'x00181152': 'Exposure',
  'x00181160': 'Filter Type',
  'x00181170': 'Generator Power',
  'x00181190': 'Focal Spot(s)',
  'x001811a0': 'Anode Target Material',
  'x00181200': 'Date of Last Calibration',
  'x00181201': 'Time of Last Calibration',
  'x00181210': 'Convolution Kernel',
  'x00185100': 'Patient Position',
  'x0020000d': 'Study Instance UID',
  'x0020000e': 'Series Instance UID',
  'x00200010': 'Study ID',
  'x00200011': 'Series Number',
  'x00200012': 'Acquisition Number',
  'x00200013': 'Instance Number',
  'x00200020': 'Patient Orientation',
  'x00200032': 'Image Position (Patient)',
  'x00200037': 'Image Orientation (Patient)',
  'x00200052': 'Frame of Reference UID',
  'x00200060': 'Laterality',
  'x00201040': 'Position Reference Indicator',
  'x00201041': 'Slice Location',
  'x00280002': 'Samples per Pixel',
  'x00280004': 'Photometric Interpretation',
  'x00280006': 'Planar Configuration',
  'x00280008': 'Number of Frames',
  'x00280009': 'Frame Increment Pointer',
  'x00280010': 'Rows',
  'x00280011': 'Columns',
  'x00280030': 'Pixel Spacing',
  'x00280034': 'Pixel Aspect Ratio',
  'x00280100': 'Bits Allocated',
  'x00280101': 'Bits Stored',
  'x00280102': 'High Bit',
  'x00280103': 'Pixel Representation',
  'x00281040': 'Pixel Intensity Relationship',
  'x00281041': 'Pixel Intensity Relationship Sign',
  'x00281050': 'Window Center',
  'x00281051': 'Window Width',
  'x00281052': 'Rescale Intercept',
  'x00281053': 'Rescale Slope',
  'x00281054': 'Rescale Type',
  'x00281055': 'Window Center & Width Explanation',
  'x00321032': 'Requesting Physician',
  'x00321033': 'Requesting Service',
  'x00321060': 'Requested Procedure Description',
  'x00400002': 'Scheduled Procedure Step Start Date',
  'x00400003': 'Scheduled Procedure Step Start Time',
  'x00400006': 'Scheduled Performing Physician Name',
  'x00400007': 'Scheduled Procedure Step Description',
  'x00400009': 'Scheduled Procedure Step ID',
  'x00400010': 'Scheduled Station Name',
  'x00400011': 'Scheduled Procedure Step Location',
  'x00400012': 'Pre-Medication',
  'x00400020': 'Scheduled Procedure Step Status',
  'x00400244': 'Performed Procedure Step Start Date',
  'x00400245': 'Performed Procedure Step Start Time',
  'x00400253': 'Performed Procedure Step ID',
  'x00400254': 'Performed Procedure Step Description',
  'x00400275': 'Request Attributes Sequence',
  'x00880130': 'Storage Media File-set ID',
  'x00880140': 'Storage Media File-set UID'
};

// 공통 버튼 스타일 - 브라우저 간 통일된 디자인
const commonButtonStyle = {
  background: 'transparent',
  border: 'none',
  padding: '0',
  margin: '0',
  cursor: 'pointer',
  outline: 'none',
  WebkitAppearance: 'none' as const,
  MozAppearance: 'none' as const,
  appearance: 'none' as const,
  boxSizing: 'border-box' as const,
  fontFamily: 'inherit',
  fontSize: 'inherit',
  lineHeight: 'inherit'
};

export const DicomMetaModal: React.FC<DicomMetaModalProps> = ({ isOpen, onClose, dataSet, inline = false }) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [copiedTag, setCopiedTag] = React.useState<string | null>(null);
  
  // 번역 기능 추가
  const { currentLanguage } = useUIStore();
  const { t } = useTranslation(currentLanguage);
  const [searchError, setSearchError] = React.useState<string | null>(null);

  if (!isOpen) return null;

  // 스크롤바 스타일링을 위한 CSS (어두운 테마)
  const scrollContainerStyle = `
    .meta-tag-scroll-container {
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-width: thin;
      scrollbar-color: #4a5568 #2d3748;
    }
    .meta-tag-scroll-container::-webkit-scrollbar {
      width: 8px;
    }
    .meta-tag-scroll-container::-webkit-scrollbar-track {
      background: #2d3748;
      border-radius: 4px;
    }
    .meta-tag-scroll-container::-webkit-scrollbar-thumb {
      background: #4a5568;
      border-radius: 4px;
    }
    .meta-tag-scroll-container::-webkit-scrollbar-thumb:hover {
      background: #718096;
    }
  `;

  // DICOM 데이터셋에서 모든 태그 추출
  const extractDicomTags = (): DicomTag[] => {
    const tags: DicomTag[] = [];
    
    if (!dataSet || !dataSet.elements) {
      return tags;
    }

    Object.keys(dataSet.elements).forEach(tagKey => {
      const element = dataSet.elements[tagKey];
      
      try {
        let value = '';
        
        // 다양한 VR(Value Representation) 타입에 따른 값 추출
        if (element.vr === 'US' || element.vr === 'UL') {
          value = dataSet.uint16(tagKey)?.toString() || dataSet.uint32(tagKey)?.toString() || '';
        } else if (element.vr === 'FL' || element.vr === 'FD') {
          value = dataSet.float(tagKey)?.toString() || dataSet.double(tagKey)?.toString() || '';
        } else if (element.vr === 'SQ') {
          value = t('sequenceData');
        } else if (element.vr === 'OB' || element.vr === 'OW') {
          value = t('binaryData');
        } else {
          value = dataSet.string(tagKey) || '';
        }

        // 긴 값은 잘라서 표시
        if (value.length > 100) {
          value = value.substring(0, 100) + '...';
        }

        const tagName = dicomTagNames[tagKey] || 'Unknown Tag';
        
        tags.push({
          tag: tagKey.replace('x', '').toUpperCase(),
          vr: element.vr || 'UN',
          name: tagName,
          value: value || t('emptyValue')
        });
      } catch (error) {
        // 파싱 실패 시 기본값 사용
        tags.push({
          tag: tagKey.replace('x', '').toUpperCase(),
          vr: element.vr || 'UN',
          name: dicomTagNames[tagKey] || 'Unknown Tag',
          value: t('parsingFailed')
        });
      }
    });

    return tags.sort((a, b) => a.tag.localeCompare(b.tag));
  };

  const dicomTags = extractDicomTags();

  // 검색 입력 검증 및 처리
  const handleSearchChange = (value: string) => {
    setSearchError(null);
    
    // 입력 검증 수행
    const validation = validateAnnotationLabel(value, {
      maxLength: 100,
      minLength: 0,
      allowEmpty: true,
      sanitize: true,
      logAttempts: true
    });

    if (!validation.isValid) {
      setSearchError(`검색 입력 오류: ${validation.errors.join(', ')}`);
      return;
    }

    if (validation.warnings.length > 0) {
      console.warn('검색 입력 경고:', validation.warnings);
    }

    // 검증된 값으로 검색어 설정
    setSearchTerm(validation.sanitizedValue || value);
  };

  // 검색 필터링 (안전한 검색어 사용)
  const filteredTags = dicomTags.filter(tag =>
    tag.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tag.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tag.vr.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 클립보드에 복사
  const copyToClipboard = async (text: string, tagId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTag(tagId);
      setTimeout(() => setCopiedTag(null), 2000);
    } catch (error) {
      console.error('클립보드 복사 실패:', error);
    }
  };

  // inline 모드인 경우 컨테이너 없이 직접 렌더링
  const modalContent = (
    <>
      {/* 스크롤바 스타일 추가 */}
      <style>{scrollContainerStyle}</style>
      
      <div className="rounded-lg shadow-xl flex flex-col" style={{
        width: '100%',
        height: '100%',
        maxWidth: 'none',
        maxHeight: 'none',
        minWidth: inline ? 'auto' : '600px',
        minHeight: inline ? 'auto' : '500px',
        backgroundColor: '#222222',
        color: '#ffffff',
        padding: '40px'
      }}>
        {/* 모달 헤더 */}
        <div className="border-b" style={{ borderColor: '#374151', paddingBottom: '16px', marginBottom: '16px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText className="text-blue-400" size={24} />
            <h2 className="text-xl font-semibold text-white">{t('dicomMetaTags')}</h2>
            <span className="text-sm text-gray-300">({dicomTags.length} {t('tagsDisplayed')})</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full transition-colors"
            style={{
              ...commonButtonStyle,
              position: 'absolute',
              top: '0',
              right: '0',
              color: '#9ca3af',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#374151';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title={t('closeModal')}
          >
            <X size={20} />
          </button>
        </div>

        {/* 검색 바 */}
        <div className="border-b" style={{ borderColor: '#374151', paddingBottom: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Search className="text-gray-400" size={16} />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none px-3"
              style={{
                width: '300px',
                height: '36px',
                backgroundColor: '#374151',
                borderColor: searchError ? '#dc2626' : '#4b5563',
                color: '#ffffff'
              }}
            />
          </div>
          {searchError && (
            <p className="text-sm text-red-400 mt-2">
              {searchError}
            </p>
          )}
          <p className="text-sm text-gray-400 mt-2">
            {filteredTags.length} {t('tagsDisplayed')}
            {searchTerm && ` (${dicomTags.length} total)`}
          </p>
        </div>

        {/* 테이블 컨테이너 - 완벽한 스크롤 구현 */}
        <div 
          className="flex-1 meta-tag-scroll-container" 
          style={{
            height: 'calc(100% - 120px)', // 헤더와 검색바만 제외한 높이 계산
            minHeight: '200px' // 최소 높이 보장
          }}
        >
          <table className="w-full border-collapse">
            <thead className="sticky top-0" style={{ backgroundColor: '#1f2937' }}>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-b" style={{ borderColor: '#374151' }}>
                  {t('tagId')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-b" style={{ borderColor: '#374151' }}>
                  VR
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-b" style={{ borderColor: '#374151' }}>
                  {t('tagName')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-b" style={{ borderColor: '#374151' }}>
                  {t('value')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider border-b" style={{ borderColor: '#374151' }}>
                  {t('copy')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ divideColor: '#374151' }}>
              {filteredTags.map((tag, index) => (
                <tr key={tag.tag} style={{ 
                  backgroundColor: index % 2 === 0 ? '#2d3748' : '#374151',
                  borderBottomColor: '#4a5568'
                }}>
                  <td className="px-4 py-3 text-sm font-mono text-gray-200">
                    ({tag.tag.substring(0, 4)},{tag.tag.substring(4, 8)})
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-300">
                    {tag.vr}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-200">
                    {tag.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300 max-w-md">
                    <div className="break-words">{tag.value}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => copyToClipboard(`${tag.name}: ${tag.value}`, tag.tag)}
                      className={`rounded transition-colors ${
                        copiedTag === tag.tag ? 'text-green-400' : 'text-gray-400'
                      }`}
                      style={{
                        ...commonButtonStyle,
                        width: '24px',
                        height: '24px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#4a5568';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title={t('copyToClipboard')}
                    >
                      <Copy size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredTags.length === 0 && (
            <div className="text-center py-12">
              <FileText className="mx-auto text-gray-500 mb-4" size={48} />
              <p className="text-gray-400">
                {searchTerm ? t('noSearchResults') : t('noDicomTagInfo')}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  // inline 모드에서는 직접 콘텐츠만 반환, 일반 모드에서는 고정 위치 컨테이너로 감싸서 반환
  if (inline) {
    return modalContent;
  }

  return (
    <div className="fixed z-50" style={{
      // 기존 모달 모드 (사용하지 않음)
      left: '280px',
      top: '70px', 
      right: '0',
      bottom: '0',
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      {modalContent}
    </div>
  );
};