# PRD: Fix EditModal MediaType Switching and Extras Conversion Flow

## Introduction/Overview

This feature fixes two related issues with the EditModal and Extras conversion workflow:

1. **EditModal MediaType Dropdown Issue**: Currently, switching the MediaType dropdown in EditModal re-fetches files from the API with a filter, causing files to disappear. It should instead switch between editing UI modes while keeping the same files visible.

2. **Extras Conversion Issue**: When converting Extras to Movies/TV Shows, files get stuck in "Processing" status because no TMDb metadata is assigned. The conversion should open EditModal to allow metadata assignment.

**Problem Solved**: Users cannot effectively convert Extras to Movies/TV Shows because there's no way to assign TMDb metadata during conversion. Additionally, the EditModal's MediaType dropdown doesn't work as expected when users want to change a file's type.

**Goal**: Enable seamless conversion from Extras to Movies/TV Shows with immediate metadata assignment, and fix EditModal MediaType switching to clear metadata and change UI modes without losing files.

## Goals

1. Allow users to convert Extras to Movies/TV Shows via EditModal with metadata assignment
2. Fix EditModal MediaType dropdown to switch UI modes instead of filtering files
3. Show warning when switching MediaType to inform users metadata will be cleared
4. Provide visual feedback when metadata is cleared after MediaType switch
5. Ensure converted files don't get stuck in Processing status

## User Stories

1. **As a user**, I want to convert an Extra file to a Movie by clicking "Convert to Movie", immediately see the EditModal, search for the correct title, assign the TMDb ID, and save so the file processes correctly.

2. **As a user**, I want to convert multiple Extra files to a TV Show, assign them all to the same series, set season/episode numbers, and save so they all process as TV episodes.

3. **As a user**, I want to change a file's MediaType in the EditModal from Movie to TV Show, be warned that metadata will be cleared, confirm the change, and see the TV Show editing interface so I can assign new metadata.

4. **As a user**, I want to see a clear indication when metadata has been cleared after switching MediaType so I know I need to assign new metadata.

5. **As a user**, I want files to remain visible in EditModal when I switch MediaType so I don't lose my selection.

## Functional Requirements

### 1. EditModal: Fix MediaType Dropdown Behavior

1.1. Remove the API re-fetch when MediaType dropdown changes
   - Remove `selectedMediaType` from the useEffect dependency array (line 82 in edit-modal.tsx)
   - Files should only be fetched once when modal opens, not when dropdown changes

1.2. Modify `handleMediaTypeChange` to show confirmation dialog before switching:
   - Dialog title: "Switch Media Type?"
   - Dialog message: "Switching media type will clear all metadata (TMDb ID, season, episode numbers). This action cannot be undone. Continue?"
   - Actions: "Cancel" and "Continue"

1.3. On confirmation, clear metadata for all files in `editableRows`:
   - Set `tmdbId` to `0`
   - Set `seasonNumber` to `undefined`
   - Set `episodeNumber` to `undefined`
   - Set `episodeNumber2` to `undefined`
   - Update `mediaType` to the new selected type

1.4. Show visual indicator after metadata is cleared:
   - Display toast notification: "Media type changed. All metadata has been cleared."
   - OR show a banner at the top of the modal: "⚠️ Metadata cleared - please assign new TMDb information"

1.5. UI should switch between MovieEditTable and TvShowEditTable based on selected MediaType

1.6. Files should remain in the modal and visible after MediaType switch

### 2. Extras Conversion: Open EditModal Instead of AlertDialog

2.1. Modify "Convert to Movie" button behavior:
   - Remove AlertDialog confirmation
   - Open EditModal directly
   - Set `initialMediaType` to `MediaType.Movies`
   - Pass selected Extra files to EditModal

2.2. Modify "Convert to TV Show" button behavior:
   - Remove AlertDialog confirmation
   - Open EditModal directly
   - Set `initialMediaType` to `MediaType.TvShows`
   - Pass selected Extra files to EditModal

2.3. Keep "Mark as Extra" button with existing AlertDialog behavior (no changes)

### 3. Update Save Logic to Include MediaType Change

3.1. Modify `handleSaveEdits` in `index.tsx`:
   - When calling `mediaApi.updateScannedFile`, include `mediaType` in the request
   - Pass `mediaType: row.mediaType` from the editableRows
   - This ensures both MediaType change and TMDb metadata are updated together

3.2. After saving, trigger existing symlink recreation (`mediaApi.recreateAllSymlinks()`)

3.3. After successful save, refresh the table data and clear selection

### 4. User Feedback and State Management

4.1. Add state to track if EditModal was opened for Extras conversion:
   - This helps differentiate between editing existing files vs. converting Extras
   - Could add a banner: "Converting from Extras - please assign metadata"

