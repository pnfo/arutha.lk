import { useSavedStore, useSettingsStore } from '@/stores/savedStore'

export function toggleBookmark(word, isStarred) {
    const settingsStore = useSettingsStore(), bookmarksStore = useSavedStore('bookmarks')
    if (isStarred) {
        bookmarksStore.unsetState(word)
        settingsStore.setSnackbar({ param: word, type: 'bookmark-removed' })
    } else {
        bookmarksStore.setState(word, {time: Date.now(), coll: 'dict'})
        settingsStore.setSnackbar({ param: word, type: 'bookmark-added' })
    }
}

// note package.json of vue-clipboard3 need to be changed to "main": "dist/esm/index.js",
import useClipboard from 'vue-clipboard3'
export async function copyClipboard(word) {
  await useClipboard().toClipboard(`https://arutha.lk/search/${word}`)
  useSettingsStore().setSnackbar({ type: 'link-copied' })
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
        console.log('Success:', data);
        return data
    } catch (error) {
        console.error(error);
        throw error
    }
}

export function parseDictRows(rows) {
    return rows.map(({word, meaning}) => {
        const parts = meaning.split('\n').map(l => l.trim())
        const breakup = /^\[.+?\+.+?\]$/.test(parts[0]) ? parts[0] : ''
        meaning = breakup ? parts.slice(1) : parts
        return {word, meaning, breakup}
    })
}