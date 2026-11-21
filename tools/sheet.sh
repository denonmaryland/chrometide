#!/usr/bin/env bash
# Usage: tools/sheet.sh <dir>  — makes <dir>/sheet.jpg, a 3-column contact sheet of scene-*.png
d=${1:?dir}; ffmpeg -loglevel error -y -pattern_type glob -i "$d/scene-*.png" -vf "scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2,tile=3x2" -frames:v 1 -q:v 3 "$d/sheet.jpg"
