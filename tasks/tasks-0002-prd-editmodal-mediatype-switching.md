# Task List: Fix EditModal MediaType Switching and Extras Conversion Flow

## Relevant Files

### Frontend Files
- `frontend/src/components/scanned-files-table/edit-modal.tsx` - Main EditModal component that needs MediaType switching fixes
- `frontend/src/components/scanned-files-table/index.tsx` - Parent component that manages conversion handlers and EditModal opening
- `frontend/src/hooks/use-toast.ts` - Toast notification hook for user feedback
- `frontend/src/components/ui/alert-dialog.tsx` - AlertDialog component for MediaType switch confirmation

### Notes
- No backend changes required - API already supports mediaType updates
- AlertDialog component already exists from previous implementation
- Toast hook already exists for notifications
- Focus is on fixing EditModal behavior and conversion flow

## Tasks

- [x] 1.0 Fix EditModal MediaType Dropdown to Switch UI Modes Instead of Filtering
  - [x] 1.1 Remove `selectedMediaType` from useEffect dependency array (line 82 in edit-modal.tsx)
  - [x] 1.2 Verify files are fetched only once on modal open, not when MediaType dropdown changes
  - [x] 1.3 Test that files remain visible in EditModal when switching between Movies/TV Shows

- [x] 2.0 Add Confirmation Dialog for MediaType Switch with Metadata Clearing
  - [x] 2.1 Add state `showMediaTypeWarning` and `pendingMediaType` to edit-modal.tsx
  - [x] 2.2 Import useToast hook and AlertDialog components
  - [x] 2.3 Modify `handleMediaTypeChange` to store pending type and show confirmation dialog
  - [x] 2.4 Create `handleConfirmMediaTypeChange` function to clear metadata and update type
  - [x] 2.5 Clear metadata: set tmdbId=0, seasonNumber/episodeNumber/episodeNumber2=undefined
  - [x] 2.6 Show toast notification: "Media type changed. All metadata has been cleared."
  - [x] 2.7 Add AlertDialog with title "Switch Media Type?" and warning message
  - [x] 2.8 Test that metadata clears correctly and toast appears

- [x] 3.0 Update Extras Conversion Handlers to Open EditModal
  - [x] 3.1 Modify `handleConvertToMovie` to set `initialMediaType` to Movies and open EditModal
  - [x] 3.2 Modify `handleConvertToTvShow` to set `initialMediaType` to TvShows and open EditModal
  - [x] 3.3 Remove AlertDialog logic from Movie/TV Show conversion handlers
  - [x] 3.4 Keep `handleConvertToExtras` with existing AlertDialog behavior (no changes)
  - [x] 3.5 Update `conversionDialog` state to only apply to Extras conversions
  - [x] 3.6 Test that clicking "Convert to Movie/TV Show" opens EditModal directly

- [x] 4.0 Update Save Logic to Include MediaType in API Calls
  - [x] 4.1 Modify `handleSaveEdits` to include `mediaType: row.mediaType` in updateScannedFile calls
  - [x] 4.2 Ensure EditModal passes correct mediaType from editableRows
  - [x] 4.3 Verify symlink recreation is triggered after save
  - [x] 4.4 Update success toast for conversions: "Converted {count} file(s) to {MediaType}"
  - [x] 4.5 Test that converted Extras progress from Processing to Success status

- [x] 5.0 Testing and Validation
  - [x] 5.1 Test: Convert single Extra to Movie via EditModal, assign TMDb ID, verify Success status
  - [x] 5.2 Test: Convert multiple Extras to TV Show, assign series and episodes, verify all succeed
  - [x] 5.3 Test: Switch MediaType in EditModal from Movie to TV Show, confirm warning appears
  - [x] 5.4 Test: Verify metadata is cleared after MediaType switch and toast notification shows
  - [x] 5.5 Test: Cancel EditModal during Extras conversion, verify files remain as Extras
  - [x] 5.6 Test: "Mark as Extra" button still shows AlertDialog (unchanged behavior)
  - [x] 5.7 Test: Multi-file editing with MediaType changes works correctly
  - [x] 5.8 Run frontend linting: `bun run lint` from frontend directory

---

## Implementation Progress

**Current Task:** Ready to begin
**Next Step:** Start with Task 1.0 - Fix EditModal MediaType Dropdown

Ready to start implementing? I'll begin with Task 1.1 when you give the go-ahead.
