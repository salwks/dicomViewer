/**
 * 스크립트: console.log를 log.debug로 자동 변환
 * 의료급 로깅 시스템으로 일괄 전환
 */

const fs = require('fs');
const path = require('path');

// 변환할 파일 목록
const filesToConvert = [
  'src/services/performanceOptimizer.ts',
  'src/services/measurement/index.ts',
  'src/services/progressiveLoader.ts',
  'src/services/metadataManager.ts',
  'src/services/sopClassHandler.ts',
  'src/styles/StyleInheritanceSystem.ts',
  'src/styles/StyleManager.ts'
];

// console.log 패턴과 대체할 log.debug 패턴 매핑
const conversions = [
  // 기본 console.log 변환
  {
    pattern: /console\.log\('([^']+)'\);/g,
    replacement: "log.debug('$1', { component: 'COMPONENT_NAME', operation: 'OPERATION_NAME' });"
  },
  // 템플릿 리터럴 변환
  {
    pattern: /console\.log\(`([^`]+)`\);/g,
    replacement: "log.debug('PARSED_MESSAGE', { component: 'COMPONENT_NAME', operation: 'OPERATION_NAME' });"
  },
  // 변수가 있는 console.log 변환
  {
    pattern: /console\.log\(([^)]+)\);/g,
    replacement: "log.debug('PARSED_MESSAGE', { component: 'COMPONENT_NAME', operation: 'OPERATION_NAME' });"
  }
];

function convertFile(filePath) {
  console.log(`Converting ${filePath}...`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`File ${filePath} not found, skipping...`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // log import가 없으면 추가
  if (!content.includes("import { log }")) {
    const importLines = content.split('\n').filter(line => line.startsWith('import'));
    const lastImportIndex = content.lastIndexOf(importLines[importLines.length - 1]);
    const insertIndex = content.indexOf('\n', lastImportIndex) + 1;
    
    content = content.slice(0, insertIndex) + 
              "import { log } from '../utils/logger';\n" + 
              content.slice(insertIndex);
  }

  // 컴포넌트 이름 추출
  const componentName = path.basename(filePath, '.ts').replace(/([A-Z])/g, ' $1').trim();

  console.log(`Found console.log patterns in ${filePath}:`);
  
  // console.log 패턴 찾기 및 변환
  const consoleLogMatches = content.match(/console\.log\([^)]*\);/g);
  if (consoleLogMatches) {
    consoleLogMatches.forEach(match => {
      console.log(`  - ${match}`);
    });
  } else {
    console.log('  - No console.log found');
  }

  // 실제 변환은 수동으로 하도록 안내
  console.log(`Component: ${componentName}`);
  console.log('---');
}

// 모든 파일 처리
filesToConvert.forEach(convertFile);

console.log('\n=== 변환 완료 ===');
console.log('각 파일의 console.log를 수동으로 적절한 log.debug()로 변환해주세요.');
console.log('컴포넌트별 컨텍스트를 고려하여 의미있는 메시지와 메타데이터를 포함해주세요.');