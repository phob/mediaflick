Architecture Patterns:
- Using controller-based approach for business logic
- Separation of concerns between routing and business logic
- Dependency injection for logging (using type-specific loggers)
- Using minimal API patterns with endpoint routing
- Error handling with try-catch blocks and proper logging
- Consistent use of async/await for I/O operations

File Organization:
/PlexLocalScan.Api/Logging/
  - LoggingController.cs (Business logic)
    - Handles log retrieval and filtering
    - Uses type-specific logger (ILogger<LoggingController>)
  - LoggingRouting.cs (API routing)
    - Defines API endpoints
    - Injects dependencies
    - Maps to controller methods

# Background Processing Pattern
- Moved from Hangfire to Coravel for simplicity
- Using IInvocable interface for scheduled tasks
- Scheduler configured in middleware
- Services registered as scoped for proper lifecycle management

# Error Handling
- Essential error logging maintained
- Operation cancellation handled gracefully
- API configuration validation in place

# Dependency Injection
- Services properly scoped
- Options pattern used for configuration
- FilePollerService registered with proper interface
