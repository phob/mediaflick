using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PlexLocalScan.Data.Migrations;

/// <inheritdoc />
public partial class AddPlexOptionsAndRelatedTables : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "MediaDetectionDbOptions",
            columns: table => new
            {
                Id = table.Column<int>(type: "INTEGER", nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                CacheDurationSeconds = table.Column<int>(type: "INTEGER", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_MediaDetectionDbOptions", x => x.Id));

        migrationBuilder.CreateTable(
            name: "PlexDbOptions",
            columns: table => new
            {
                Id = table.Column<int>(type: "INTEGER", nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                Host = table.Column<string>(type: "TEXT", nullable: false),
                Port = table.Column<int>(type: "INTEGER", nullable: false),
                PlexToken = table.Column<string>(type: "TEXT", nullable: false),
                PollingInterval = table.Column<int>(type: "INTEGER", nullable: false),
                ProcessNewFolderDelay = table.Column<int>(type: "INTEGER", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_PlexDbOptions", x => x.Id));

        migrationBuilder.CreateTable(
            name: "TmDbDbOptions",
            columns: table => new
            {
                Id = table.Column<int>(type: "INTEGER", nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                ApiKey = table.Column<string>(type: "TEXT", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_TmDbDbOptions", x => x.Id));

        migrationBuilder.CreateTable(
            name: "FolderDbMappings",
            columns: table => new
            {
                Id = table.Column<int>(type: "INTEGER", nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                LinkedPlexOptionsId = table.Column<int>(type: "INTEGER", nullable: false),
                SourceFolder = table.Column<string>(type: "TEXT", maxLength: 255, nullable: false),
                DestinationFolder = table.Column<string>(type: "TEXT", maxLength: 255, nullable: false),
                MediaType = table.Column<string>(type: "TEXT", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_FolderDbMappings", x => x.Id);
                table.ForeignKey(
                    name: "FK_FolderDbMappings_PlexDbOptions_LinkedPlexOptionsId",
                    column: x => x.LinkedPlexOptionsId,
                    principalTable: "PlexDbOptions",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_FolderDbMappings_LinkedPlexOptionsId",
            table: "FolderDbMappings",
            column: "LinkedPlexOptionsId");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "FolderDbMappings");

        migrationBuilder.DropTable(
            name: "MediaDetectionDbOptions");

        migrationBuilder.DropTable(
            name: "TmDbDbOptions");

        migrationBuilder.DropTable(
            name: "PlexDbOptions");
    }
}
