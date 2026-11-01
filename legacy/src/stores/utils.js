import { useSavedStore, useSettingsStore } from '@/stores/savedStore'

const bookmarkKey = (entry) => `${entry.dict}-${entry.word}`
export const isStarred = (entry) => !!useSavedStore('bookmarks').state[bookmarkKey(entry)]

export function toggleBookmark(entry) {
    const settingsStore = useSettingsStore(), bookmarksStore = useSavedStore('bookmarks')
    if (isStarred(entry)) {
        bookmarksStore.unsetState(bookmarkKey(entry))
        settingsStore.setSnackbar({ param: entry.word, type: 'bookmark-removed' })
    } else {
        bookmarksStore.setState(bookmarkKey(entry), { time: Date.now(), coll: 'dict', entry })
        settingsStore.setSnackbar({ param: entry.word, type: 'bookmark-added' })
    }
}


// note package.json of vue-clipboard3 need to be changed to "main": "dist/esm/index.js",
import useClipboard from 'vue-clipboard3'
export async function copyClipboard(content, type) {
    await useClipboard().toClipboard(content)
    useSettingsStore().setSnackbar({ type })
}

export async function queryDb(query) {
    // Defines the database name in one place to ensure both paths use the same file
    const DB_NAME = 'all-dict.db';

    // --- 1. ANDROID LOCAL PATH ---
    // Check if the Java Interface exists (injected by WebView)
    if (window.AndroidBackend) {
        try {
            // Call the Java function directly. 
            // Note: This returns a generic JSON String, so we must parse it.
            const jsonString = window.AndroidBackend.executeQuery(DB_NAME, query);

            const data = JSON.parse(jsonString);

            // Handle errors explicitly sent from Java (e.g. {"error": "..."})
            if (data.error) {
                throw new Error(data.error);
            }

            return data;
        } catch (error) {
            console.error("Android Local DB Error:", error);
            throw error;
        }
    }

    // --- 2. WEB SERVER PATH (Your existing logic) ---
    try {
        const response = await fetch('/sql-query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dbname: DB_NAME, query })
        });

        if (!response.ok) throw new Error(`${response.status} - ${response.statusText}`);

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Web Server Error:", error);
        throw error;
    }
}

export function parseDictRows(rows) {
    return rows.map(({ dict, word, meaning }) => {
        const parts = meaning.split('\n').map(l => l.trim())
        const breakup = /^\[.+?\+.+?\]$/.test(parts[0]) ? parts[0] : ''
        meaning = breakup ? parts.slice(1) : parts
        return { dict, word, meaning, breakup }
    })
}