# PRD: Extras Categorization Feature

## Introduction/Overview

This feature adds support for categorizing media files as "Extras" - supplemental content like trailers, behind-the-scenes footage, deleted scenes, featurettes, interviews, and samples. Extras are standalone files that are not associated with any specific movie or TV show. They bypass TMDb lookup, skip symlink creation, and are stored in the database with minimal metadata.

**Problem Solved**: Currently, all files are processed as either Movies or TV Shows, requiring TMDb lookup and symlink creation. Small supplemental files (< 100 MB) often fail matching or create unnecessary symlinks, cluttering the media library with non-primary content.

**Goal**: Provide a way to classify and manage supplemental media files separately from primary content, with automatic classification for small files and manual override capabilities.

## Goals

1. Enable automatic classification of unmatched files < 100 MB as "Extras"
2. Allow manual categorization of any file as an Extra from the file listing UI
3. Allow conversion of Extras back to Movies/TV Shows when needed
4. Skip TMDb lookup and symlink creation for files marked as Extras
5. Add configurable size threshold (up to 1 GB) in settings for auto-classification
6. Ensure Extras always have "Success" status and are visible in a dedicated section

## User Stories

1. **As a media organizer**, I want small unmatched files to be automatically classified as Extras so I don't have to manually review every trailer or sample file.

2. **As a user**, I want to manually mark any file as an Extra from the file listing so I can categorize supplemental content that doesn't match the automatic rules.

3. **As a user**, I want to convert an Extra back to a Movie or TV Show when I realize it was misclassified so I can correct categorization mistakes.

4. **As an administrator**, I want to configure the maximum file size for automatic Extra classification so I can tune the system to my library's needs.

5. **As a user**, I want to view all Extras in a dedicated section so I can quickly see all supplemental content in my library.

## Functional Requirements

### Backend Requirements

#### 1. Auto-Classification Logic
1.1. When a new file is scanned and cannot be matched to a Movie or TV Show via TMDb:
   - If file size < configured threshold (default 100 MB), set `MediaType = Extras`
   - Set `Status = Success`
   - Skip TMDb lookup and validation pipeline entirely
   - Clear all TMDb-related fields: `TmdbId`, `ImdbId`, `Title`, `Year`, `Genres`, `SeasonNumber`, `EpisodeNumber`, `EpisodeNumber2`
   - Keep: `SourceFile`, `FileSize`, `FileHash`, `CreatedAt`, `UpdatedAt`

1.2. Extras should trigger SignalR notifications (`OnFileAdded`, `OnFileUpdated`, `OnFileRemoved`) like other media types

#### 2. Configuration - Size Threshold
2.1. Add new property to `MediaDetectionOptions.cs`:
   - `AutoExtrasThresholdBytes` (long, default: 100 * 1024 * 1024 = 104,857,600 bytes)
   - Maximum value: 1 GB (1,073,741,824 bytes)

2.2. Expose in configuration API endpoint (`/api/config`)

2.3. Validate threshold on save: must be between 1 byte and 1 GB

#### 3. Manual Categorization API
3.1. Extend existing `PUT /api/scannedfiles/{id}` endpoint to support `MediaType` updates:
   - Allow changing `MediaType` to/from `Extras`
   - When changing TO `Extras`:
     - Delete existing symlink if present (use existing `SymlinkHelper`)
     - Clear TMDb-related fields: `TmdbId`, `ImdbId`, `Title`, `Year`, `Genres`, `SeasonNumber`, `EpisodeNumber`, `EpisodeNumber2`
     - Set `Status = Success`
   - When changing FROM `Extras` to Movie/TvShow:
     - Keep new `MediaType`
     - Set `Status = Processing`
     - Trigger re-processing through existing detection pipeline
     - Attempt auto-match to TMDb, then allow manual metadata entry if auto-match fails

3.2. Return updated `ScannedFile` in response

3.3. Trigger SignalR notification `OnFileUpdated` after successful update

#### 4. Symlink Creation Logic
4.1. Modify symlink creation service to skip Extras:
   - In `SymlinkService`, check if `MediaType == Extras` before creating symlinks
   - Return early without error if file is an Extra

#### 5. File Processing Pipeline
5.1. Modify `FileProcessing` service:
   - After regex parsing fails to match Movie/TV Show patterns, check file size
   - If size < `AutoExtrasThresholdBytes`, set as Extra and skip TMDb lookup
   - Set `Status = Success` immediately for Extras

### Frontend Requirements

#### 6. File Listing - Mark as Extra Button
6.1. In `ScannedFilesTable` component, add action button for each row:
   - Show "Mark as Extra" button for Movies/TvShows
   - Show "Convert to Movie" and "Convert to TV Show" buttons for Extras
   - Button should be accessible in row actions dropdown/menu

6.2. On click:
   - Show confirmation dialog: "Mark this file as an Extra? This will remove TMDb metadata and delete any existing symlinks."
   - On confirm, call `PUT /api/scannedfiles/{id}` with `MediaType` update
   - Show loading state during API call
   - Refresh table row on success
   - Show error toast on failure

