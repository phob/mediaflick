#!/bin/bash

# Create necessary directories
sudo mkdir -p /opt/plex/{config,transcode,media}
sudo mkdir -p /mnt/organized/{tvseries,movies}
sudo mkdir -p /mnt/zurg/{tvseries,movies}

# Set permissions
sudo chown -R $USER:$USER /opt/plex
sudo chown -R $USER:$USER /mnt/organized
sudo chown -R $USER:$USER /mnt/zurg
# Export timezone for docker-compose
export TIMEZONE=$(timedatectl | grep "Time zone" | awk '{print $3}')

echo "Setup complete! You can now run: docker-compose up -d" 