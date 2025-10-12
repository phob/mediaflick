﻿using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PlexLocalScan.Data.Migrations;

/// <inheritdoc />
public partial class SeasonEpisode : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "EpisodeNumber",
            table: "ScannedFiles",
            type: "INTEGER",
            nullable: true
        );

        migrationBuilder.AddColumn<int>(
            name: "SeasonNumber",
            table: "ScannedFiles",
            type: "INTEGER",
            nullable: true
        );
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "EpisodeNumber", table: "ScannedFiles");

        migrationBuilder.DropColumn(name: "SeasonNumber", table: "ScannedFiles");
    }
}
