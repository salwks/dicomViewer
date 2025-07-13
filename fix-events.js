const fs = require('fs');

function fixDispatchEvent(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Pattern to match dispatchEvent calls
    const pattern = /this\.dispatchEvent\(\{\s*type:\s*['"`]([^'"`]+)['"`],\s*detail:\s*([^}]+)\s*\}\);/g;
    
    content = content.replace(pattern, (match, eventType, detail) => {
        return `this.dispatchEvent(new CustomEvent('${eventType}', { detail: ${detail} }));`;
    });
    
    // Also fix removeAllEventListeners
    content = content.replace(/this\.removeAllEventListeners\(\);/g, 
        '// Event listeners cleanup (removeAllEventListeners not available)');
    
    fs.writeFileSync(filePath, content);
    console.log(`Fixed events in ${filePath}`);
}

// Fix the files
const filesToFix = [
    'src/core/imageLoadingManager.ts'
];

filesToFix.forEach(fixDispatchEvent);