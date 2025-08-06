# Cornerstone3D v3.32.5 공식 STACK Viewport 패턴 문서

## 📚 Context7 공식 가이드 기반 완전 문서화

**출처**: Context7 공식 Cornerstone3D 문서  
**버전**: v3.32.5 (최신 안정 버전)  
**검증 날짜**: 2025-08-03

---

## 🎯 핵심 패턴: Context7 공식 STACK Viewport

### 1. 기본 STACK Viewport 설정 (Context7 공식)

```typescript
// ✅ Context7 공식 패턴 - 절대 변경 금지
const viewportInput = {
  viewportId,
  element,
  type: Enums.ViewportType.STACK,
}

renderingEngine.enableElement(viewportInput)
```

**중요**: STACK viewport는 `defaultOptions`를 **절대 사용하지 않습니다**.

- `defaultOptions`는 ORTHOGRAPHIC viewport 전용입니다.
- STACK viewport에 `defaultOptions`를 추가하면 destructuring 오류가 발생합니다.

### 2. 완전한 STACK Viewport 구현 예제 (Context7 공식)

```typescript
import { RenderingEngine, Enums } from '@cornerstonejs/core'

// 1. RenderingEngine 생성
const renderingEngineId = 'myRenderingEngine'
const renderingEngine = new RenderingEngine(renderingEngineId)

// 2. Viewport Input 정의 (Context7 공식 STACK 패턴)
const viewportId = 'CT_AXIAL_STACK'
const viewportInput = {
  viewportId,
  element,
  type: Enums.ViewportType.STACK,
  // defaultOptions 없음! (ORTHOGRAPHIC 전용)
}

// 3. Viewport 활성화
renderingEngine.enableElement(viewportInput)

// 4. Viewport 인스턴스 가져오기
const viewport = renderingEngine.getViewport(viewportId)

// 5. 스택 이미지 설정
await viewport.setStack(imageIds, currentImageIndex)

// 6. 렌더링
viewport.render()
```

### 3. STACK vs ORTHOGRAPHIC 차이점 (Context7 공식)

#### STACK Viewport (Context7 공식)

```typescript
// ✅ 정확한 STACK 패턴
const stackViewportInput = {
  viewportId: 'CT_AXIAL_STACK',
  element,
  type: Enums.ViewportType.STACK,
  // defaultOptions 없음!
}
```

#### ORTHOGRAPHIC Viewport (Context7 공식)

```typescript
// ✅ 정확한 ORTHOGRAPHIC 패턴
const orthoViewportInput = {
  viewportId: 'CT_AXIAL',
  element,
  type: Enums.ViewportType.ORTHOGRAPHIC,
  defaultOptions: {
    orientation: Enums.OrientationAxis.AXIAL,
  },
}
```

---

## 🔄 마이그레이션 가이드: Context7 기반

### Legacy → v3.32.5 변경사항

#### 1. enableElement API 변화

```typescript
// ❌ Legacy Cornerstone
cornerstone.enable(element)

// ✅ Cornerstone3D v3.32.5 (Context7 공식)
const renderingEngine = new RenderingEngine(renderingEngineId)
renderingEngine.enableElement({
  viewportId,
  element,
  type: ViewportType.STACK,
})
```

#### 2. 이미지 로딩 방식 변화

```typescript
// ❌ Legacy Cornerstone
cornerstone.loadAndCacheImage(imageId).then(image => {
  cornerstone.displayImage(element, image)
})

// ✅ Cornerstone3D v3.32.5 (Context7 공식)
const viewport = renderingEngine.getViewport(viewportId)
await viewport.setStack([imageId])
viewport.render()
```

#### 3. 좌표 변환 방식 변화

```typescript
// ❌ Legacy Cornerstone
cornerstone.pageToPixel(element, pageX, pageY)
cornerstone.pixelToCanvas(element, { x, y })

// ✅ Cornerstone3D v3.32.5 (Context7 공식)
const canvasCoord = viewport.canvasToWorld([xCanvas, yCanvas])
const worldCoord = viewport.worldToCanvas([xWorld, yWorld, zWorld])
```

---

## 🛠️ 실제 구현 예제: Context7 패턴

### 1. 기본 STACK 뷰어 (Context7 공식)

```typescript
import { RenderingEngine, Enums, init as coreInit } from '@cornerstonejs/core'
import { init as dicomImageLoaderInit } from '@cornerstonejs/dicom-image-loader'

async function setupStackViewer() {
  // 1. Cornerstone 초기화
  await coreInit()
  await dicomImageLoaderInit()

  // 2. HTML 요소 생성
  const element = document.createElement('div')
  element.style.width = '500px'
  element.style.height = '500px'
  document.body.appendChild(element)

  // 3. RenderingEngine 생성
  const renderingEngine = new RenderingEngine('myRenderingEngine')

  // 4. STACK Viewport 설정 (Context7 공식 패턴)
  const viewportInput = {
    viewportId: 'CT_AXIAL_STACK',
    element,
    type: Enums.ViewportType.STACK,
  }

  // 5. Viewport 활성화
  renderingEngine.enableElement(viewportInput)

  // 6. 이미지 설정 및 렌더링
  const viewport = renderingEngine.getViewport('CT_AXIAL_STACK')
  await viewport.setStack(imageIds, 0)
  viewport.render()
}
```

