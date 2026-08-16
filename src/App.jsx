import { useEffect, useMemo, useReducer, useRef } from 'react'
import { LANGUAGES, snippets } from './snippets.js'
import {
  buildSteps,
  nextTypable,
  prevTypable,
  typableCount,
  computeWpm,
  computeAccuracy,
} from './typing.js'

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

  const [langs, setLangs] = useReducerLike(new Set(LANGUAGES))

  const pool = useMemo(
    () => snippets.filter((s) => langs.has(s.language)),
    [langs],
  )

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

  // if the language filter no longer includes the current snippet, swap it out.
  useEffect(() => {
    if (!langs.has(snippetRef.current.language)) {
      loadSnippet(pick(pool))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langs])

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
    const fn = (e) => handlerRef.current(e)
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const eng = engineRef.current
  const snippet = snippetRef.current

  const correctChars = eng.statuses.filter((s) => s === 'correct').length
  const elapsedMs = eng.started
    ? (eng.finished ? eng.endTime : Date.now()) - eng.startTime
    : 0
  const wpm = computeWpm(correctChars, elapsedMs)
  const acc = computeAccuracy(eng.correctKeys, eng.total)
  const done = eng.statuses.filter((s) => s === 'correct' || s === 'incorrect').length
  const totalTypable = typableCount(eng.steps)
  const progress = totalTypable ? Math.round((done / totalTypable) * 100) : 0

  // build the rendered code with an inline caret.
  const rendered = []
  eng.steps.forEach((step, i) => {
    if (i === eng.pos && !eng.finished) {
      rendered.push(<span key={`caret-${i}`} className="caret" />)
    }
    rendered.push(
      <span key={i} className={classFor(step, eng.statuses[i])}>
        {step.ch}
      </span>,
    )
  })

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          <span className="logo-mark">&gt;_</span> codetype
        </div>
        <div className="chips">
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              className={`chip ${langs.has(lang) ? 'on' : ''}`}
              onClick={(e) => {
                toggleLang(setLangs, lang)
                e.currentTarget.blur()
              }}
            >
              {lang}
            </button>
          ))}
        </div>
      </header>

      <div className="meta">
        <span className={`badge ${snippet.language}`}>{snippet.language}</span>
        <span className="title">{snippet.title}</span>
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
      </div>

      <div className="code-wrap">
        <pre className="code">{rendered}</pre>

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

// tiny helper so langs behaves like state but stays a Set.
function useReducerLike(initial) {
  const [, force] = useReducer((c) => c + 1, 0)
  const ref = useRef(initial)
  const set = (updater) => {
    ref.current = typeof updater === 'function' ? updater(ref.current) : updater
    force()
  }
  return [ref.current, set]
}

function toggleLang(setLangs, lang) {
  setLangs((prev) => {
    const next = new Set(prev)
    if (next.has(lang)) {
      if (next.size > 1) next.delete(lang)
    } else {
      next.add(lang)
    }
    return next
  })
}
