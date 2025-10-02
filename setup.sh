#!/bin/bash

# Create necessary directories
sudo mkdir -p /opt/mediaflick/logs
sudo mkdir -p /mnt/organized/{tvseries,movies}
sudo mkdir -p /mnt/zurg/{tvseries,movies}

chown -R 1000:1000 /opt/mediaflick
chown -R 1000:1000 /mnt/organized
chown -R 1000:1000 /mnt/zurg