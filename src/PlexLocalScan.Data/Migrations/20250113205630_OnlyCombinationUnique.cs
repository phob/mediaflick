using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PlexLocalScan.Data.Migrations;

/// <inheritdoc />
public partial class OnlyCombinationUnique : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(name: "IX_ScannedFiles_DestFile", table: "ScannedFiles");

        migrationBuilder.DropIndex(name: "IX_ScannedFiles_SourceFile", table: "ScannedFiles");

        migrationBuilder.CreateIndex(
            name: "IX_ScannedFiles_DestFile",
            table: "ScannedFiles",
            column: "DestFile"
        );

        migrationBuilder.CreateIndex(
            name: "IX_ScannedFiles_SourceFile",
            table: "ScannedFiles",
            column: "SourceFile"
        );
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(name: "IX_ScannedFiles_DestFile", table: "ScannedFiles");

        migrationBuilder.DropIndex(name: "IX_ScannedFiles_SourceFile", table: "ScannedFiles");

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
}
