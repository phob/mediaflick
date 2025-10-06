#!/bin/bash

# Check if script is running as root
if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run as root. Please use sudo."
    exit 1
fi

echo "Starting zurg disconnect test script..."

# Check if /mnt/zurg exists
if [ -d "/mnt/zurg" ]; then
    echo "Removing contents inside /mnt/zurg directory..."
    rm -rf /mnt/zurg/*
    if [ $? -eq 0 ]; then
        echo "Successfully removed contents inside /mnt/zurg"
    else
        echo "Failed to remove contents inside /mnt/zurg"
        exit 1
    fi
else
    echo "/mnt/zurg directory does not exist, creating it..."
    mkdir -p /mnt/zurg
    if [ $? -eq 0 ]; then
        echo "Successfully created /mnt/zurg"
    else
        echo "Failed to create /mnt/zurg"
        exit 1
    fi
fi

# Change ownership to 1000:1000
echo "Changing ownership of /mnt/zurg to 1000:1000..."
chown 1000:1000 /mnt/zurg
if [ $? -eq 0 ]; then
    echo "Successfully changed ownership to 1000:1000"
else
    echo "Failed to change ownership"
    exit 1
fi

# Verify the changes
echo "Verifying directory and ownership..."
ls -ld /mnt/zurg

echo "Zurg disconnect test script completed successfully!"