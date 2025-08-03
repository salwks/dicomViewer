# Comparison Mode Test Checklist

## Overview
This checklist helps verify that the Comparison Mode implementation is working correctly.

## Pre-Test Setup
- [ ] Run `npm run dev` to start the development server
- [ ] Open http://localhost:3001 in your browser
- [ ] Prepare at least 2 different DICOM series for testing

## Feature Testing

### 1. Mode Switching
- [ ] Basic mode displays single viewer
- [ ] Comparison mode shows split screen with two viewers
- [ ] Mode selector dropdown works correctly

### 2. Series Assignment
- [ ] First click on a series assigns it to Study A
- [ ] Second click on a different series assigns it to Study B
- [ ] Third click prompts to replace Study A or B
- [ ] Series badges (A/B) display correctly in the sidebar

### 3. DICOM Viewer Functionality
- [ ] Both viewers load and display DICOM images
- [ ] Each viewer has independent tool controls
- [ ] Window/Level adjustment works in each viewer
- [ ] Zoom tool works in each viewer
- [ ] Pan tool works in each viewer
- [ ] Measurement tools work in each viewer

### 4. Synchronization Features

#### Scroll Sync
- [ ] Enable "Sync Scroll" button
- [ ] Scrolling in Study A updates Study B
- [ ] Scrolling in Study B updates Study A
- [ ] Disable "Sync Scroll" stops synchronization

#### Zoom Sync
- [ ] Enable "Sync Zoom" button
- [ ] Zooming in Study A updates Study B
- [ ] Zooming in Study B updates Study A
- [ ] Panning while zoomed syncs between viewers
- [ ] Disable "Sync Zoom" stops synchronization

#### Window/Level Sync
- [ ] Enable "Sync Window/Level" button
- [ ] Adjusting brightness/contrast in Study A updates Study B
- [ ] Adjusting brightness/contrast in Study B updates Study A
- [ ] Disable "Sync Window/Level" stops synchronization

### 5. UI Elements
- [ ] Sync Status Badge displays correctly in header
- [ ] Sync buttons show ON/OFF states clearly
- [ ] "Clear All" button resets both viewers
- [ ] Comparison Mode Info displays when no series loaded

### 6. Performance
- [ ] No lag when synchronizing scroll
- [ ] No lag when synchronizing zoom/pan
- [ ] No lag when synchronizing window/level
- [ ] Memory usage remains stable during extended use

### 7. Edge Cases
- [ ] Loading series with different image counts works
- [ ] Switching between modes preserves loaded data
- [ ] Rapid toggling of sync options doesn't cause errors
- [ ] Loading the same series in both viewers works

## Known Limitations
- Synchronization has a small delay (by design)
- Some DICOM types may not support all synchronization features

## Test Results
Date: _______________
Tester: _____________
Browser: ____________
All tests passed: [ ] Yes [ ] No

Notes:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________