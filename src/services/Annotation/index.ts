/**
 * Annotation Services
 * 어댑터 패턴이 적용된 주석 관리 서비스 모듈
 */

// 어댑터 인터페이스
export type { IAnnotationFormatAdapter } from './formatters/IAnnotationFormatAdapter';

// 포맷 어댑터들
export { JsonAdapter } from './formatters/JsonAdapter';
export { DicomSrAdapter } from './formatters/DicomSrAdapter';

// 주석 지속성 서비스
export {
  AnnotationPersistenceService,
  type AnnotationExportOptions,
  type AnnotationImportResult,
  type AnnotationFileInfo,
} from './AnnotationPersistenceService';
