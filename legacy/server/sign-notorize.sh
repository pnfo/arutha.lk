#!/bin/bash

# Get the absolute path to the script's directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Change the current working directory to the script's directory
cd "$SCRIPT_DIR"

# use to find the hash to codesign below
#security find-identity -v 

FILES=(
    "arutha_lk_macos_m1m2"
    "arutha_lk_macos_intel"
)

for FILE in "${FILES[@]}"
do
    # create a zip file or a dmg file containing the binary - otherwise notorization fails
    # dmg files can be stapled but not zip files - so use dmg below
    FOLDER="dist-desktop/$FILE"
    rm -rf $FOLDER && mkdir $FOLDER
    
    cp bin/$FILE $FOLDER
    cp -r ../dist $FOLDER
    cp -r ../server-data $FOLDER

    codesign -s B9F140C9B821EFB37D751109B3593EB60A5F3C17 -o runtime -v $FOLDER/$FILE

    DMGFILE="dist-desktop/$FILE.dmg"
    rm -rf $DMGFILE
    hdiutil create -srcFolder $FOLDER -o $DMGFILE

    codesign -s B9F140C9B821EFB37D751109B3593EB60A5F3C17 --force -v $DMGFILE

    xcrun notarytool submit --keychain-profile "janaka" --wait $DMGFILE

    xcrun stapler staple $DMGFILE

    xcrun stapler validate $DMGFILE

    rm -rf $FOLDER # cleanup
done