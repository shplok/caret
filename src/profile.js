// local profile persisted in localStorage. no backend, works offline.

const KEY = 'caret.profile.v1'

export function emptyProfile() {
  return {
    username: '',
    testsCompleted: 0,
    totalTimeMs: 0,
    sumWpm: 0, // running totals so we can show averages
    sumAcc: 0,
    bestWpm: 0,
    bestByLang: {}, // language -> best wpm
  }
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyProfile()
    return { ...emptyProfile(), ...JSON.parse(raw) }
  } catch {
    return emptyProfile()
  }
}

export function saveProfile(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // storage unavailable (private mode etc.) - just keep it in memory
  }
}

export function recordResult(p, { wpm, acc, timeMs, language }) {
  const next = {
    ...p,
    testsCompleted: p.testsCompleted + 1,
    totalTimeMs: p.totalTimeMs + timeMs,
    sumWpm: p.sumWpm + wpm,
    sumAcc: p.sumAcc + acc,
    bestWpm: Math.max(p.bestWpm, wpm),
    bestByLang: {
      ...p.bestByLang,
      [language]: Math.max(p.bestByLang[language] || 0, wpm),
    },
  }
  saveProfile(next)
  return next
}

export function setUsername(p, username) {
  const next = { ...p, username }
  saveProfile(next)
  return next
}

export function resetStats(p) {
  const next = { ...emptyProfile(), username: p.username }
  saveProfile(next)
  return next
}

export function averages(p) {
  if (p.testsCompleted === 0) return { wpm: 0, acc: 0 }
  return {
    wpm: Math.round(p.sumWpm / p.testsCompleted),
    acc: Math.round(p.sumAcc / p.testsCompleted),
  }
}

export function formatDuration(ms) {
  const total = Math.round(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}
