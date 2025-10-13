# Task List: Extras Categorization Feature

## Relevant Files

### Backend Files
- `backend/PlexLocalScan.Shared/Configuration/Options/MediaDetectionOptions.cs` - Add `AutoExtrasThresholdBytes` property for configurable size threshold
- `backend/PlexLocalScan.Api/ScannedFiles/Models/UpdateScannedFileRequest.cs` - Add `MediaType` property to support media type updates
- `backend/PlexLocalScan.Api/ScannedFiles/ScannedFilesController.cs` - Extend `UpdateScannedFile` endpoint to handle MediaType changes and trigger appropriate actions
- `backend/PlexLocalScan.Shared/Services/FileProcessing.cs` - Add auto-classification logic for small unmatched files
- `backend/PlexLocalScan.Shared/Symlinks/Services/SymlinkHandler.cs` - Add check to skip symlink creation for Extras
- `backend/PlexLocalScan.Api/Config/ConfigRouting.cs` - Ensure new MediaDetectionOptions property is exposed in config API
- `backend/PlexLocalScan.Shared/DbContext/Interfaces/IContextService.cs` - Verify interface for updating file status (if needed)

### Frontend Files
- `frontend/src/lib/api/types.ts` - Add `autoExtrasThresholdMb` field to `MediaDetectionConfig` and update `UpdateScannedFileRequest` interface
- `frontend/src/lib/api/endpoints.ts` - Update `updateScannedFile` API method to support MediaType parameter
- `frontend/src/components/settings/media-detection-config.tsx` - New component for Media Detection settings section
- `frontend/src/components/settings/settings-modal.tsx` - Import and add MediaDetectionConfig component
- `frontend/src/components/scanned-files-table/index.tsx` - Add action handlers for converting media types
- `frontend/src/components/scanned-files-table/row-mapper.tsx` - Update to conditionally hide TMDb columns for Extras
- `frontend/src/components/scanned-files-table/table-component.tsx` - Add action buttons/menu for media type conversion
- `frontend/src/components/ui/alert-dialog.tsx` - Use existing shadcn AlertDialog for confirmations

### Notes
- No database migration needed - `MediaType.Extras` already exists in schema
- Leverage existing services: `SymlinkHelper`, `IContextService`, `INotificationService`
- Follow existing code patterns for confirmation dialogs and toast notifications
- Unit conversions: Frontend handles MB ↔ bytes conversion
- Use shadcn/ui AlertDialog component for confirmations (already available)

## Tasks

- [x] 1.0 Backend: Add Configuration for Auto-Extras Threshold
  - [x] 1.1 Add `AutoExtrasThresholdBytes` property to `MediaDetectionOptions.cs` with default value of 104857600 (100 MB)
  - [x] 1.2 Verify `MediaDetectionOptions` is properly exposed in config API endpoints in `ConfigRouting.cs`
  - [x] 1.3 Add validation to ensure threshold is between 1 byte and 1 GB when config is saved

- [ ] 2.0 Backend: Extend Update API to Support MediaType Changes
  - [ ] 2.1 Add `MediaType?` property to `UpdateScannedFileRequest.cs`
  - [ ] 2.2 Extend `UpdateScannedFile` method in `ScannedFilesController.cs` to handle MediaType updates
  - [ ] 2.3 When changing TO Extras: Delete symlink (if exists), clear TMDb fields, set Status=Success
  - [ ] 2.4 When changing FROM Extras: Set Status=Processing, keep new MediaType, trigger re-detection
  - [ ] 2.5 Ensure SignalR notification is triggered via `INotificationService.NotifyFileUpdated()`
  - [ ] 2.6 Add helper method to delete symlink using existing file system operations

- [ ] 3.0 Backend: Implement Auto-Classification Logic for Extras
  - [ ] 3.1 Inject `IOptionsSnapshot<MediaDetectionOptions>` into `FileProcessing` constructor
  - [ ] 3.2 In `ProcessSingleFileAsync`, after `DetectMediaAsync` returns null, check file size
  - [ ] 3.3 If fileSize < `AutoExtrasThresholdBytes`, set MediaType=Extras and Status=Success
  - [ ] 3.4 Clear all TMDb-related fields for auto-classified Extras
  - [ ] 3.5 Skip calling `CreateSymlinksAsync` for Extras
  - [ ] 3.6 Ensure SignalR notification is sent for auto-classified Extras

- [ ] 4.0 Backend: Skip Symlink Creation for Extras
  - [ ] 4.1 In `SymlinkHandler.CreateSymlinksAsync`, add early return if `mediaInfo.MediaType == MediaType.Extras`
  - [ ] 4.2 Return `true` (success) without creating symlink for Extras
  - [ ] 4.3 Ensure no error is logged when skipping Extras

- [ ] 5.0 Frontend: Add Settings UI for Auto-Extras Threshold
  - [ ] 5.1 Add `autoExtrasThresholdMb?: number` to `MediaDetectionConfig` interface in `types.ts`
  - [ ] 5.2 Update `UpdateScannedFileRequest` interface to include `mediaType?: MediaType`
  - [ ] 5.3 Create `media-detection-config.tsx` component with number input for threshold (0-1024 MB)
  - [ ] 5.4 Add helper text: "Files smaller than this size that don't match Movies/TV Shows will be automatically marked as Extras. Set to 0 to disable."
  - [ ] 5.5 Implement MB ↔ bytes conversion (multiply by 1048576 when saving, divide when loading)
  - [ ] 5.6 Import and render `MediaDetectionConfig` component in `settings-modal.tsx`

- [ ] 6.0 Frontend: Add Media Type Conversion Actions in File Listing
  - [ ] 6.1 Update `updateScannedFile` in `endpoints.ts` to accept `mediaType` parameter
  - [ ] 6.2 Add action menu/buttons to `table-component.tsx` for each row
  - [ ] 6.3 Show "Mark as Extra" button for Movies/TvShows rows
  - [ ] 6.4 Show "Convert to Movie" and "Convert to TV Show" buttons for Extras rows
  - [ ] 6.5 Add confirmation dialog using shadcn AlertDialog when converting to/from Extra
  - [ ] 6.6 Implement handler in `index.tsx` to call API and refresh data on success
  - [ ] 6.7 Add toast notifications for success/error states
  - [ ] 6.8 Update `row-mapper.tsx` to conditionally hide/show TMDb columns based on MediaType

- [ ] 7.0 Testing and Validation
  - [ ] 7.1 Test backend: Auto-classification of files < 100 MB as Extras
  - [ ] 7.2 Test backend: Manual conversion from Movie/TvShow to Extra (symlink deleted, metadata cleared)
  - [ ] 7.3 Test backend: Manual conversion from Extra to Movie/TvShow (status set to Processing)
  - [ ] 7.4 Test backend: Symlink creation skipped for Extras
  - [ ] 7.5 Test backend: Configuration save/load with new threshold property
  - [ ] 7.6 Test frontend: Settings UI displays and saves threshold correctly
  - [ ] 7.7 Test frontend: Conversion buttons appear correctly based on MediaType
  - [ ] 7.8 Test frontend: Confirmation dialogs work properly
  - [ ] 7.9 Test frontend: Table updates after conversion actions
  - [ ] 7.10 Run backend tests: `dotnet test` from backend directory
  - [ ] 7.11 Run frontend linting: `bun run lint` from frontend directory

---

## Implementation Progress

**Current Task:** Ready to begin
**Next Step:** Start with Task 1.0 - Backend Configuration

Ready to start implementing? I'll begin with Task 1.1 when you give the go-ahead.
