/**
 * IAnnotationFormatAdapter Interface
 * 어댑터 패턴을 구현하기 위한 주석 포맷 어댑터 인터페이스
 * 모든 포맷터(formatter)가 따라야 할 표준 규격(청사진)
 */

import { Types } from '@cornerstonejs/tools';

export interface IAnnotationFormatAdapter {
  /**
   * Cornerstone.js 주석 객체 배열을 파일로 저장할 문자열로 변환합니다.
   * @param annotations - 직렬화할 주석 객체의 배열.
   * @returns 파일 내용에 해당하는 문자열.
   */
  serialize(annotations: Types.Annotation[]): string

  /**
   * 파일에서 읽은 문자열 데이터를 Cornerstone.js 주석 객체 배열로 변환합니다.
   * @param data - 파일에서 읽은 문자열 데이터.
   * @returns 역직렬화된 주석 객체의 배열.
   */
  deserialize(data: string): Types.Annotation[]

  /**
   * 포맷 어댑터의 이름을 반환합니다.
   * @returns 포맷 어댑터의 식별자 이름.
   */
  getFormatName(): string

  /**
   * 지원하는 파일 확장자를 반환합니다.
   * @returns 파일 확장자 배열 (예: ['.json', '.ann']).
   */
  getSupportedExtensions(): string[]

  /**
   * 데이터 유효성 검사를 수행합니다.
   * @param data - 검증할 문자열 데이터.
   * @returns 유효한 데이터인지 여부.
   */
  validateData(data: string): boolean
}
