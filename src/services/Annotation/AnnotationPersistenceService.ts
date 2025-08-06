/**
 * AnnotationPersistenceService
 * 어댑터 패턴을 사용한 주석 저장/불러오기 서비스
 * 포맷에 독립적인 주석 데이터 관리
 */
import { log } from '../../utils/logger';
import { safePropertyAccess, safePropertySet } from '../../lib/utils';


import { Types } from '@cornerstonejs/tools';
import type { IAnnotationFormatAdapter } from './formatters/IAnnotationFormatAdapter';
import { JsonAdapter } from './formatters/JsonAdapter';
export interface AnnotationExportOptions {
  includeMetadata?: boolean
  filterByTool?: string[]
  filterByFrameOfReference?: string
  compact?: boolean
}

export interface AnnotationImportResult {
  annotations: Types.Annotation[]
  importedCount: number
  skippedCount: number
  warnings: string[]
}

export interface AnnotationFileInfo {
  filename: string
  format: string
  size: number
  timestamp: Date
  annotationCount: number
  statistics: {
    toolCounts: Record<string, number>
    frameOfReferences: string[]
  }
}

export class AnnotationPersistenceService {
  private formatAdapters: Map<string, IAnnotationFormatAdapter> = new Map();
  private defaultAdapter: IAnnotationFormatAdapter;

  constructor() {
    // 기본 JSON 어댑터 등록
    this.defaultAdapter = new JsonAdapter();
    this.registerAdapter(this.defaultAdapter);
  }

  /**
   * 포맷 어댑터 등록
   */
  public registerAdapter(adapter: IAnnotationFormatAdapter): void {
    const formatName = adapter.getFormatName().toLowerCase();
    this.formatAdapters.set(formatName, adapter);

    log.info(`주석 포맷 어댑터가 등록되었습니다: ${adapter.getFormatName()}`);
  }

  /**
   * 등록된 어댑터 목록 반환
   */
  public getRegisteredAdapters(): string[] {
    return Array.from(this.formatAdapters.keys());
  }

  /**
   * 파일 확장자로 적절한 어댑터 찾기
   */
  private getAdapterByExtension(filename: string): IAnnotationFormatAdapter {
    const extension = this.getFileExtension(filename);

    for (const adapter of this.formatAdapters.values()) {
      if (adapter.getSupportedExtensions().includes(extension)) {
        return adapter;
      }
    }

    // 기본 어댑터 반환
    return this.defaultAdapter;
  }

  /**
   * 포맷 이름으로 어댑터 가져오기
   */
  private getAdapterByFormat(formatName: string): IAnnotationFormatAdapter {
    const adapter = this.formatAdapters.get(formatName.toLowerCase());
    if (!adapter) {
      throw new Error(`지원하지 않는 포맷입니다: ${formatName}`);
    }
    return adapter;
  }

  /**
   * 파일로 주석 저장 (포맷 자동 감지)
   */
  public saveToFile(
    annotations: Types.Annotation[],
    filename: string,
    options: AnnotationExportOptions = {},
  ): string {
    const adapter = this.getAdapterByExtension(filename);
    return this.saveWithAdapter(annotations, adapter, options);
  }

  /**
   * 특정 포맷으로 주석 저장
   */
  public saveWithFormat(
    annotations: Types.Annotation[],
    formatName: string,
    options: AnnotationExportOptions = {},
  ): string {
    const adapter = this.getAdapterByFormat(formatName);
    return this.saveWithAdapter(annotations, adapter, options);
  }

