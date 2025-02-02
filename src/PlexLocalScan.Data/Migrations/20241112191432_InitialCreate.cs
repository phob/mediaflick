using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PlexLocalScan.Data.Migrations;

/// <inheritdoc />
public partial class InitialCreate : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "ScannedFiles",
            columns: table => new
            {
                Id = table
                    .Column<int>(type: "INTEGER", nullable: false)
                    .Annotation("Sqlite:Autoincrement", true),
                SourceFile = table.Column<string>(type: "TEXT", nullable: false),
                DestFile = table.Column<string>(type: "TEXT", nullable: true),
                MediaType = table.Column<int>(type: "INTEGER", nullable: true),
                TmdbId = table.Column<int>(type: "INTEGER", nullable: true),
                Status = table.Column<string>(type: "TEXT", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
            },
            constraints: table => table.PrimaryKey("PK_ScannedFiles", x => x.Id)
        );

        migrationBuilder.CreateIndex(
            name: "IX_ScannedFiles_DestFile",
            table: "ScannedFiles",
            column: "DestFile",
            unique: true
        );

        migrationBuilder.CreateIndex(
            name: "IX_ScannedFiles_SourceFile",
            table: "ScannedFiles",
            column: "SourceFile",
            unique: true
        );
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropTable(name: "ScannedFiles");
}
