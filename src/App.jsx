import { useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react'
import { LANGUAGES, LANG_LABELS, snippets } from './snippets.js'
import {
  buildSteps,
  nextTypable,
  prevTypable,
  typableCount,
  computeWpm,
  computeAccuracy,
} from './typing.js'
import {
  loadProfile,
  recordResult,
  setUsername,
  resetStats,
  averages,
  formatDuration,
} from './profile.js'
import { loadSettings, saveSettings } from './settings.js'

const LENGTHS = ['all', 'short', 'medium', 'long']

// file extensions used for the editor title bar.
const EXT = {
  python: 'py',
  javascript: 'js',
  typescript: 'ts',
  c: 'c',
  cpp: 'cpp',
  java: 'java',
  rust: 'rs',
  assembly: 'asm',
}

function filenameFor(snippet) {
  const slug = snippet.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return `${slug}.${EXT[snippet.language]}`
}

function lengthOf(code) {
  const n = code.split('\n').length
  if (n <= 3) return 'short'
  if (n <= 6) return 'medium'
  return 'long'
}

// build a fresh engine state for a snippet.
function makeEngine(snippet) {
  const steps = buildSteps(snippet.code)
  const statuses = steps.map((s) => (s.type === 'auto' ? 'auto' : 'pending'))
  return {
    steps,
    statuses,
    pos: nextTypable(steps, 0),
    started: false,
    startTime: 0,
    endTime: 0,
    finished: false,
    total: 0, // every keystroke counted (for accuracy)
    correctKeys: 0,
    errors: 0,
    samples: [], // per-second { t, wpm, raw } for the results graph
    lastSec: 0,
    recorded: false, // whether this finished test was saved to the profile
    newBest: false, // beat the all-time best wpm
    newLangBest: false, // beat the best wpm for this language
  }
}

// take a wpm/raw snapshot for the given elapsed time (used once per second).
function sample(eng, elapsedMs) {
  const minutes = elapsedMs / 60000
  if (minutes <= 0) return
  const correct = eng.statuses.filter((s) => s === 'correct').length
  const wpm = Math.round(correct / 5 / minutes)
  const raw = Math.round(eng.total / 5 / minutes)
  eng.samples.push({ t: Math.round(elapsedMs / 1000), wpm, raw })
}

function pick(pool, excludeId) {
  const choices = pool.length > 1 ? pool.filter((s) => s.id !== excludeId) : pool
  const i = Math.floor(Math.random() * choices.length)
  return choices[i]
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function classFor(step, status) {
  if (step.type === 'newline') return `ch newline ${status}`
  let c = `ch ${status}`
  if (step.ch === ' ') c += ' space'
  return c
}

export default function App() {
  const [, force] = useReducer((c) => c + 1, 0)

  // load persisted settings once.
  const initRef = useRef(null)
  if (initRef.current === null) initRef.current = loadSettings()
  const init = initRef.current

  // filter/preference state kept in refs so the single key handler always reads
  // fresh values without re-subscribing the window listener.
  const langsRef = useRef(new Set(init.languages))
  const lengthRef = useRef(init.length)
  const focusedRef = useRef(true)
  const optsRef = useRef({
    liveStats: init.liveStats,
    sound: init.sound,
    smoothCaret: init.smoothCaret,
    fontSize: init.fontSize,
  })
  const deckRef = useRef({ sig: '', ids: [] })

  const profileRef = useRef(loadProfile())
  const accountRef = useRef(false)
  const settingsRef = useRef(false)
  const capsRef = useRef(false)

  const langs = langsRef.current
  const length = lengthRef.current
  const focused = focusedRef.current
  const opts = optsRef.current
  const profile = profileRef.current
  const accountOpen = accountRef.current
  const settingsOpen = settingsRef.current
  const capsLock = capsRef.current

  // persist the current filters + preferences.
  function persist() {
    saveSettings({
      languages: [...langsRef.current],
      length: lengthRef.current,
      ...optsRef.current,
    })
  }

  function openAccount() {
    accountRef.current = true
    force()
  }

  function closeAccount() {
    accountRef.current = false
    force()
  }

  function openSettings() {
    settingsRef.current = true
    force()
  }

  function closeSettings() {
    settingsRef.current = false
    force()
  }

  function toggleOpt(key) {
    optsRef.current = { ...optsRef.current, [key]: !optsRef.current[key] }
    persist()
    force()
  }

  function setOpt(key, value) {
    optsRef.current = { ...optsRef.current, [key]: value }
    persist()
    force()
  }

  const pool = useMemo(() => {
    let p = snippets.filter((s) => langs.has(s.language))
    if (length !== 'all') {
      const f = p.filter((s) => lengthOf(s.code) === length)
      if (f.length) p = f // fall back to the wider set rather than showing nothing
    }
    return p
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langs, length])

  const snippetRef = useRef(pick(pool))
  const engineRef = useRef(makeEngine(snippetRef.current))

  function loadSnippet(next) {
    snippetRef.current = next
    engineRef.current = makeEngine(next)
    force()
  }

  function restart() {
    engineRef.current = makeEngine(snippetRef.current)
    force()
  }

  // draw the next snippet from a shuffled deck so every snippet in the current
  // pool appears once before any repeats.
  function drawNext(excludeId) {
    const sig = pool.map((s) => s.id).sort().join(',')
    let deck = deckRef.current
    if (deck.sig !== sig || deck.ids.length === 0) {
      deck = { sig, ids: shuffle(pool.map((s) => s.id)) }
    }
    let idx = 0
    if (deck.ids[0] === excludeId && deck.ids.length > 1) idx = 1
    const [id] = deck.ids.splice(idx, 1)
    deckRef.current = deck
    return pool.find((s) => s.id === id) || pick(pool, excludeId)
  }

  function goNext() {
    loadSnippet(drawNext(snippetRef.current.id))
  }

  function setLangs(updater) {
    langsRef.current = updater(langsRef.current)
    ensureInPool()
    persist()
    force()
  }

  function setLength(value) {
    lengthRef.current = value
    ensureInPool()
    persist()
    force()
  }

  // after a filter change, swap the snippet if it no longer matches.
  function ensureInPool() {
    let p = snippets.filter((s) => langsRef.current.has(s.language))
    if (lengthRef.current !== 'all') {
      const f = p.filter((s) => lengthOf(s.code) === lengthRef.current)
      if (f.length) p = f
    }
    if (!p.some((s) => s.id === snippetRef.current.id)) {
      snippetRef.current = pick(p)
      engineRef.current = makeEngine(snippetRef.current)
    }
  }

  function setFocused(v) {
    if (focusedRef.current !== v) {
      focusedRef.current = v
      force()
    }
  }

  // soft keypress click via WebAudio, created lazily on first use.
  const audioRef = useRef(null)
  function playTick(good) {
    if (!optsRef.current.sound) return
    try {
      let ctx = audioRef.current
      if (!ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (!Ctx) return
        ctx = new Ctx()
        audioRef.current = ctx
      }
      if (ctx.state === 'suspended') ctx.resume()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = good ? 620 : 200
      o.connect(g)
      g.connect(ctx.destination)
      const t = ctx.currentTime
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(good ? 0.05 : 0.07, t + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
      o.start(t)
      o.stop(t + 0.07)
    } catch {
      // audio not available - ignore
    }
  }

  // live timer: re-render several times a second and sample wpm once per second.
  useEffect(() => {
    const id = setInterval(() => {
      const eng = engineRef.current
      if (eng.started && !eng.finished) {
        const elapsed = Date.now() - eng.startTime
        const sec = Math.floor(elapsed / 1000)
        if (sec > eng.lastSec) {
          eng.lastSec = sec
          sample(eng, elapsed)
        }
        force()
      }
    }, 100)
    return () => clearInterval(id)
  }, [])

  // keep a fresh handler in a ref so the single window listener never goes stale.
  const handlerRef = useRef(null)
  handlerRef.current = function handleKey(e) {
    // track caps lock so we can warn about it (a common cause of all errors).
    if (typeof e.getModifierState === 'function') {
      const caps = e.getModifierState('CapsLock')
      if (caps !== capsRef.current) {
        capsRef.current = caps
        force()
      }
    }
    // ctrl/alt/cmd + backspace deletes the previous word; other modifier combos
    // are left to the browser.
    if (e.ctrlKey || e.metaKey || e.altKey) {
      if (e.key === 'Backspace' && !accountRef.current && !settingsRef.current) {
        const tag = e.target && e.target.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          const eng = engineRef.current
          if (!eng.finished) {
            e.preventDefault()
            deleteWord(eng)
            force()
          }
        }
      }
      return
    }
    // when a modal is open, only escape does anything (typing still reaches the
    // username input because we don't preventDefault other keys)
    if (accountRef.current || settingsRef.current) {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeAccount()
        closeSettings()
      }
      return
    }
    // don't hijack typing into form fields
    const tag = e.target && e.target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    setFocused(true)
    if (e.key === ' ') e.preventDefault() // stop page scroll on space

    if (e.key === 'Tab') {
      e.preventDefault()
      restart()
      return
    }

    const eng = engineRef.current

    if (eng.finished) {
      if (e.key === 'Enter') {
        e.preventDefault()
        goNext()
      }
      return
    }

    if (e.key === 'Backspace') {
      e.preventDefault()
      const prev = prevTypable(eng.steps, eng.pos)
      if (prev >= 0) {
        eng.statuses[prev] = 'pending'
        eng.pos = prev
        force()
      }
      return
    }

    const step = eng.steps[eng.pos]
    if (!step) return

    const isPrintable = e.key.length === 1
    const isEnter = e.key === 'Enter'
    if (!isPrintable && !isEnter) return // ignore shift, arrows, function keys

    e.preventDefault()

    if (!eng.started) {
      eng.started = true
      eng.startTime = Date.now()
    }

    if (step.type === 'newline') {
      eng.total++
      if (isEnter) {
        eng.statuses[eng.pos] = 'correct'
        eng.correctKeys++
        playTick(true)
        advance(eng)
      } else {
        eng.errors++
        playTick(false)
      }
      force()
      return
    }

    // step.type === 'char'
    eng.total++
    if (isEnter) {
      // a newline where a character is expected: an error, don't advance
      eng.errors++
      playTick(false)
      force()
      return
    }
    if (e.key === step.ch) {
      eng.statuses[eng.pos] = 'correct'
      eng.correctKeys++
      playTick(true)
    } else {
      eng.statuses[eng.pos] = 'incorrect'
      eng.errors++
      playTick(false)
    }
    advance(eng)
    force()
  }

  useEffect(() => {
    const onKey = (e) => handlerRef.current(e)
    const onBlur = () => setFocused(false)
    const onFocus = () => setFocused(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const eng = engineRef.current
  const snippet = snippetRef.current

  // glide the caret to the current character, and keep the active line visible
  // in the scrollable editor body for long snippets.
  const caretRef = useRef(null)
  const currentCharRef = useRef(null)
  const bodyRef = useRef(null)
  useLayoutEffect(() => {
    const caret = caretRef.current
    if (!caret) return
    caret.style.transitionDuration = optsRef.current.smoothCaret ? '' : '0s'
    const cur = currentCharRef.current
    if (eng.finished || !cur) {
      caret.style.opacity = '0'
      return
    }
    caret.style.opacity = '1'
    caret.style.left = `${cur.offsetLeft}px`
    caret.style.top = `${cur.offsetTop}px`
    caret.style.height = `${cur.offsetHeight}px`

    const body = bodyRef.current
    if (body && body.scrollHeight > body.clientHeight + 1) {
      const cr = cur.getBoundingClientRect()
      const br = body.getBoundingClientRect()
      const pad = cr.height * 1.5
      if (cr.top < br.top + pad) body.scrollTop -= br.top + pad - cr.top
      else if (cr.bottom > br.bottom - pad)
        body.scrollTop += cr.bottom - (br.bottom - pad)
    }
  })

  // save each finished test to the local profile exactly once, flagging any new
  // personal bests captured against the pre-record profile.
  useEffect(() => {
    const e = engineRef.current
    if (!e.finished || e.recorded) return
    e.recorded = true
    const elapsed = e.endTime - e.startTime
    const correct = e.statuses.filter((s) => s === 'correct').length
    const w = computeWpm(correct, elapsed)
    const a = computeAccuracy(e.correctKeys, e.total)
    const lang = snippetRef.current.language
    const prev = profileRef.current
    e.newBest = w > 0 && w > prev.bestWpm
    e.newLangBest = w > 0 && !e.newBest && w > (prev.bestByLang[lang] || 0)
    profileRef.current = recordResult(prev, {
      wpm: w,
      acc: a,
      timeMs: elapsed,
      language: lang,
    })
    force()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eng.finished])

  const correctChars = eng.statuses.filter((s) => s === 'correct').length
  const elapsedMs = eng.started
    ? (eng.finished ? eng.endTime : Date.now()) - eng.startTime
    : 0
  const wpm = computeWpm(correctChars, elapsedMs)
  const acc = computeAccuracy(eng.correctKeys, eng.total)
  const done = eng.statuses.filter((s) => s === 'correct' || s === 'incorrect').length
  const totalTypable = typableCount(eng.steps)
  const progress = totalTypable ? Math.round((done / totalTypable) * 100) : 0
  const rawWpm = elapsedMs > 0 ? Math.round(eng.total / 5 / (elapsedMs / 60000)) : 0

  const filename = filenameFor(snippet)
  const lineCount = eng.steps.filter((s) => s.type === 'newline').length + 1
  const avg = averages(profile)
  const langPB = profile.bestByLang[snippet.language] || 0
  const consistency = computeConsistency(eng.samples)

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          caret<span className="logo-caret" />
        </div>
        <div className="topbar-actions">
          <button className="icon-btn" onClick={openSettings} title="settings" aria-label="settings">
            <GearIcon />
          </button>
          <button className="account-btn" onClick={openAccount}>
            <span className="account-dot" />
            {profile.username || 'guest'}
          </button>
        </div>
      </header>

      <div className="config">
        <div className="config-group">
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              className={`opt ${langs.has(lang) ? 'on' : ''}`}
              onClick={(e) => {
                setLangs((prev) => toggle(prev, lang))
                e.currentTarget.blur()
              }}
              onDoubleClick={(e) => {
                setLangs(() => new Set([lang])) // solo this language
                e.currentTarget.blur()
              }}
            >
              {LANG_LABELS[lang]}
            </button>
          ))}
        </div>
        <div className="config-divider" />
        <div className="config-group">
          {LENGTHS.map((len) => (
            <button
              key={len}
              className={`opt ${length === len ? 'on' : ''}`}
              onClick={(e) => {
                setLength(len)
                e.currentTarget.blur()
              }}
            >
              {len}
            </button>
          ))}
        </div>
      </div>

      {opts.liveStats && (
        <div className="stats">
          <div className="stat">
            <span className="stat-value">{wpm}</span>
            <span className="stat-label">wpm</span>
          </div>
          <div className="stat">
            <span className="stat-value">{acc}%</span>
            <span className="stat-label">acc</span>
          </div>
          <div className="stat">
            <span className="stat-value">{(elapsedMs / 1000).toFixed(1)}s</span>
            <span className="stat-label">time</span>
          </div>
          <div className="progressbar">
            <div className="progressfill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {!opts.liveStats && (
        <div className="stats minimal">
          <div className="progressbar">
            <div className="progressfill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className={`editor size-${opts.fontSize}`} onClick={() => setFocused(true)}>
        <div className="editor-bar">
          <div className="dots">
            <span className="dot red" />
            <span className="dot yellow" />
            <span className="dot green" />
          </div>
          <span className="filename">{filename}</span>
          {langPB > 0 && <span className="pb" title="your best wpm in this language">pb {langPB}</span>}
          <span className={`lang-tag ${snippet.language}`}>
            {LANG_LABELS[snippet.language]}
          </span>
        </div>

        <div className="editor-body" ref={bodyRef}>
          <div className="gutter" aria-hidden="true">
            {Array.from({ length: lineCount }, (_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
          <pre className={`code ${focused ? '' : 'blurred'}`}>
            <span ref={caretRef} className="caret" />
            {eng.steps.map((step, i) => (
              <span
                key={i}
                ref={i === eng.pos ? currentCharRef : null}
                className={classFor(step, eng.statuses[i])}
              >
                {step.ch}
              </span>
            ))}
          </pre>
        </div>

        {capsLock && focused && !eng.finished && !accountOpen && !settingsOpen && (
          <div className="caps-warn">caps lock is on</div>
        )}

        {!focused && !eng.finished && (
          <div className="focus-note">click or press any key to focus</div>
        )}

        {eng.finished && (
          <div className="results">
            {(eng.newBest || eng.newLangBest) && (
              <div className="best-badge">
                {eng.newBest
                  ? 'new personal best'
                  : `new best in ${LANG_LABELS[snippet.language]}`}
              </div>
            )}
            <div className="results-top">
              <div className="results-headline">
                <div className="result big">
                  <span className="result-value">{wpm}</span>
                  <span className="result-label">wpm</span>
                </div>
                <div className="result big">
                  <span className="result-value">{acc}%</span>
                  <span className="result-label">accuracy</span>
                </div>
              </div>
              <Chart samples={eng.samples} />
            </div>
            <div className="results-grid">
              <div className="result">
                <span className="result-value">{rawWpm}</span>
                <span className="result-label">raw</span>
              </div>
              <div className="result">
                <span className="result-value">{(elapsedMs / 1000).toFixed(1)}s</span>
                <span className="result-label">time</span>
              </div>
              <div className="result">
                <span className="result-value">{correctChars}</span>
                <span className="result-label">chars</span>
              </div>
              <div className="result">
                <span className="result-value">{eng.errors}</span>
                <span className="result-label">errors</span>
              </div>
              <div className="result">
                <span className="result-value">{consistency}%</span>
                <span className="result-label">consistency</span>
              </div>
              <div className="result">
                <span className="result-value">{avg.wpm || '-'}</span>
                <span className="result-label">your avg</span>
              </div>
            </div>
            <div className="results-caption">
              {snippet.title} · {LANG_LABELS[snippet.language]}
            </div>
            <div className="results-actions">
              <button className="btn primary" onClick={goNext}>
                next snippet
              </button>
              <button className="btn" onClick={restart}>
                retry
              </button>
            </div>
          </div>
        )}
      </div>

      <footer className="hints">
        <span><kbd>tab</kbd> restart</span>
        <span><kbd>enter</kbd> new line{eng.finished ? ' / next' : ''}</span>
        <span><kbd>ctrl</kbd>+<kbd>backspace</kbd> delete word</span>
        <span>indentation is auto filled</span>
      </footer>

      {settingsOpen && (
        <div className="modal-backdrop" onClick={closeSettings}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">settings</span>
              <button className="modal-close" onClick={closeSettings}>
                esc
              </button>
            </div>
            <div className="toggles">
              <Toggle
                label="live stats while typing"
                hint="hide wpm and time to reduce pressure"
                value={opts.liveStats}
                onChange={() => toggleOpt('liveStats')}
              />
              <Toggle
                label="keypress sound"
                hint="soft click on each key"
                value={opts.sound}
                onChange={() => toggleOpt('sound')}
              />
              <Toggle
                label="smooth caret"
                hint="glide the caret instead of jumping"
                value={opts.smoothCaret}
                onChange={() => toggleOpt('smoothCaret')}
              />
              <div className="setting-row">
                <span className="toggle-text">
                  <span className="toggle-label">font size</span>
                  <span className="toggle-hint">size of the code you type</span>
                </span>
                <div className="seg">
                  {['s', 'm', 'l'].map((sz) => (
                    <button
                      key={sz}
                      className={`seg-btn ${opts.fontSize === sz ? 'on' : ''}`}
                      onClick={() => setOpt('fontSize', sz)}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {accountOpen && (
        <div className="modal-backdrop" onClick={closeAccount}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">account</span>
              <button className="modal-close" onClick={closeAccount}>
                esc
              </button>
            </div>

            <label className="field">
              <span className="field-label">username</span>
              <input
                className="field-input"
                type="text"
                value={profile.username}
                placeholder="guest"
                maxLength={24}
                onChange={(e) => {
                  profileRef.current = setUsername(profileRef.current, e.target.value)
                  force()
                }}
              />
            </label>

            <div className="account-stats">
              <div className="astat">
                <span className="astat-value">{profile.testsCompleted}</span>
                <span className="astat-label">tests completed</span>
              </div>
              <div className="astat">
                <span className="astat-value">{formatDuration(profile.totalTimeMs)}</span>
                <span className="astat-label">time typing</span>
              </div>
              <div className="astat">
                <span className="astat-value">{profile.bestWpm}</span>
                <span className="astat-label">best wpm</span>
              </div>
              <div className="astat">
                <span className="astat-value">{avg.wpm}</span>
                <span className="astat-label">avg wpm</span>
              </div>
              <div className="astat">
                <span className="astat-value">{avg.acc}%</span>
                <span className="astat-label">avg accuracy</span>
              </div>
            </div>

            <div className="lang-bests">
              <div className="lang-bests-title">best wpm by language</div>
              <div className="lang-bests-grid">
                {LANGUAGES.map((lang) => (
                  <div className="lang-best" key={lang}>
                    <span className="lang-best-name">{LANG_LABELS[lang]}</span>
                    <span className="lang-best-value">
                      {profile.bestByLang[lang] || '-'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              className="btn reset"
              onClick={() => {
                profileRef.current = resetStats(profileRef.current)
                force()
              }}
            >
              reset stats
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Toggle({ label, hint, value, onChange }) {
  return (
    <button className={`toggle ${value ? 'on' : ''}`} onClick={onChange}>
      <span className="toggle-text">
        <span className="toggle-label">{label}</span>
        {hint && <span className="toggle-hint">{hint}</span>}
      </span>
      <span className="toggle-track">
        <span className="toggle-knob" />
      </span>
    </button>
  )
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.55 1.55M18.25 18.25l1.55 1.55M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.55-1.55M18.25 5.75l1.55-1.55"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

// small svg line chart of wpm and raw over time, monkeytype style.
function Chart({ samples }) {
  const W = 620
  const H = 190
  const padL = 34
  const padR = 12
  const padT = 14
  const padB = 24

  if (!samples || samples.length === 0) {
    return <div className="chart empty">not enough data</div>
  }

  const maxT = Math.max(1, ...samples.map((s) => s.t))
  const maxY = Math.max(10, ...samples.map((s) => Math.max(s.wpm, s.raw)))

  const x = (t) => padL + (maxT ? (t / maxT) * (W - padL - padR) : 0)
  const y = (v) => padT + (1 - v / maxY) * (H - padT - padB)

  const line = (key) =>
    samples.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(s.t)} ${y(s[key])}`).join(' ')

  const ticks = [0, Math.round(maxY / 2), maxY]

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {ticks.map((val) => (
        <g key={val}>
          <line
            className="grid"
            x1={padL}
            x2={W - padR}
            y1={y(val)}
            y2={y(val)}
          />
          <text className="axis" x={padL - 6} y={y(val) + 4} textAnchor="end">
            {val}
          </text>
        </g>
      ))}
      <text className="axis" x={padL} y={H - 6} textAnchor="start">
        0s
      </text>
      <text className="axis" x={W - padR} y={H - 6} textAnchor="end">
        {maxT}s
      </text>
      <path className="raw-line" d={line('raw')} />
      <path className="wpm-line" d={line('wpm')} />
      {samples.map((s, i) => (
        <circle key={i} className="wpm-dot" cx={x(s.t)} cy={y(s.wpm)} r="2.5" />
      ))}
    </svg>
  )
}

function advance(eng) {
  const next = nextTypable(eng.steps, eng.pos + 1)
  eng.pos = next
  if (next >= eng.steps.length) {
    eng.finished = true
    eng.endTime = Date.now()
    sample(eng, eng.endTime - eng.startTime) // final point on the graph
  }
}

// delete back to the start of the previous run of word/non-word characters,
// clearing statuses as it goes. mirrors a terminal ctrl+backspace.
function deleteWord(eng) {
  let p = prevTypable(eng.steps, eng.pos)
  if (p < 0) return
  const isWord = (ch) => /[A-Za-z0-9_]/.test(ch)
  // skip any whitespace/newlines immediately behind the cursor first.
  while (p >= 0) {
    const step = eng.steps[p]
    const ws = step.type === 'newline' || step.ch === ' '
    if (!ws) break
    eng.statuses[p] = 'pending'
    eng.pos = p
    p = prevTypable(eng.steps, p)
  }
  // then remove the contiguous word (or symbol run) that precedes it.
  if (p >= 0) {
    const word = isWord(eng.steps[p].ch)
    while (p >= 0) {
      const step = eng.steps[p]
      if (step.type === 'newline' || step.ch === ' ') break
      if (isWord(step.ch) !== word) break
      eng.statuses[p] = 'pending'
      eng.pos = p
      p = prevTypable(eng.steps, p)
    }
  }
}

// consistency = how steady the raw speed was, as a percentage. based on the
// coefficient of variation of the per-second raw samples (monkeytype style).
function computeConsistency(samples) {
  const vals = (samples || []).map((s) => s.raw).filter((v) => v > 0)
  if (vals.length < 2) return 0
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  if (mean === 0) return 0
  const variance =
    vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vals.length
  const cv = Math.sqrt(variance) / mean
  return Math.max(0, Math.min(100, Math.round((1 - cv) * 100)))
}

function toggle(prev, lang) {
  const next = new Set(prev)
  if (next.has(lang)) {
    if (next.size > 1) next.delete(lang)
  } else {
    next.add(lang)
  }
  return next
}
