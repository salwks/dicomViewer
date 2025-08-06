/**
 * JsonAdapter
 * JSON 형식으로 주석 데이터를 직렬화/역직렬화하는 어댑터
 * IAnnotationFormatAdapter 인터페이스 구현
 */

import { Types } from '@cornerstonejs/tools';
import type { IAnnotationFormatAdapter } from './IAnnotationFormatAdapter';

export class JsonAdapter implements IAnnotationFormatAdapter {
  /**
   * 주석 배열을 JSON 문자열로 직렬화
   */
  public serialize(annotations: Types.Annotation[]): string {
    try {
      return JSON.stringify(annotations, null, 2);
    } catch (error) {
      console.error('Failed to serialize annotations to JSON:', error);
      throw new Error('JSON 직렬화 실패');
    }
  }

  /**
   * JSON 문자열을 주석 배열로 역직렬화
   */
  public deserialize(data: string): Types.Annotation[] {
    // 기본적인 유효성 검사를 추가하여 안정성 확보
    try {
      const parsed = JSON.parse(data);

      if (Array.isArray(parsed)) {
        // 각 주석 객체의 기본 구조 검증
        const validatedAnnotations = parsed.filter(this.isValidAnnotation);

        if (validatedAnnotations.length !== parsed.length) {
          console.warn(`${parsed.length - validatedAnnotations.length}개의 유효하지 않은 주석이 제외되었습니다.`);
        }

        return validatedAnnotations as Types.Annotation[];
      }

      console.warn('JSON 데이터가 배열 형식이 아닙니다.');
      return [];
    } catch (error) {
      console.error('Invalid JSON data for annotations:', error);
      return [];
    }
  }

  /**
   * 포맷 어댑터 이름 반환
   */
  public getFormatName(): string {
    return 'JSON';
  }

  /**
   * 지원하는 파일 확장자 반환
   */
  public getSupportedExtensions(): string[] {
    return ['.json', '.ann'];
  }

  /**
   * JSON 데이터 유효성 검사
   */
  public validateData(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed);
    } catch {
      return false;
    }
  }

  /**
   * 주석 객체의 기본 구조 검증
   */
  private isValidAnnotation(obj: unknown): obj is Types.Annotation {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }

    const annotation = obj as Record<string, unknown>;

    // 필수 속성 검사
    const requiredFields = ['annotationUID', 'metadata'];
    for (const field of requiredFields) {
      if (!(field in annotation)) {
        console.warn(`주석 객체에 필수 필드 '${field}'가 없습니다.`);
        return false;
      }
    }

    // metadata 구조 검증
    if (typeof annotation['metadata'] !== 'object' || annotation['metadata'] === null) {
      console.warn('주석 메타데이터가 올바르지 않습니다.');
      return false;
    }

    const metadata = annotation['metadata'] as Record<string, unknown>;
    if (typeof metadata['toolName'] !== 'string') {
      console.warn('주석 메타데이터에 toolName이 없습니다.');
      return false;
    }

    return true;
  }

  /**
   * 주석 데이터 통계 정보 반환
   */
  public getStatistics(annotations: Types.Annotation[]): {
    totalCount: number
    toolCounts: Record<string, number>
    frameOfReferences: string[]
  } {
    const toolCounts: Record<string, number> = {};
    const frameOfReferences = new Set<string>();

    annotations.forEach(annotation => {
      // 도구별 카운트
      const toolName = annotation.metadata?.toolName ?? 'Unknown';
      // eslint-disable-next-line security/detect-object-injection -- Safe: toolName is string from annotation metadata
      toolCounts[toolName] = (
        // eslint-disable-next-line security/detect-object-injection -- Safe: toolName is string from annotation metadata
        toolCounts[toolName] ?? 0
      ) + 1;

      // Frame of Reference 수집
      if (annotation.metadata?.FrameOfReferenceUID) {
        frameOfReferences.add(annotation.metadata.FrameOfReferenceUID);
      }
    });

    return {
      totalCount: annotations.length,
      toolCounts,
      frameOfReferences: Array.from(frameOfReferences),
    };
  }

  /**
   * 주석 데이터 압축 (들여쓰기 제거)
   */
  public serializeCompact(annotations: Types.Annotation[]): string {
    try {
      return JSON.stringify(annotations);
    } catch (error) {
      console.error('Failed to serialize annotations to compact JSON:', error);
      throw new Error('JSON 압축 직렬화 실패');
    }
  }
}