#### 7. Settings Modal - Auto-Classification Threshold
7.1. Create new section in settings modal: "Media Detection"
   - Add number input field: "Auto-classify files as Extras (MB)"
   - Default: 100 MB
   - Min: 0 (disabled)
   - Max: 1024 (1 GB)
   - Helper text: "Files smaller than this size that don't match Movies/TV Shows will be automatically marked as Extras. Set to 0 to disable."

7.2. Add field to `MediaDetectionConfig` type in `types.ts`:
   - `autoExtrasThresholdMb?: number`

7.3. Convert MB to bytes when saving to API, and bytes to MB when loading from API

#### 8. Extras Section
8.1. Extras should be viewable in existing Media Library page using MediaType filter
   - MediaType dropdown already includes "Extras" option
   - Ensure Extras can be filtered, searched, and paginated like other types

8.2. For Extras rows in table:
   - Show file path, size, status, created/updated dates
   - Hide/disable TMDb-related columns (Title, Year, Genres, Episode info)
   - Show "Convert to Movie" and "Convert to TV Show" action buttons

## Non-Goals (Out of Scope)

1. Associating Extras with specific Movies or TV Shows (Extras are standalone)
2. Auto-detecting Extra types (trailer vs. behind-the-scenes, etc.)
3. Renaming or organizing Extras files
4. Creating symlinks for Extras
5. Advanced filtering/categorization of Extras beyond MediaType
6. Excluding Extras from dashboard statistics (future consideration)
7. Bulk operations for converting multiple files to/from Extras (can be added later)
8. Auto-downloading metadata for Extras from external sources

## Design Considerations

### UI/UX
- **File Listing Actions**: Use dropdown menu for row actions to avoid cluttering the table with multiple buttons
- **Confirmation Dialog**: Always confirm destructive actions (marking as Extra deletes symlinks and metadata)
- **Toast Notifications**: Provide clear feedback on success/failure of categorization changes
- **Settings UI**: Place threshold setting in a new "Media Detection" section within settings modal
- **Table Columns**: Conditionally hide TMDb-related columns when viewing Extras to reduce visual noise

### Backend Architecture
- **Minimal Changes**: Leverage existing `MediaType` enum (already has `Extras` value)
- **Pipeline Integration**: Insert auto-classification check in existing file processing flow, after regex parsing
- **Symlink Safety**: Use existing `SymlinkHelper` to safely delete symlinks when converting to Extra
- **Status Management**: Extras always have `Success` status; converting from Extra sets `Processing` to trigger re-detection

## Technical Considerations

### Backend
- **Database Migration**: NOT required - `MediaType.Extras` already exists in schema
- **Configuration Schema**: Update `MediaDetectionOptions` and ensure it's included in config API response/request
- **File Size Check**: Use existing `FileSize` property on `ScannedFile` entity
- **Symlink Deletion**: Call existing `SymlinkHelper.DeleteSymlink()` when converting to Extra
- **Pipeline Flow**: Modify `FileProcessingService` to check size threshold before attempting TMDb lookup
- **SignalR Events**: Ensure `NotificationService` is called for all Extra operations

### Frontend
- **API Types**: Update `MediaDetectionConfig` interface in `types.ts`
- **Table Component**: Modify `ScannedFilesTable` to add action buttons conditionally based on `MediaType`
- **Settings Component**: Create new child component `MediaDetectionConfig.tsx` for settings section
- **State Management**: Use React Query for mutations and optimistic updates
- **Unit Conversion**: Handle MB ↔ bytes conversion in frontend before API calls

### Dependencies
- Existing: `SymlinkHelper`, `FileProcessing`, `MediaDetectionService`, `NotificationService`
- New: None (use existing services)

## Success Metrics

1. **Auto-Classification Rate**: Percentage of files < threshold automatically marked as Extras (target: > 90% of small files)
2. **Manual Corrections**: Number of manual conversions from Extra to Movie/TV Show (target: < 10% of auto-classified Extras)
3. **Processing Time**: Reduction in average processing time for files marked as Extras (target: > 50% faster due to skipping TMDb lookup)
4. **User Actions**: Frequency of manual "Mark as Extra" usage (tracks feature adoption)
5. **Error Rate**: Percentage of Extras that fail to save (target: < 1%)

## Open Questions

1. Should there be a bulk action to convert multiple files to Extras at once? (Deferred to future)
2. Should Extras be excluded from dashboard statistics by default? (Deferred - noted as non-goal)
3. Should there be an option to auto-delete Extras after a certain period? (Out of scope)
4. Should the system detect specific Extra types (trailer, featurette, etc.) based on filename patterns? (Deferred to future)
5. Should Extras support manual Title/metadata without TMDb lookup? (Out of scope - keep minimal)

---

**Document Version**: 1.0  
**Created**: 2025-10-13  
**Target Implementation**: Backend (.NET 9) + Frontend (Next.js 15)  
**Estimated Complexity**: Medium (3-5 days)
