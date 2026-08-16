import { useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react'
import { LANGUAGES, snippets } from './snippets.js'
import {
  buildSteps,
  nextTypable,
  prevTypable,
  typableCount,
  computeWpm,
  computeAccuracy,
} from './typing.js'

const LENGTHS = ['all', 'short', 'medium', 'long']

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
  }
}

function pick(pool, excludeId) {
  const choices = pool.length > 1 ? pool.filter((s) => s.id !== excludeId) : pool
  const i = Math.floor(Math.random() * choices.length)
  return choices[i]
}

function classFor(step, status) {
  if (step.type === 'newline') return `ch newline ${status}`
  let c = `ch ${status}`
  if (step.ch === ' ') c += ' space'
  return c
}

export default function App() {
  const [, force] = useReducer((c) => c + 1, 0)

  // filter state kept in refs so the single key handler always reads fresh values.
  const langsRef = useRef(new Set(LANGUAGES))
  const lengthRef = useRef('all')
  const focusedRef = useRef(true)

  const langs = langsRef.current
  const length = lengthRef.current
  const focused = focusedRef.current

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

  function goNext() {
    loadSnippet(pick(pool, snippetRef.current.id))
  }

  function setLangs(updater) {
    langsRef.current = updater(langsRef.current)
    ensureInPool()
    force()
  }

  function setLength(value) {
    lengthRef.current = value
    ensureInPool()
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

  // live timer: re-render a few times a second while typing.
  useEffect(() => {
    const id = setInterval(() => {
      const eng = engineRef.current
      if (eng.started && !eng.finished) force()
    }, 200)
    return () => clearInterval(id)
  }, [])

  // keep a fresh handler in a ref so the single window listener never goes stale.
  const handlerRef = useRef(null)
  handlerRef.current = function handleKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return
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
        advance(eng)
      } else {
        eng.errors++
      }
      force()
      return
    }

    // step.type === 'char'
    eng.total++
    if (isEnter) {
      // a newline where a character is expected: an error, don't advance
      eng.errors++
      force()
      return
    }
    if (e.key === step.ch) {
      eng.statuses[eng.pos] = 'correct'
      eng.correctKeys++
    } else {
      eng.statuses[eng.pos] = 'incorrect'
      eng.errors++
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

  // glide the caret to the current character after every render.
  const caretRef = useRef(null)
  const currentCharRef = useRef(null)
  useLayoutEffect(() => {
    const caret = caretRef.current
    if (!caret) return
    const cur = currentCharRef.current
    if (eng.finished || !cur) {
      caret.style.opacity = '0'
      return
    }
    caret.style.opacity = '1'
    caret.style.left = `${cur.offsetLeft}px`
    caret.style.top = `${cur.offsetTop}px`
    caret.style.height = `${cur.offsetHeight}px`
  })

  const correctChars = eng.statuses.filter((s) => s === 'correct').length
  const elapsedMs = eng.started
    ? (eng.finished ? eng.endTime : Date.now()) - eng.startTime
    : 0
  const wpm = computeWpm(correctChars, elapsedMs)
  const acc = computeAccuracy(eng.correctKeys, eng.total)
  const done = eng.statuses.filter((s) => s === 'correct' || s === 'incorrect').length
  const totalTypable = typableCount(eng.steps)
  const progress = totalTypable ? Math.round((done / totalTypable) * 100) : 0

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          <span className="logo-mark">&gt;_</span> codetype
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
            >
              {lang}
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
        <div className="meta">
          <span className={`badge ${snippet.language}`}>{snippet.language}</span>
          <span className="title">{snippet.title}</span>
        </div>
      </div>

      <div
        className="code-wrap"
        onClick={() => setFocused(true)}
      >
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

        {!focused && !eng.finished && (
          <div className="focus-note">click or press any key to focus</div>
        )}

        {eng.finished && (
          <div className="results">
            <div className="results-grid">
              <div className="result big">
                <span className="result-value">{wpm}</span>
                <span className="result-label">wpm</span>
              </div>
              <div className="result big">
                <span className="result-value">{acc}%</span>
                <span className="result-label">accuracy</span>
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
        <span>indentation is auto filled</span>
      </footer>
    </div>
  )
}

function advance(eng) {
  const next = nextTypable(eng.steps, eng.pos + 1)
  eng.pos = next
  if (next >= eng.steps.length) {
    eng.finished = true
    eng.endTime = Date.now()
  }
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
