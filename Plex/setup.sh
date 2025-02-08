#!/bin/bash

# Create necessary directories
sudo mkdir -p /opt/plex/{config,transcode,media}

# Set permissions
sudo chown -R $USER:$USER /opt/plex

# Export timezone for docker-compose
export TIMEZONE=$(timedatectl | grep "Time zone" | awk '{print $3}')

echo "Setup complete! You can now run: docker-compose up -d" 