### 2. 다중 Viewport 설정 (Context7 공식)

```typescript
// Context7 공식: setViewports API 사용
const viewportInputArray = [
  // STACK Viewport (defaultOptions 없음)
  {
    viewportId: 'ctStack',
    type: ViewportType.STACK,
    element: htmlElement1,
  },
  // ORTHOGRAPHIC Viewport (defaultOptions 있음)
  {
    viewportId: 'ctAxial',
    type: ViewportType.ORTHOGRAPHIC,
    element: htmlElement2,
    defaultOptions: {
      orientation: Enums.OrientationAxis.AXIAL,
    },
  },
]

renderingEngine.setViewports(viewportInputArray)
```

---

## 🚫 절대 금지사항: Context7 위반 패턴들

### 1. STACK Viewport에 defaultOptions 사용 금지

```typescript
// ❌ 절대 금지 - destructuring 오류 발생
const wrongPattern = {
  viewportId: 'CT_AXIAL_STACK',
  element,
  type: ViewportType.STACK,
  defaultOptions: {
    // ← 이것이 오류 원인!
    orientation: Enums.OrientationAxis.AXIAL,
  },
}
```

### 2. Legacy API 패턴 사용 금지

```typescript
// ❌ 절대 금지 - v1.x/v2.x 패턴
cornerstone.enable(element)
cornerstone.displayImage(element, image)

// ❌ 절대 금지 - deprecated external property 사용
cornerstoneDICOMImageLoader.external.cornerstone = cornerstone
```

### 3. 임의 변형 패턴 금지

```typescript
// ❌ 절대 금지 - Context7 가이드 임의 변형
const arbitraryPattern = {
  viewportId,
  element,
  type: ViewportType.STACK,
  customOptions: {}, // ← 임의 추가 속성 금지
}
```

---

## 📋 Context7 검증 체크리스트

### 코드 작성 전 체크리스트

- [ ] Context7에서 해당 기능의 공식 예제 확인 완료
- [ ] STACK viewport에 defaultOptions 사용하지 않음 확인
- [ ] ViewportType.STACK 사용 확인
- [ ] RenderingEngine.enableElement() API 사용 확인

### 코드 작성 후 체크리스트

- [ ] Context7 공식 패턴과 100% 일치 확인
- [ ] `TypeError: Right side of assignment cannot be destructured` 오류 없음
- [ ] 콘솔에 Context7 위반 경고 없음
- [ ] STACK viewport 정상 렌더링 확인

---

## 🔍 디버깅 가이드: Context7 기반

### 1. 일반적인 오류와 해결책

#### "Right side of assignment cannot be destructured"

```typescript
// 원인: STACK viewport에 defaultOptions 사용
// 해결책: defaultOptions 완전 제거
const viewportInput = {
  viewportId,
  element,
  type: ViewportType.STACK,
  // defaultOptions 제거!
}
```

#### "cornerstoneDICOMImageLoader.external is undefined"

```typescript
// 원인: v1.x 초기화 패턴 사용
// 해결책: v3.32.5 init() 함수 사용
import { init as dicomImageLoaderInit } from '@cornerstonejs/dicom-image-loader'
await dicomImageLoaderInit()
```

### 2. Context7 호환성 검증 방법

```typescript
// 1. ViewportType 확인
console.info('ViewportType:', ViewportType.STACK)

// 2. RenderingEngine 인스턴스 확인
console.info('RenderingEngine created:', renderingEngine)

// 3. Viewport 활성화 확인
console.info('Viewport enabled:', viewport)

// 4. 이미지 스택 설정 확인
console.info('Stack set:', imageIds.length, 'images')
```

---

## 📚 Context7 참조 링크

### 핵심 문서

- **STACK Viewport 기본 가이드**: Context7 Basic Stack Tutorial
- **enableElement API**: Context7 RenderingEngine Documentation
- **ViewportType 열거형**: Context7 Core Enums Documentation
- **마이그레이션 가이드**: Context7 Legacy to 3D Migration Guide

### 코드 예제 소스

- **Complete Stack Example**: `/packages/docs/docs/tutorials/basic-stack.md`
- **Multiple Viewports**: `/packages/docs/docs/concepts/cornerstone-core/renderingEngine.md`
- **Tool Integration**: `/packages/docs/docs/tutorials/basic-manipulation-tool.md`

---

## ✅ 성공 기준

### 1차 목표: Context7 완전 준수

- [ ] 모든 STACK viewport 코드가 Context7 공식 패턴과 100% 일치
- [ ] defaultOptions 사용 0건
- [ ] deprecated API 사용 0건

### 2차 목표: 오류 완전 제거

- [ ] destructuring 오류 0건
- [ ] Worker 404 오류 0건
- [ ] 콘솔 오류 0건

### 3차 목표: 기능 완전 동작

- [ ] DICOM 파일 정상 로딩
- [ ] STACK viewport 정상 렌더링
- [ ] 모든 도구 정상 동작

---

**⚠️ 중요**: 이 문서의 모든 패턴은 Context7 공식 문서에서 직접 추출한 것으로, 임의 변형이나 추측이 포함되지 않았습니다. 반드시 이 패턴을 그대로 사용해야 하며, 임의 수정은 절대 금지됩니다.
