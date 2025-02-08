#!/bin/bash

# Create necessary directories if they don't exist
sudo mkdir -p /opt/plex/config
sudo mkdir -p /opt/plex/transcode
sudo mkdir -p /opt/plex/media

# Set permissions
sudo chown -R $USER:$USER /opt/plex

# Get timezone from system
TIMEZONE=$(timedatectl | grep "Time zone" | awk '{print $3}')

# Run Plex Media Server
docker run \
  -d \
  --name plex \
  --network=host \
  -e TZ="$TIMEZONE" \
  -e PLEX_CLAIM="claim-REPLACE_WITH_YOUR_CLAIM_TOKEN" \
  -v /opt/plex/config:/config \
  -v /opt/plex/transcode:/transcode \
  -v /opt/plex/media:/data \
  --restart unless-stopped \
  plexinc/pms-docker 