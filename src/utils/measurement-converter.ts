import type { MeasurementUnit } from '../types';

/**
 * 픽셀 값을 실제 단위(mm 또는 inch)로 변환하는 유틸리티 함수
 * @param pixelValue - 픽셀 단위 값
 * @param pixelSpacing - DICOM 픽셀 간격 [row, column] (mm/pixel)
 * @param unit - 변환할 단위 ('mm' 또는 'inch')
 * @returns 변환된 값과 단위가 포함된 문자열
 */
export function convertPixelToUnit(
  pixelValue: number,
  pixelSpacing: [number, number] | null,
  unit: MeasurementUnit
): string {
  // 픽셀 간격이 없는 경우 픽셀 값 그대로 반환 (하지만 px는 표시하지 않음)
  if (!pixelSpacing || pixelSpacing[0] === 0 || pixelSpacing[1] === 0) {
    return `${pixelValue.toFixed(1)}`;
  }

  // 평균 픽셀 간격 사용 (일반적으로 row와 column 간격이 동일)
  const avgPixelSpacing = (pixelSpacing[0] + pixelSpacing[1]) / 2;
  
  // 픽셀을 mm로 변환
  const mmValue = pixelValue * avgPixelSpacing;
  
  if (unit === 'mm') {
    return `${mmValue.toFixed(1)} mm`;
  } else if (unit === 'inch') {
    // mm를 inch로 변환 (1 inch = 25.4 mm)
    const inchValue = mmValue / 25.4;
    return `${inchValue.toFixed(2)} inch`;
  }
  
  return `${pixelValue.toFixed(1)}`;
}

/**
 * 면적 값을 실제 단위로 변환
 * @param pixelArea - 픽셀^2 단위 면적
 * @param pixelSpacing - DICOM 픽셀 간격 [row, column] (mm/pixel)
 * @param unit - 변환할 단위 ('mm' 또는 'inch')
 * @returns 변환된 면적과 단위가 포함된 문자열
 */
export function convertPixelAreaToUnit(
  pixelArea: number,
  pixelSpacing: [number, number] | null,
  unit: MeasurementUnit
): string {
  if (!pixelSpacing || pixelSpacing[0] === 0 || pixelSpacing[1] === 0) {
    return `${pixelArea.toFixed(1)}`;
  }

  // 면적 변환 (픽셀 간격의 곱)
  const mmSquaredPerPixelSquared = pixelSpacing[0] * pixelSpacing[1];
  const mmSquaredValue = pixelArea * mmSquaredPerPixelSquared;
  
  if (unit === 'mm') {
    return `${mmSquaredValue.toFixed(1)} mm²`;
  } else if (unit === 'inch') {
    // mm²를 inch²로 변환 (1 inch² = 645.16 mm²)
    const inchSquaredValue = mmSquaredValue / 645.16;
    return `${inchSquaredValue.toFixed(3)} inch²`;
  }
  
  return `${pixelArea.toFixed(1)}`;
}

/**
 * 각도 값은 단위 변환이 필요하지 않음 (항상 도(degree))
 * @param angleValue - 각도 값
 * @returns 각도와 단위가 포함된 문자열
 */
export function formatAngle(angleValue: number): string {
  return `${angleValue.toFixed(1)}°`;
}

/**
 * DICOM 이미지에서 픽셀 간격 정보 추출
 * @param metadata - DICOM 메타데이터 또는 이미지 객체
 * @returns 픽셀 간격 배열 [row, column] 또는 null
 */
export function getPixelSpacingFromMetadata(metadata: any): [number, number] | null {
  // 다양한 방법으로 픽셀 간격 정보 추출 시도
  const pixelSpacing = metadata?.pixelSpacing || 
                      metadata?.PixelSpacing || 
                      metadata?.data?.pixelSpacing ||
                      metadata?.data?.PixelSpacing;
  
  if (pixelSpacing && Array.isArray(pixelSpacing) && pixelSpacing.length >= 2) {
    return [parseFloat(pixelSpacing[0]), parseFloat(pixelSpacing[1])];
  }
  
  // 개별 간격 정보 확인
  const rowSpacing = metadata?.rowPixelSpacing || metadata?.data?.rowPixelSpacing;
  const colSpacing = metadata?.columnPixelSpacing || metadata?.data?.columnPixelSpacing;
  
  if (rowSpacing && colSpacing) {
    return [parseFloat(rowSpacing), parseFloat(colSpacing)];
  }
  
  return null;
}