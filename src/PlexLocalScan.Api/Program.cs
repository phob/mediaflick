using System.Reflection;
using PlexLocalScan.Data.Data;
using PlexLocalScan.Shared.Options;
using PlexLocalScan.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PlexLocalScan.Shared.Interfaces;
using Scalar.AspNetCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .WithOrigins("http://localhost:3000") // Frontend URL
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

// Configure YAML configuration
var configPath = Path.Combine(AppContext.BaseDirectory, "config", "config.yml");
Directory.CreateDirectory(Path.GetDirectoryName(configPath)!);

var configDir = Path.GetDirectoryName(configPath) 
    ?? throw new InvalidOperationException("Config directory path cannot be null");

builder.Configuration
    .SetBasePath(configDir)
    .AddYamlFile(Path.GetFileName(configPath), false)
    .AddEnvironmentVariables()
    .AddCommandLine(args);

// Configure Serilog
builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext()
    .Enrich.WithMachineName()
    .Enrich.WithThreadId());

var services = builder.Services;

// Add services to the container
services.AddControllers();
services.AddEndpointsApiExplorer();
services.AddSwaggerGen(c =>
{
    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    c.IncludeXmlComments(xmlPath);
});

// Reuse the same services from Console project
services.Configure<PlexOptions>(builder.Configuration.GetSection("Plex"))
    .Configure<TMDbOptions>(builder.Configuration.GetSection("TMDb"))
    .Configure<MediaDetectionOptions>(builder.Configuration.GetSection("MediaDetection"))
    .Configure<DatabaseOptions>(builder.Configuration.GetSection("Database"))
    .AddSingleton<IPlexHandler, PlexHandler>()
    .AddScoped<ISymlinkHandler, SymlinkHandler>()
    .AddScoped<ITMDbClientWrapper>(sp =>
    {
        var tmdbOptions = sp.GetRequiredService<IOptions<TMDbOptions>>();
        return new TMDbClientWrapper(tmdbOptions.Value.ApiKey);
    })
    .AddScoped<IMovieDetectionService, MovieDetectionService>()
    .AddScoped<ITvShowDetectionService, TvShowDetectionService>()
    .AddScoped<IMediaDetectionService, MediaDetectionService>()
    .AddScoped<IImdbUpdateService, ImdbUpdateService>()
    .AddScoped<IMediaLookupService, MediaLookupService>()
    .AddScoped<IDateTimeProvider, DateTimeProvider>()
    .AddScoped<IFileSystemService, FileSystemService>()
    .AddScoped<IFileTrackingService, FileTrackingService>()
    .AddHostedService<FileWatcherService>()
    .AddDbContext<PlexScanContext>((serviceProvider, options) =>
    {
        var databaseOptions = serviceProvider.GetRequiredService<IOptions<DatabaseOptions>>().Value;
        options.UseSqlite(databaseOptions.ConnectionString);
    })
    .AddHttpClient()
    .AddMemoryCache()
    .AddScoped<ICleanupHandler, CleanupHandler>()
    .AddScoped<ISymlinkRecreationService, SymlinkRecreationService>();

var app = builder.Build();

// Apply migrations on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<PlexScanContext>();
    db.Database.Migrate();
}

// Add exception handling middleware
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        context.Response.StatusCode = 500;
        context.Response.ContentType = "application/json";
        var error = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
        if (error != null)
        {
            var ex = error.Error;
            Log.Error(ex, "An unhandled exception occurred");
            await context.Response.WriteAsJsonAsync(new 
            { 
                error = "An internal server error occurred.",
                details = app.Environment.IsDevelopment() ? ex.Message : null
            });
        }
    });
});

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger(options =>
    {
        options.RouteTemplate = "/openapi/{documentName}.json";
    });

    app.MapScalarApiReference(options =>
    {
        options.Theme = ScalarTheme.Mars;
    });
}

app.UseRouting();

// Add CORS middleware
app.UseCors();

//app.UseHttpsRedirection();
//app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    // Replace the root path handler with a redirect
    app.MapGet("/", () => Results.Redirect("/scalar/v1"));
}

app.MapControllers();

try
{
    Log.Information("Starting PlexLocalScan API");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "API terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
