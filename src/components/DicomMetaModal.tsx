import React from 'react';
import { X, FileText, Copy, Search } from 'lucide-react';

interface DicomMetaModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataSet: any;
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

export const DicomMetaModal: React.FC<DicomMetaModalProps> = ({ isOpen, onClose, dataSet }) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [copiedTag, setCopiedTag] = React.useState<string | null>(null);

  if (!isOpen) return null;

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
          value = '[Sequence Data]';
        } else if (element.vr === 'OB' || element.vr === 'OW') {
          value = '[Binary Data]';
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
          value: value || '(empty)'
        });
      } catch (error) {
        // 파싱 실패 시 기본값 사용
        tags.push({
          tag: tagKey.replace('x', '').toUpperCase(),
          vr: element.vr || 'UN',
          name: dicomTagNames[tagKey] || 'Unknown Tag',
          value: '(parsing failed)'
        });
      }
    });

    return tags.sort((a, b) => a.tag.localeCompare(b.tag));
  };

  const dicomTags = extractDicomTags();

  // 검색 필터링
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-11/12 h-5/6 max-w-6xl flex flex-col">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FileText className="text-blue-600" size={24} />
            <div>
              <h2 className="text-xl font-semibold text-gray-800">DICOM Meta Tags</h2>
              <p className="text-sm text-gray-600">총 {dicomTags.length}개의 태그 정보</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            title="모달 닫기"
          >
            <X size={20} />
          </button>
        </div>

        {/* 검색 바 */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="태그 ID, 이름, 값으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {filteredTags.length}개의 태그가 표시됨 
            {searchTerm && ` (전체 ${dicomTags.length}개 중 검색 결과)`}
          </p>
        </div>

        {/* 테이블 컨테이너 */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Tag ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  VR
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Tag Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Value
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Copy
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTags.map((tag, index) => (
                <tr key={tag.tag} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">
                    ({tag.tag.substring(0, 4)},{tag.tag.substring(4, 8)})
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">
                    {tag.vr}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {tag.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-md">
                    <div className="break-words">{tag.value}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => copyToClipboard(`${tag.name}: ${tag.value}`, tag.tag)}
                      className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                        copiedTag === tag.tag ? 'text-green-600' : 'text-gray-400'
                      }`}
                      title="클립보드에 복사"
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
              <FileText className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-500">
                {searchTerm ? '검색 결과가 없습니다.' : 'DICOM 태그 정보가 없습니다.'}
              </p>
            </div>
          )}
        </div>

        {/* 모달 푸터 */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              DICOM 파일의 메타데이터 정보입니다. 
              <span className="font-medium">VR</span>은 Value Representation을 의미합니다.
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};