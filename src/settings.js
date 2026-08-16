// user settings persisted in localStorage. filters and small preferences that
// should survive a reload, kept separate from the account profile.

import { LANGUAGES } from './snippets.js'

const KEY = 'caret.settings.v1'

export function defaultSettings() {
  return {
    languages: [...LANGUAGES],
    length: 'all',
    liveStats: true, // show wpm/acc/time while typing
    sound: false, // soft keypress click
    smoothCaret: true, // glide the caret vs jump instantly
  }
}

export function loadSettings() {
  const d = defaultSettings()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return d
    const s = JSON.parse(raw)
    const languages = Array.isArray(s.languages)
      ? s.languages.filter((l) => d.languages.includes(l))
      : []
    return {
      ...d,
      ...s,
      // never let the language filter end up empty (nothing to type)
      languages: languages.length ? languages : d.languages,
    }
  } catch {
    return d
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // storage unavailable (private mode etc.) - keep in memory only
  }
}
