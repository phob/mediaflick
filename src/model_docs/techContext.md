# Technologies
- Coravel for background job scheduling (replaced Hangfire)
- .NET Core for the backend
- Serilog for logging
- Entity Framework Core for data access
- TMDb API for media information

# Development Setup
- Coravel scheduler configured to run every minute
- Environment-specific configurations via options pattern
- Development-specific error details enabled

Technical Constraints:
- Log files are stored as JSON
- Logs are read in reverse chronological order
- Filtering capabilities:
  - By level (LogEventLevel)
  - By search term (case-insensitive)
  - By date range (from/to)
- Results are limited to prevent memory issues
- Error handling returns appropriate HTTP status codes
