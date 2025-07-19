using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace PlexLocalScan.Api.ServiceCollection;

public static class Cors
{
    public class CorsConfiguration { } // Category type for logger

    public static IServiceCollection AddCorsPolicy(this IServiceCollection services, IConfiguration configuration)
    {
        var corsOrigins = configuration.GetValue<string>("CORS_ORIGINS")?.Split(',') ?? ["http://localhost:3000"];
        
        // Get logger from service provider
        var serviceProvider = services.BuildServiceProvider();
        var logger = serviceProvider.GetRequiredService<ILogger<CorsConfiguration>>();
        
        logger.LogInformation("Configuring CORS policy with origins: {@CorsOrigins}", corsOrigins);
        
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
