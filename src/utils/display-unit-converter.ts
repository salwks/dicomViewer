import type { MeasurementUnit } from '../types';

/**
 * 간단한 표시 단위 변환 유틸리티
 * CornerstoneJS가 이미 mm 단위로 계산한 값을 화면 표시용으로만 변환
 */

/**
 * mm 값을 선택된 표시 단위로 변환
 * @param mmValue - CornerstoneJS에서 계산된 mm 값
 * @param displayUnit - 표시할 단위 ('mm' | 'inch')
 * @returns 변환된 값과 단위가 포함된 문자열
 */
export function convertMmToDisplayUnit(mmValue: number, displayUnit: MeasurementUnit): string {
  if (displayUnit === 'mm') {
    return `${mmValue.toFixed(2)} mm`;
  } else {
    // mm를 inch로 변환 (1 inch = 25.4 mm)
    const inchValue = mmValue / 25.4;
    return `${inchValue.toFixed(2)} inch`;
  }
}

/**
 * mm² 값을 선택된 표시 단위로 변환
 * @param mmSquaredValue - CornerstoneJS에서 계산된 mm² 값
 * @param displayUnit - 표시할 단위 ('mm' | 'inch')
 * @returns 변환된 면적값과 단위가 포함된 문자열
 */
export function convertMmSquaredToDisplayUnit(mmSquaredValue: number, displayUnit: MeasurementUnit): string {
  if (displayUnit === 'mm') {
    return `${mmSquaredValue.toFixed(2)} mm²`;
  } else {
    // mm²를 inch²로 변환 (1 inch² = 645.16 mm²)
    const inchSquaredValue = mmSquaredValue / 645.16;
    return `${inchSquaredValue.toFixed(3)} inch²`;
  }
}

/**
 * 각도 값 포맷팅 (단위 변환 불필요)
 * @param angleValue - 각도 값
 * @returns 포맷된 각도 문자열
 */
export function formatAngleValue(angleValue: number): string {
  return `${angleValue.toFixed(1)}°`;
}

/**
 * 주석 데이터에서 측정값을 추출하고 표시 단위로 변환 (픽셀 단위를 고려)
 * @param annotation - 주석 데이터
 * @param displayUnit - 표시할 단위
 * @param pixelSpacing - DICOM 픽셀 간격 (선택사항)
 * @returns 변환된 측정값 문자열 또는 null
 */
export function getMeasurementText(annotation: any, displayUnit: MeasurementUnit, pixelSpacing?: [number, number] | null): string | null {
  if (!annotation?.data?.cachedStats) {
    return null;
  }

  const stats = annotation.data.cachedStats;
  
  // CornerstoneJS는 imageId를 키로 하는 객체 구조 사용
  const imageId = Object.keys(stats)[0]; // 첫 번째 (그리고 보통 유일한) imageId
  const measurementData = stats[imageId];
  
  if (measurementData) {
    // Length 측정 (CornerstoneJS가 이미 mm로 계산함)
    if (measurementData.length !== undefined && measurementData.length > 0) {
      const mmValue = measurementData.length;
      return `${mmValue.toFixed(1)} mm`;
    }

    // Area 측정 (CornerstoneJS가 이미 mm²로 계산함)
    if (measurementData.area !== undefined && measurementData.area > 0) {
      const mmSquaredValue = measurementData.area;
      return `${mmSquaredValue.toFixed(1)} mm²`;
    }

    // Angle 측정 (도 단위, 변환 불필요)
    if (measurementData.angle !== undefined) {
      return `${measurementData.angle.toFixed(1)}°`;
    }

    // Mean, Standard Deviation 등 기타 통계값
    if (measurementData.mean !== undefined) {
      return `Mean: ${measurementData.mean.toFixed(2)}`;
    }
  }

  return null;
}