import { useSavedStore, useSettingsStore } from '@/stores/savedStore'

const bookmarkKey = (entry) => `${entry.dict}-${entry.word}`
export const isStarred = (entry) => !!useSavedStore('bookmarks').state[bookmarkKey(entry)]

export function toggleBookmark(entry) {
    const settingsStore = useSettingsStore(), bookmarksStore = useSavedStore('bookmarks')
    if (isStarred(entry)) {
        bookmarksStore.unsetState(bookmarkKey(entry))
        settingsStore.setSnackbar({ param: entry.word, type: 'bookmark-removed' })
    } else {
        bookmarksStore.setState(bookmarkKey(entry), {time: Date.now(), coll: 'dict', entry})
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
    try {
        const response = await fetch('/sql-query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({dbname: 'all-dict.db', query})
        });

        // Check if the response is OK
        if (!response.ok) throw new Error(`${response.status} - ${response.statusText}`);

        // Parse the JSON response
        const data = await response.json();
        //console.log('Success:', data);
        return data
    } catch (error) {
        console.error(error);
        throw error
    }
}

export function parseDictRows(rows) {
    return rows.map(({dict, word, meaning}) => {
        const parts = meaning.split('\n').map(l => l.trim())
        const breakup = /^\[.+?\+.+?\]$/.test(parts[0]) ? parts[0] : ''
        meaning = breakup ? parts.slice(1) : parts
        return {dict, word, meaning, breakup}
    })
}