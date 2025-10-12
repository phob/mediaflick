using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PlexLocalScan.Data.Migrations;

/// <inheritdoc />
public partial class UniqueEpisode : Migration
{
    private static readonly string[] columns = ["SourceFile", "DestFile", "EpisodeNumber"];

    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateIndex(
            name: "IX_ScannedFiles_SourceFile_DestFile_EpisodeNumber",
            table: "ScannedFiles",
            columns: columns,
            unique: true
        );

        migrationBuilder.CreateIndex(
            name: "IX_ScannedFiles_TmdbId",
            table: "ScannedFiles",
            column: "TmdbId"
        );
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_ScannedFiles_SourceFile_DestFile_EpisodeNumber",
            table: "ScannedFiles"
        );

        migrationBuilder.DropIndex(name: "IX_ScannedFiles_TmdbId", table: "ScannedFiles");
    }
}
