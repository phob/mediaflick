﻿using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using PlexLocalScan.Abstractions;
using PlexLocalScan.Api.Models;
using PlexLocalScan.Api.ScannedFiles.Models;
using PlexLocalScan.Core.Tables;
using PlexLocalScan.Data.Data;
using PlexLocalScan.Shared.Configuration.Options;
using PlexLocalScan.Shared.Plex.Interfaces;
using PlexLocalScan.Shared.Symlinks.Interfaces;

namespace PlexLocalScan.Api.ScannedFiles;

internal static class ScannedFilesRouting
{
    private const string ScannedFilesBaseRoute = "api/scannedfiles";

    public static void MapScannedFilesEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup(ScannedFilesBaseRoute)
            .WithTags("Scanned Files")
            .WithOpenApi()
            .WithDescription("Manages scanned media files and their processing status");

        MapScannedFilesMainEndpoints(group);
        MapScannedFilesStatsEndpoints(group);
        MapScannedFilesUpdateEndpoints(group);
        MapScannedFilesDeleteEndpoints(group);
    }

    private static void MapScannedFilesMainEndpoints(RouteGroupBuilder group)
    {
        var getScannedFilesHandler = static async (
            [FromServices] PlexScanContext context,
            [FromServices] ILogger<Program> logger,
            [FromQuery] FileStatus? status = null,
            [FromQuery] int[]? ids = null,
            [FromQuery] MediaType? mediaType = null,
            [FromQuery] string? searchTerm = null,
            [FromQuery] string? sortBy = null,
            [FromQuery] string? sortOrder = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10
        ) =>
        {
            var filter = new ScannedFileFilter
            {
                Status = status,
                MediaType = mediaType,
                SearchTerm = searchTerm,
                SortBy = sortBy,
                SortOrder = sortOrder,
            };
            return await ScannedFilesController.GetScannedFiles(
                filter,
                ids,
                page,
                pageSize,
                context,
                logger
            );
        };

        group
            .MapGet("/", getScannedFilesHandler)
            .WithName("GetScannedFiles")
            .WithDescription(
                "Retrieves a paged list of scanned files with optional filtering and sorting"
            )
            .Produces<PagedResult<ScannedFileDto>>();

        group
            .MapGet(
                "{id:int}",
                static async (
                    int id,
                    [FromServices] PlexScanContext context,
                    [FromServices] ILogger<Program> logger
                ) => await ScannedFilesController.GetScannedFile(id, context, logger)
            )
            .WithName("GetScannedFile")
            .WithDescription("Retrieves a specific scanned file by its ID")
            .Produces<ScannedFileDto>()
            .Produces(StatusCodes.Status404NotFound);

        group
            .MapGet(
                "tmdb-ids-and-titles",
                static async (
                    [FromQuery] MediaType? mediaType,
                    [FromQuery] string? searchTerm,
                    [FromServices] PlexScanContext context = null!,
                    [FromServices] ILogger<Program> logger = null!
                ) =>
                {
                    var filter = new ScannedFileFilter
                    {
                        MediaType = mediaType,
                        SearchTerm = searchTerm,
                    };
                    return await ScannedFilesController.GetTmdbIdsAndTitles(
                        filter,
                        context,
                        logger
                    );
                }
            )
            .WithName("GetTmdbIdsAndTitles")
            .WithDescription("Retrieves a list of unique TMDb IDs and titles for scanned files")
            .Produces<IEnumerable<object>>();
    }

    private static void MapScannedFilesStatsEndpoints(RouteGroupBuilder group) =>
        group
            .MapGet(
                "stats",
                static async (
                    [FromServices] PlexScanContext context,
                    [FromServices] ILogger<Program> logger
                ) => await ScannedFilesController.GetStats(context, logger)
            )
            .WithName("GetScannedFilesStats")
            .WithDescription(
                "Retrieves statistics about scanned files, including counts by status and media type"
            )
            .Produces<ScannedFileStats>();

    private static void MapScannedFilesUpdateEndpoints(RouteGroupBuilder group)
    {
        group
            .MapPatch(
                "{id}",
                static async (
                    int id,
                    [FromBody] UpdateScannedFileRequest request,
                    [FromServices] PlexScanContext context,
                    [FromServices] ILogger<Program> logger
                ) => await ScannedFilesController.UpdateScannedFile(id, request, context, logger)
            )
            .WithName("UpdateScannedFile")
            .WithDescription(
                "Updates the TMDb ID, season number, and episode number for a scanned file"
            )
            .Produces<ScannedFile>()
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status400BadRequest);

        group
            .MapPatch(
                "{id}/recreate-symlink",
                static async (
                    int id,
                    [FromServices] PlexScanContext context,
                    [FromServices] ISymlinkRecreationService symlinkRecreationService,
                    [FromServices] ILogger<Program> logger
                ) =>
                    await ScannedFilesController.RecreateSymlink(
                        id,
                        context,
                        symlinkRecreationService,
                        logger
                    )
            )
            .WithName("RecreateSymlink")
            .WithDescription("Recreates the symlink for a scanned file")
            .Produces<ScannedFile>()
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status400BadRequest);

        group
            .MapPost(
                "recreate-symlinks",
                static async (
                    [FromServices] ISymlinkRecreationService symlinkRecreationService,
                    [FromServices] IOptionsSnapshot<PlexOptions> plexOptions,
                    [FromServices] IPlexHandler plexHandler,
                    [FromServices] ILogger<Program> logger
                ) => await ScannedFilesController.RecreateSymlinks(
                    symlinkRecreationService,
                    plexOptions,
                    plexHandler,
                    logger
                )
            )
            .WithName("RecreateAllSymlinks")
            .WithDescription("Recreates all symlinks")
            .Produces(StatusCodes.Status200OK);
    }

    private static void MapScannedFilesDeleteEndpoints(RouteGroupBuilder group) =>
        group
            .MapDelete(
                "batch",
                static async (
                    [FromBody] int[]? ids,
                    [FromServices] PlexScanContext context,
                    [FromServices] ICleanupHandler cleanupHandler,
                    [FromServices] IOptionsSnapshot<PlexOptions> plexOptions,
                    [FromServices] INotificationService notificationService,
                    [FromServices] ILogger<Program> logger
                ) =>
                    await ScannedFilesController.DeleteScannedFiles(
                        ids,
                        context,
                        cleanupHandler,
                        plexOptions,
                        notificationService,
                        logger
                    )
            )
            .WithName("DeleteScannedFiles")
            .WithDescription("Deletes multiple scanned files by their IDs")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest);
}
