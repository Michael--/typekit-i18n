#!/bin/bash
# A script to create git bundle backups of all repositories in /Volumes/Data/repos
# and store them in iCloud Drive.
# Adjust paths as necessary.

# Exit on error
set -e
for repo in /Volumes/Data/repos/*.git; do 
  timestamp=$(date +%Y%m%d-%H%M%S) 
  name=$(basename "$repo" .git); 
  git -C "$repo" bundle create "/Users/m.rieck/Library/Mobile Documents/com~apple~CloudDocs/repos/${name}-${timestamp}.gitbundle" --all; 
done
echo "Backup completed."


