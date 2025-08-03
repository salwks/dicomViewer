# Cornerstone3D v3.32.5 Migration Critical Issues - PRD

## 🚨 EMERGENCY: Breaking Changes Resolution

### Problem Statement
The upgrade from Cornerstone3D v1.77.9 to v3.32.5 has introduced critical breaking changes that are preventing core functionality from working properly. The application is currently in a non-functional state for key features.

## Critical Issues Identified

### 1. Annotation Selection & Deletion System Failure
**Status**: CRITICAL - Core functionality broken
- Annotation selection not working with new v3 API structure
- Delete functionality fails due to changed annotation UID property names
- Users cannot delete selected annotations (major workflow blocker)

### 2. API Structure Changes
**Status**: HIGH - Multiple components affected
- `annotationUID` property may have changed to `uid`, `id`, or `annotationId`
- Selection API responses have different object structures
- Event handling may have changed

### 3. Tool System Compatibility
**Status**: MEDIUM - Some tools may not work correctly
- StackScrollMouseWheelTool deprecated (FIXED)
- Other tools may have API changes not yet discovered
- Tool activation/deactivation may have different behavior

### 4. Rendering Engine Integration
**Status**: MEDIUM - Performance and display issues
- Viewport rendering calls may have changed
- Memory management integration needs verification
- Performance optimization may be affected

## Requirements

### Must Have (P0 - Critical)
1. **Annotation Selection Must Work**
   - Users must be able to click on annotations to select them
   - Selected annotations must be visually highlighted (sky blue)
   - Selection state must be properly tracked

2. **Annotation Deletion Must Work**  
   - Delete/Backspace keys must remove only selected annotations
   - No accidental deletion of non-selected annotations
   - Proper cleanup and viewport re-rendering

3. **Core Tool Functionality**
   - All measurement tools (Length, Angle, Rectangle ROI, etc.) must create annotations
   - All navigation tools (Pan, Zoom, Window/Level) must work
   - Tool switching must work without errors

### Should Have (P1 - High)
1. **API Compatibility Layer**
   - Graceful handling of v1 vs v3 API differences
   - Fallback mechanisms for changed property names
   - Error handling for deprecated methods

2. **Performance Optimization**
   - Memory management must work with v3
   - Rendering performance must be maintained
   - No memory leaks from API changes

### Could Have (P2 - Medium)
1. **Enhanced Error Handling**
   - Better error messages for API incompatibilities
   - Graceful degradation when features aren't available
   - Debug logging for troubleshooting

## Technical Specifications

### Annotation System Requirements
```typescript
// Must support both v1 and v3 annotation structures
interface AnnotationCompat {
  // v1 properties
  annotationUID?: string;
  
  // v3 possible properties
  uid?: string;
  id?: string;
  annotationId?: string;
  
  // Common properties
  metadata?: {
    toolName: string;
    viewPlaneNormal: number[];
    FrameOfReferenceUID: string;
  };
  
  data?: {
    handles: {
      points: number[][];
    };
  };
}
```

### Selection API Requirements
```typescript
// Must work with v3 selection API
annotation.selection.getAnnotationsSelected(): Annotation[]
annotation.selection.setAnnotationSelected(uid: string, selected: boolean, preserveSelected?: boolean): void
```

### Deletion API Requirements
```typescript
// Must work with v3 state API
annotation.state.removeAnnotation(uid: string): void
```

## Acceptance Criteria

### Critical Success Metrics
1. **Annotation Workflow Complete**
   - ✅ Create annotation with any tool
   - ✅ Click annotation to select (sky blue highlight)
   - ✅ Press Delete/Backspace to remove selected annotation
   - ✅ Viewport updates properly after deletion

2. **Multi-annotation Management**
   - ✅ Multiple annotations can exist
   - ✅ Only selected annotation is deleted
   - ✅ Non-selected annotations remain untouched

3. **Cross-platform Compatibility**
   - ✅ Works on Mac (Backspace key)
   - ✅ Works on Windows (Delete key)
   - ✅ Works in all major browsers

### Quality Metrics
- Zero console errors during normal annotation workflow
- No memory leaks during annotation operations
- Response time < 100ms for selection/deletion operations

## Implementation Strategy

### Phase 1: API Discovery & Compatibility (IMMEDIATE)
- Inspect actual v3 annotation object structures in runtime
- Create compatibility layer for property name differences
- Implement fallback mechanisms

### Phase 2: Core Functionality Restoration (URGENT)
- Fix annotation selection with correct v3 API calls
- Fix annotation deletion with correct UID handling
- Verify all tool operations work correctly

### Phase 3: Validation & Testing (HIGH)
- Test all annotation tools create proper v3 annotations
- Test selection/deletion workflow end-to-end
- Performance testing and optimization

### Phase 4: Error Handling & Polish (MEDIUM)
- Improve error messages and logging
- Add graceful degradation
- Code cleanup and documentation

## Risk Assessment

### High Risk
- **API Breaking Changes**: Unknown additional breaking changes may exist
- **Data Structure Changes**: Annotation data format changes could cause data loss
- **Performance Impact**: V3 may have different performance characteristics

### Medium Risk
- **Browser Compatibility**: V3 may have different browser requirements
- **Memory Usage**: New version may have different memory patterns

### Mitigation Strategies
- Incremental testing after each fix
- Comprehensive logging to identify issues quickly
- Rollback plan to v1.77.9 if critical issues cannot be resolved quickly

## Timeline

### Emergency Response (Next 2 hours)
- [ ] Complete API structure investigation
- [ ] Fix annotation selection system
- [ ] Fix annotation deletion system
- [ ] Basic functional testing

### Critical Stabilization (Next 4 hours)  
- [ ] Test all annotation tools
- [ ] Verify all navigation tools
- [ ] Performance validation
- [ ] Cross-browser testing

### Quality Assurance (Next 8 hours)
- [ ] Comprehensive testing
- [ ] Error handling improvements
- [ ] Documentation updates
- [ ] Deployment preparation

## Success Definition
The migration is considered successful when:
1. All annotation tools create annotations that can be selected and deleted
2. Selection workflow works: click → highlight → delete key → removed
3. No console errors during normal operations
4. Performance is equal to or better than v1.77.9 implementation
5. All existing features continue to work as expected

---

**Emergency Contact**: Development team must be available for immediate response to critical issues discovered during implementation.