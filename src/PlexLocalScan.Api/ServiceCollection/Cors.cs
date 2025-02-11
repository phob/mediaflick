using Serilog;

namespace PlexLocalScan.Api.ServiceCollection;

public static class Cors
{
    public static IServiceCollection AddCorsPolicy(this IServiceCollection services)
    {
        var corsOrigins = Environment.GetEnvironmentVariable("CORS_ORIGINS")?.Split(',') ?? new[] { "http://localhost:3000" };
        
        Log.Information("Configuring CORS policy with origins: {@CorsOrigins}", corsOrigins);
        
        services.AddCors(options =>
            options.AddDefaultPolicy(policy =>
                policy
                    .WithOrigins(corsOrigins)
                    .AllowAnyMethod()
                    .AllowAnyHeader()
                    .AllowCredentials()
            )
        );

        return services;
    }
}