4.2. When user cancels EditModal during Extras conversion:
   - Files remain as Extras (no MediaType change)
   - Selection is cleared
   - No API calls are made

4.3. Toast notifications:
   - Success: "Converted {count} file(s) to {MediaType} and assigned metadata"
   - Error: "Failed to convert files. Please try again."

## Non-Goals (Out of Scope)

1. Changing EditModal's overall UI/UX design
2. Adding new metadata fields beyond what exists
3. Bulk TMDb search across multiple files
4. Auto-detecting MediaType based on file properties
5. Undo/redo functionality for MediaType switches
6. Validation of season/episode number ranges
7. Integration with external metadata sources beyond TMDb

## Design Considerations

### UI/UX

**MediaType Switch Confirmation Dialog:**
```
┌─────────────────────────────────────┐
│ Switch Media Type?                  │
├─────────────────────────────────────┤
│ Switching media type will clear all │
│ metadata (TMDb ID, season, episode  │
│ numbers). This action cannot be     │
│ undone. Continue?                   │
│                                     │
│         [Cancel]  [Continue]        │
└─────────────────────────────────────┘
```

**Metadata Cleared Indicator (Toast):**
```
┌─────────────────────────────────────┐
│ ℹ️ Media type changed. All metadata │
│    has been cleared.                │
└─────────────────────────────────────┘
```

**Conversion Flow:**
- User clicks "Convert to Movie" → EditModal opens immediately
- No intermediate confirmation dialog
- Modal shows Movie editing interface with empty metadata
- User searches, assigns TMDb ID, clicks Save
- Files convert from Extras to Movies with metadata

### Technical Architecture

**State Flow for MediaType Switch:**
```
User changes dropdown
    ↓
Show confirmation dialog
    ↓
User clicks "Continue"
    ↓
Clear all metadata in editableRows
    ↓
Update selectedMediaType state
    ↓
UI switches to Movie/TV table
    ↓
Show toast notification
```

**State Flow for Extras Conversion:**
```
User selects Extras files
    ↓
User clicks "Convert to Movie/TV Show"
    ↓
EditModal opens with initialMediaType
    ↓
User assigns metadata
    ↓
User clicks Save
    ↓
API call: updateScannedFile with mediaType + TMDb data
    ↓
Backend changes MediaType, sets Processing status
    ↓
Backend re-detection triggered
    ↓
Symlinks created
    ↓
Status → Success
```

## Technical Considerations

### Frontend Changes

**File: `frontend/src/components/scanned-files-table/edit-modal.tsx`**
- Add state for MediaType switch confirmation dialog: `showMediaTypeWarning`
- Remove `selectedMediaType` from line 82 useEffect dependencies
- Add `handleConfirmMediaTypeChange` function to clear metadata
- Import and add AlertDialog component for MediaType switch warning
- Add toast hook for metadata cleared notification

**File: `frontend/src/components/scanned-files-table/index.tsx`**
- Remove AlertDialog for Movie/TV Show conversions (keep for Extras)
- Modify `handleConvertToMovie` and `handleConvertToTvShow` to call `setIsEditModalOpen(true)`
- Update `handleSaveEdits` to include `mediaType: editableRow.mediaType` in API calls
- Optionally add state to track "conversion mode" for additional UI hints

### Backend (No Changes Required)
- Backend already supports `mediaType` in `UpdateScannedFileRequest`
- Backend already handles MediaType changes correctly
- Backend already triggers re-detection when status → Processing
- No new endpoints or modifications needed

### Dependencies
- Existing: EditModal, AlertDialog, Toast hook, mediaApi
- New: None (use existing components)

## Success Metrics

1. **Conversion Success Rate**: > 95% of Extras conversions result in Success status (not stuck in Processing)
2. **User Completion Rate**: > 90% of users who click "Convert to Movie/TV Show" complete the metadata assignment
3. **MediaType Switch Usage**: Track how often users switch MediaType in EditModal
4. **Error Rate**: < 2% of metadata assignments fail
5. **User Feedback**: Positive reception to warning dialog and metadata clearing behavior

## Open Questions

1. Should there be a "quick convert" option that skips EditModal for users who want to batch-convert Extras and assign metadata later? (Out of scope for now)
2. Should the warning dialog remember user's choice ("Don't show this again")? (Probably not - it's an important warning)
3. Should there be a keyboard shortcut to switch MediaType in EditModal? (Nice to have, not critical)
4. Should the metadata cleared toast be dismissible or auto-dismiss? (Auto-dismiss after 3-5 seconds)

---

**Document Version**: 1.0  
**Created**: 2025-10-14  
**Target Implementation**: Frontend only (Next.js 15 + React 19)  
**Estimated Complexity**: Low-Medium (1-2 days)  
**Related PRD**: 0001-prd-extras-categorization.md
