# Current Task
Migrating from Hangfire to Coravel for background job scheduling and optimizing the FilePollerService.

# Recent Changes
1. Replaced Hangfire with Coravel for background job scheduling
2. Optimized FilePollerService:
   - Implemented IInvocable interface
   - Split into smaller, focused methods
   - Removed unnecessary logging
   - Maintained core functionality
3. Configured Coravel scheduler in Middleware.cs
4. Updated DI registration in Application.cs

# Current State
- FilePollerService now uses Coravel for scheduling
- Service runs every minute via Coravel scheduler
- Logging reduced to essential messages only
- Core functionality maintained:
  - Folder monitoring
  - File processing
  - TMDb integration

# Next Steps
1. Consider adding health monitoring for the scheduler
2. Add metrics collection for file processing operations
3. Consider implementing retry policies for failed operations
4. Add configuration validation for TMDb API key
