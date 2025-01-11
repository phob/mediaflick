using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PlexLocalScan.Data.Migrations;

/// <inheritdoc />
public partial class AddGenreTitleYear : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "Genres",
            table: "ScannedFiles",
            type: "TEXT",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "Title",
            table: "ScannedFiles",
            type: "TEXT",
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "Year",
            table: "ScannedFiles",
            type: "INTEGER",
            nullable: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "Genres",
            table: "ScannedFiles");

        migrationBuilder.DropColumn(
            name: "Title",
            table: "ScannedFiles");

        migrationBuilder.DropColumn(
            name: "Year",
            table: "ScannedFiles");
    }
}
