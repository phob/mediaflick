#!/bin/bash

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run this script as root (use sudo)"
    exit 1
fi

# Create necessary directories
mkdir -p /opt/mediaflick/logs
mkdir -p /mnt/organized/{tvseries,movies}
mkdir -p /mnt/zurg/{tvseries,movies}

# Check if we should create test files
VERSION_FILE="/mnt/zurg/version.txt"
CREATE_TEST_FILES=false

if [ ! -f "$VERSION_FILE" ]; then
    echo "No version.txt found - will create test files"
    CREATE_TEST_FILES=true
elif grep -q "^mediaflick-demo" "$VERSION_FILE"; then
    echo "version.txt starts with 'mediaflick-demo' - will create test files"
    CREATE_TEST_FILES=true
else
    echo "version.txt exists but does not start with 'mediaflick-demo' - skipping test file creation"
fi

if [ "$CREATE_TEST_FILES" = true ]; then
    # Create test movie files (10 popular movies from 2024-2025)
    echo "Creating test movie files..."
    touch "/mnt/zurg/movies/Dune.Part.Two.2024.1080p.BluRay.x264.mkv"
    touch "/mnt/zurg/movies/Inside.Out.2.2024.1080p.WEB-DL.x265.mkv"
    touch "/mnt/zurg/movies/Wicked.2024.2160p.UHD.BluRay.x265.HDR.mkv"
    touch "/mnt/zurg/movies/Nosferatu.2024.1080p.BluRay.x264.mkv"
    touch "/mnt/zurg/movies/The.Brutalist.2024.1080p.WEB-DL.x264.mkv"
    touch "/mnt/zurg/movies/Anora.2024.1080p.BluRay.x265.mkv"
    touch "/mnt/zurg/movies/Civil.War.2024.1080p.WEB-DL.x264.mkv"
    touch "/mnt/zurg/movies/Challengers.2024.1080p.BluRay.x264.mkv"
    touch "/mnt/zurg/movies/Conclave.2024.1080p.WEB-DL.x265.mkv"
    touch "/mnt/zurg/movies/The.Substance.2024.1080p.BluRay.x264.mkv"

    # Create test TV series files (3 popular shows from 2024-2025)
    echo "Creating test TV series files..."

    # Fallout (2024) - Season 1
    mkdir -p "/mnt/zurg/tvseries/Fallout (2024)/Season 1"
    touch "/mnt/zurg/tvseries/Fallout (2024)/Season 1/Fallout.S01E01.1080p.WEB-DL.x265.mkv"
    touch "/mnt/zurg/tvseries/Fallout (2024)/Season 1/Fallout.S01E02.1080p.WEB-DL.x265.mkv"
    touch "/mnt/zurg/tvseries/Fallout (2024)/Season 1/Fallout.S01E03.1080p.WEB-DL.x265.mkv"
    touch "/mnt/zurg/tvseries/Fallout (2024)/Season 1/Fallout.S01E04.1080p.WEB-DL.x265.mkv"
    touch "/mnt/zurg/tvseries/Fallout (2024)/Season 1/Fallout.S01E05.1080p.WEB-DL.x265.mkv"

    # Reacher (2022) - Season 2
    mkdir -p "/mnt/zurg/tvseries/Reacher (2022)/Season 2"
    touch "/mnt/zurg/tvseries/Reacher (2022)/Season 2/Reacher.S02E01.1080p.WEB-DL.x264.mkv"
    touch "/mnt/zurg/tvseries/Reacher (2022)/Season 2/Reacher.S02E02.1080p.WEB-DL.x264.mkv"
    touch "/mnt/zurg/tvseries/Reacher (2022)/Season 2/Reacher.S02E03.1080p.WEB-DL.x264.mkv"
    touch "/mnt/zurg/tvseries/Reacher (2022)/Season 2/Reacher.S02E04.1080p.WEB-DL.x264.mkv"

    # Squid Game (2021) - Season 2
    mkdir -p "/mnt/zurg/tvseries/Squid Game (2021)/Season 2"
    touch "/mnt/zurg/tvseries/Squid Game (2021)/Season 2/Squid.Game.S02E01.1080p.WEB-DL.x265.mkv"
    touch "/mnt/zurg/tvseries/Squid Game (2021)/Season 2/Squid.Game.S02E02.1080p.WEB-DL.x265.mkv"
    touch "/mnt/zurg/tvseries/Squid Game (2021)/Season 2/Squid.Game.S02E03.1080p.WEB-DL.x265.mkv"

    # Create version file to mark this as demo setup
    echo "mediaflick-demo" > "$VERSION_FILE"

    echo "Test files created successfully!"
    echo "Movies: 10 files in /mnt/zurg/movies"
    echo "TV Series: 3 shows with multiple episodes in /mnt/zurg/tvseries"
    echo "Created version.txt with 'mediaflick-demo'"
fi

# Set ownership after all files are created
chown -R 1000:1000 /opt/mediaflick
chown -R 1000:1000 /mnt/organized
chown -R 1000:1000 /mnt/zurg

echo "Setup complete!"