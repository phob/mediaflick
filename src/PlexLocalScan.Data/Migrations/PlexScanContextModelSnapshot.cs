﻿// <auto-generated />
using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using PlexLocalScan.Data.Data;

#nullable disable

namespace PlexLocalScan.Data.Migrations
{
    [DbContext(typeof(PlexScanContext))]
    partial class PlexScanContextModelSnapshot : ModelSnapshot
    {
        protected override void BuildModel(ModelBuilder modelBuilder)
        {
#pragma warning disable 612, 618
            modelBuilder.HasAnnotation("ProductVersion", "9.0.0");

            modelBuilder.Entity("PlexLocalScan.Core.Tables.ScannedFile", b =>
                {
                    b.Property<int>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("INTEGER");

                    b.Property<DateTime>("CreatedAt")
                        .HasColumnType("TEXT");

                    b.Property<string>("DestFile")
                        .HasColumnType("TEXT");

                    b.Property<int?>("EpisodeNumber")
                        .HasColumnType("INTEGER");

                    b.Property<string>("Genres")
                        .HasColumnType("TEXT");

                    b.Property<string>("ImdbId")
                        .HasColumnType("TEXT");

                    b.Property<string>("MediaType")
                        .HasColumnType("TEXT");

                    b.Property<int?>("SeasonNumber")
                        .HasColumnType("INTEGER");

                    b.Property<string>("SourceFile")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<string>("Status")
                        .IsRequired()
                        .HasColumnType("TEXT");

                    b.Property<string>("Title")
                        .HasColumnType("TEXT");

                    b.Property<int?>("TmdbId")
                        .HasColumnType("INTEGER");

                    b.Property<int>("UpdateToVersion")
                        .HasColumnType("INTEGER");

                    b.Property<DateTime?>("UpdatedAt")
                        .HasColumnType("TEXT");

                    b.Property<int>("VersionUpdated")
                        .HasColumnType("INTEGER");

                    b.Property<int?>("Year")
                        .HasColumnType("INTEGER");

                    b.HasKey("Id");

                    b.HasIndex("DestFile");

                    b.HasIndex("SourceFile");

                    b.HasIndex("TmdbId");

                    b.HasIndex("SourceFile", "DestFile", "EpisodeNumber")
                        .IsUnique();

                    b.ToTable("ScannedFiles");
                });
#pragma warning restore 612, 618
        }
    }
}
