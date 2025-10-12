using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PlexLocalScan.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFileSizeAndHash : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FileHash",
                table: "ScannedFiles",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "FileSize",
                table: "ScannedFiles",
                type: "INTEGER",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FileHash",
                table: "ScannedFiles");

            migrationBuilder.DropColumn(
                name: "FileSize",
                table: "ScannedFiles");
        }
    }
}
