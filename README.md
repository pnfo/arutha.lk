# Arutha.lk Sinhala Dictionary Website and Apps

Uses Vue3, Vite, Tailwind CSS for the front end and Web Server written in Go for the bank end. Uses Sqlite db to hold the dictionary entries.

## Project Setup
* `npm install` install dependencies
* `node populate-sqlite.mjs` for (re)creating the db from the dictionary files in `dict-input` folder

### Compile and Hot-Reload for Development
1. `npm run dev` to start dev frontend server on port 5173
2. `go build` and then start backend server `./server -no-open -root-dir=..` to handle backend sqlite requests

### Production Website
1. `npm run build` to generate `dist` folder with minified frontend files
2. Compile the `arutha_lk_linux_intel` go binary and copy it with the `dist` and `server-data` folders to the cloud droplet
3. Follow the instructions in the `arutha_lk.service` file to register a systemctl service and start it
4. The server runs on port 3000

## Building the Apps
```sh
cd server
./build-all.sh # build the go binaries for all platforms
./create-zips.sh # create zip files with the binary and dist/server-data folder for windows/linux
./sign-notorize.sh # codesign and notorize a dmg file for macos
```
Then upload the resulting files to this Github repo's releases
