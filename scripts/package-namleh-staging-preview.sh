#!/usr/bin/env bash
set -euo pipefail

app_path="${1:?usage: package-namleh-staging-preview.sh <app-path> <output-directory> <source-sha>}"
output_directory="${2:?usage: package-namleh-staging-preview.sh <app-path> <output-directory> <source-sha>}"
source_sha="${3:?usage: package-namleh-staging-preview.sh <app-path> <output-directory> <source-sha>}"
info_plist="$app_path/Contents/Info.plist"

[[ -d "$app_path" && -f "$info_plist" ]]
product_name=$(plutil -extract CFBundleName raw "$info_plist")
bundle_identifier=$(plutil -extract CFBundleIdentifier raw "$info_plist")
deep_link_scheme=$(plutil -extract CFBundleURLTypes.0.CFBundleURLSchemes.0 raw "$info_plist")

[[ "$product_name" == "Namleh Buzz Staging" ]]
[[ "$bundle_identifier" == "com.namlehstudios.buzz.staging" ]]
[[ "$deep_link_scheme" == "namleh-buzz-staging" ]]
if codesign -dvv "$app_path" 2>&1 | grep -q '^Authority='; then
  echo "staging identity preview must not carry an Apple signing authority" >&2
  exit 1
fi

mkdir -p "$output_directory"
archive="$output_directory/namleh-buzz-staging-macos-$source_sha.zip"
manifest="$output_directory/namleh-buzz-staging-macos-$source_sha.json"
ditto -c -k --sequesterRsrc --keepParent "$app_path" "$archive"
archive_sha256=$(shasum -a 256 "$archive" | awk '{print $1}')

jq -n \
  --arg sourceSha "$source_sha" \
  --arg productName "$product_name" \
  --arg bundleIdentifier "$bundle_identifier" \
  --arg deepLinkScheme "$deep_link_scheme" \
  --arg archiveSha256 "$archive_sha256" \
  '{
    sourceSha: $sourceSha,
    productName: $productName,
    bundleIdentifier: $bundleIdentifier,
    deepLinkScheme: $deepLinkScheme,
    developerIdSigned: false,
    distributable: false,
    archiveSha256: $archiveSha256
  }' > "$manifest"
