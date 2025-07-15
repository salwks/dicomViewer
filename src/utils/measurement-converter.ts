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
  console.log(`🔄 convertPixelToUnit 호출: pixelValue=${pixelValue}, pixelSpacing=${pixelSpacing ? `[${pixelSpacing[0]}, ${pixelSpacing[1]}]` : 'null'}, unit=${unit}`);
  
  // 픽셀 간격이 없는 경우 픽셀 값 그대로 반환 (하지만 px는 표시하지 않음)
  if (!pixelSpacing || pixelSpacing[0] === 0 || pixelSpacing[1] === 0) {
    console.log(`⚠️ 픽셀 간격이 유효하지 않음, 픽셀 값 그대로 반환: ${pixelValue.toFixed(1)}`);
    return `${pixelValue.toFixed(1)}`;
  }

  // 평균 픽셀 간격 사용 (일반적으로 row와 column 간격이 동일)
  const avgPixelSpacing = (pixelSpacing[0] + pixelSpacing[1]) / 2;
  
  // 픽셀을 mm로 변환
  const mmValue = pixelValue * avgPixelSpacing;
  
  console.log(`📏 변환 계산: ${pixelValue} px × ${avgPixelSpacing} mm/px = ${mmValue} mm`);
  
  if (unit === 'mm') {
    const result = `${mmValue.toFixed(1)} mm`;
    console.log(`✅ mm 변환 결과: ${result}`);
    return result;
  } else if (unit === 'inch') {
    // mm를 inch로 변환 (1 inch = 25.4 mm)
    const inchValue = mmValue / 25.4;
    const result = `${inchValue.toFixed(2)} inch`;
    console.log(`✅ inch 변환 결과: ${result}`);
    return result;
  }
  
  console.log(`⚠️ 알 수 없는 단위, 픽셀 값 반환: ${pixelValue.toFixed(1)}`);
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
  console.log(`🔄 convertPixelAreaToUnit 호출: pixelArea=${pixelArea}, pixelSpacing=${pixelSpacing ? `[${pixelSpacing[0]}, ${pixelSpacing[1]}]` : 'null'}, unit=${unit}`);
  
  if (!pixelSpacing || pixelSpacing[0] === 0 || pixelSpacing[1] === 0) {
    console.log(`⚠️ 픽셀 간격이 유효하지 않음, 픽셀 값 그대로 반환: ${pixelArea.toFixed(1)}`);
    return `${pixelArea.toFixed(1)}`;
  }

  // 면적 변환 (픽셀 간격의 곱)
  const mmSquaredPerPixelSquared = pixelSpacing[0] * pixelSpacing[1];
  const mmSquaredValue = pixelArea * mmSquaredPerPixelSquared;
  
  console.log(`📏 면적 변환 계산: ${pixelArea} px² × ${mmSquaredPerPixelSquared} mm²/px² = ${mmSquaredValue} mm²`);
  
  if (unit === 'mm') {
    const result = `${mmSquaredValue.toFixed(1)} mm²`;
    console.log(`✅ mm² 변환 결과: ${result}`);
    return result;
  } else if (unit === 'inch') {
    // mm²를 inch²로 변환 (1 inch² = 645.16 mm²)
    const inchSquaredValue = mmSquaredValue / 645.16;
    const result = `${inchSquaredValue.toFixed(3)} inch²`;
    console.log(`✅ inch² 변환 결과: ${result}`);
    return result;
  }
  
  console.log(`⚠️ 알 수 없는 단위, 픽셀 값 반환: ${pixelArea.toFixed(1)}`);
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
 * DICOM 이미지에서 픽셀 간격 정보 추출 (개선된 버전)
 * @param metadata - DICOM 메타데이터 또는 이미지 객체
 * @returns 픽셀 간격 배열 [row, column] 또는 null
 */
export function getPixelSpacingFromMetadata(metadata: any): [number, number] | null {
  console.log('🔍 픽셀 간격 추출 시도, 메타데이터:', metadata);
  
  if (!metadata) {
    console.log('❌ 메타데이터가 null 또는 undefined');
    return null;
  }
  
  // 1. 다양한 경로에서 pixelSpacing 추출 시도
  const pixelSpacingPaths = [
    metadata.pixelSpacing,
    metadata.PixelSpacing,
    metadata.data?.pixelSpacing,
    metadata.data?.PixelSpacing,
    metadata.dataset?.PixelSpacing,
    metadata.metadata?.PixelSpacing,
    // CornerstoneJS 특정 경로들
    metadata.imageFrame?.pixelSpacing,
    metadata.imageFrame?.PixelSpacing,
    // DICOM 태그 직접 접근
    metadata['00280030'], // (0028,0030) Pixel Spacing
    metadata.data?.['00280030'],
    metadata.dataset?.['00280030']
  ];
  
  for (const pixelSpacing of pixelSpacingPaths) {
    if (pixelSpacing) {
      console.log('🔍 찾은 픽셀 간격 후보:', pixelSpacing);
      
      if (Array.isArray(pixelSpacing) && pixelSpacing.length >= 2) {
        const row = parseFloat(pixelSpacing[0]);
        const col = parseFloat(pixelSpacing[1]);
        if (!isNaN(row) && !isNaN(col) && row > 0 && col > 0) {
          console.log(`✅ 픽셀 간격 추출 성공: [${row}, ${col}]`);
          return [row, col];
        }
      }
      
      // 문자열 형태의 픽셀 간격 처리 (예: "0.5\\0.5")
      if (typeof pixelSpacing === 'string') {
        const parts = pixelSpacing.split('\\').map(s => parseFloat(s.trim()));
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] > 0 && parts[1] > 0) {
          console.log(`✅ 문자열에서 픽셀 간격 추출 성공: [${parts[0]}, ${parts[1]}]`);
          return [parts[0], parts[1]];
        }
      }
    }
  }
  
  // 2. 개별 간격 정보 확인
  const rowSpacingPaths = [
    metadata.rowPixelSpacing,
    metadata.data?.rowPixelSpacing,
    metadata.dataset?.rowPixelSpacing
  ];
  
  const colSpacingPaths = [
    metadata.columnPixelSpacing,
    metadata.data?.columnPixelSpacing,
    metadata.dataset?.columnPixelSpacing
  ];
  
  for (const rowSpacing of rowSpacingPaths) {
    for (const colSpacing of colSpacingPaths) {
      if (rowSpacing && colSpacing) {
        const row = parseFloat(rowSpacing);
        const col = parseFloat(colSpacing);
        if (!isNaN(row) && !isNaN(col) && row > 0 && col > 0) {
          console.log(`✅ 개별 간격에서 픽셀 간격 추출 성공: [${row}, ${col}]`);
          return [row, col];
        }
      }
    }
  }
  
  // 3. 기본값 사용 (일반적인 DICOM 픽셀 간격)
  console.log('⚠️ 픽셀 간격을 찾을 수 없음, 기본값 사용: [1.0, 1.0]');
  return [1.0, 1.0]; // 1mm/픽셀로 가정
}