#!/bin/bash

# Get the absolute path to the script's directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Change the current working directory to the script's directory
cd "$SCRIPT_DIR/dist-desktop"

FILES=(
    "arutha_lk_linux_intel"
    "arutha_lk_windows_intel"
    "arutha_lk_windows_32bit"
)

for FILE in "${FILES[@]}"
do
    FOLDER="$FILE"
    rm -rf $FOLDER && rm -rf $FILE.zip && mkdir $FOLDER
    
    if [[ "$FILE" == *"windows"* ]]; then
        cp ../bin/$FILE.exe $FOLDER
    else
        cp ../bin/$FILE $FOLDER
    fi

    cp -r ../../dist $FOLDER
    cp -r ../../server-data $FOLDER

    zip -r -q $FILE.zip $FOLDER

    rm -rf $FOLDER # cleanup
    echo "created zip for $FILE"
done