  /**
   * 어댑터를 사용한 주석 저장 (핵심 로직)
   */
  private saveWithAdapter(
    annotations: Types.Annotation[],
    adapter: IAnnotationFormatAdapter,
    options: AnnotationExportOptions = {},
  ): string {
    try {
      // 필터링 적용
      let filteredAnnotations = [...annotations];

      if (options.filterByTool && options.filterByTool.length > 0) {
        filteredAnnotations = filteredAnnotations.filter(annotation =>
          annotation.metadata?.toolName && options.filterByTool!.includes(annotation.metadata.toolName),
        );
      }

      if (options.filterByFrameOfReference) {
        filteredAnnotations = filteredAnnotations.filter(annotation =>
          annotation.metadata?.FrameOfReferenceUID === options.filterByFrameOfReference,
        );
      }

      // 메타데이터 제외 옵션
      if (options.includeMetadata === false) {
        filteredAnnotations = filteredAnnotations.map(annotation => ({
          ...annotation,
          metadata: {
            toolName: annotation.metadata?.toolName ?? 'Unknown',
            FrameOfReferenceUID: annotation.metadata?.FrameOfReferenceUID ?? 'Unknown',
          },
        }));
      }

      // 데이터 변환을 어댑터에 위임
      const serializedData = adapter.serialize(filteredAnnotations);

      log.info(`${filteredAnnotations.length}개의 주석이 ${adapter.getFormatName()} 형식으로 저장되었습니다.`);

      return serializedData;
    } catch (error) {
      const errorMessage = `주석 저장 실패 (${adapter.getFormatName()}): ${error}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * 파일에서 주석 불러오기 (포맷 자동 감지)
   */
  public loadFromFile(fileContent: string, filename: string): AnnotationImportResult {
    const adapter = this.getAdapterByExtension(filename);
    return this.loadWithAdapter(fileContent, adapter);
  }

  /**
   * 특정 포맷으로 주석 불러오기
   */
  public loadWithFormat(fileContent: string, formatName: string): AnnotationImportResult {
    const adapter = this.getAdapterByFormat(formatName);
    return this.loadWithAdapter(fileContent, adapter);
  }

  /**
   * 어댑터를 사용한 주석 불러오기 (핵심 로직)
   */
  private loadWithAdapter(
    fileContent: string,
    adapter: IAnnotationFormatAdapter,
  ): AnnotationImportResult {
    const result: AnnotationImportResult = {
      annotations: [],
      importedCount: 0,
      skippedCount: 0,
      warnings: [],
    };

    try {
      // 데이터 유효성 검사
      if (!adapter.validateData(fileContent)) {
        throw new Error(`유효하지 않은 ${adapter.getFormatName()} 데이터입니다.`);
      }

      // 데이터 변환을 어댑터에 위임
      const annotations = adapter.deserialize(fileContent);

      result.annotations = annotations;
      result.importedCount = annotations.length;

      log.info(`${annotations.length}개의 주석이 ${adapter.getFormatName()} 형식에서 불러와졌습니다.`);

      return result;
    } catch (error) {
      const errorMessage = `주석 불러오기 실패 (${adapter.getFormatName()}): ${error}`;
      console.error(errorMessage);
      result.warnings.push(errorMessage);
      return result;
    }
  }

  /**
   * 주석 파일 정보 분석
   */
  public analyzeFile(fileContent: string, filename: string): AnnotationFileInfo {
    const adapter = this.getAdapterByExtension(filename);

    try {
      const annotations = adapter.deserialize(fileContent);
      const statistics = this.getAnnotationStatistics(annotations);

      return {
        filename,
        format: adapter.getFormatName(),
        size: new Blob([fileContent]).size,
        timestamp: new Date(),
        annotationCount: annotations.length,
        statistics,
      };
    } catch (error) {
      throw new Error(`파일 분석 실패: ${error}`);
    }
  }

  /**
   * 주석 통계 정보 생성
   */
  private getAnnotationStatistics(annotations: Types.Annotation[]): {
    toolCounts: Record<string, number>
    frameOfReferences: string[]
  } {
    const toolCounts: Record<string, number> = {};
    const frameOfReferences = new Set<string>();

    annotations.forEach(annotation => {
      // 도구별 카운트
      const toolName = annotation.metadata?.toolName ?? 'Unknown';
      const currentCount = safePropertyAccess(toolCounts, toolName) ?? 0;
      safePropertySet(toolCounts, toolName, currentCount + 1);

      // Frame of Reference 수집
      if (annotation.metadata?.FrameOfReferenceUID) {
        frameOfReferences.add(annotation.metadata.FrameOfReferenceUID);
      }
    });

    return {
      toolCounts,
      frameOfReferences: Array.from(frameOfReferences),
    };
  }

  /**
   * 파일 확장자 추출
   */
  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex > 0 ? filename.substring(lastDotIndex) : '';
  }

  /**
   * 지원하는 파일 형식 반환
   */
  public getSupportedFormats(): Array<{
    name: string
    extensions: string[]
  }> {
    return Array.from(this.formatAdapters.values()).map(adapter => ({
      name: adapter.getFormatName(),
      extensions: adapter.getSupportedExtensions(),
    }));
  }

  /**
   * 주석 데이터 병합
   */
  public mergeAnnotations(
    existing: Types.Annotation[],
    imported: Types.Annotation[],
  ): Types.Annotation[] {
    const existingUIDs = new Set(existing.map(ann => ann.annotationUID));

    // 중복 제거하며 병합
    const uniqueImported = imported.filter(ann => !existingUIDs.has(ann.annotationUID));

    log.info(`${uniqueImported.length}개의 새로운 주석이 병합되었습니다.`);

    return [...existing, ...uniqueImported];
  }

  /**
   * 주석 데이터 백업
   */
  public createBackup(annotations: Types.Annotation[]): string {
    const backup = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      annotations,
      metadata: {
        totalCount: annotations.length,
        createdBy: 'AnnotationPersistenceService',
      },
    };

    return JSON.stringify(backup, null, 2);
  }

  /**
   * 리소스 정리
   */
  public destroy(): void {
    this.formatAdapters.clear();
    log.info('AnnotationPersistenceService destroyed');
  }
}
