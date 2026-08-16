// typing engine helpers.
//
// a snippet is compiled into a flat list of "steps", one per character.
// each step has a type:
//   'char'    -> the user must type this character
//   'newline' -> the user must press Enter here
//   'auto'    -> leading indentation, filled in automatically (auto-indent)
//
// the caret always rests on the next 'char' or 'newline' step; 'auto' steps
// are consumed instantly so the user never types indentation by hand.

export function buildSteps(code) {
  const trimmed = code.replace(/[ \t]+$/gm, '') // drop any trailing whitespace
  const lines = trimmed.split('\n')
  const steps = []

  lines.forEach((line, lineIndex) => {
    const indent = line.match(/^[ \t]*/)[0]
    const rest = line.slice(indent.length)

    for (const ch of indent) {
      steps.push({ ch, type: 'auto' })
    }
    for (const ch of rest) {
      steps.push({ ch, type: 'char' })
    }
    if (lineIndex < lines.length - 1) {
      steps.push({ ch: '\n', type: 'newline' })
    }
  })

  return steps
}

// index of the first step at or after `from` that the user must act on.
// (skips over 'auto' indentation steps.)
export function nextTypable(steps, from) {
  let i = from
  while (i < steps.length && steps[i].type === 'auto') i++
  return i
}

// index of the previous typable step before `from`, for backspace.
export function prevTypable(steps, from) {
  let i = from - 1
  while (i >= 0 && steps[i].type === 'auto') i--
  return i
}

// count of steps the user actually has to type (chars + newlines).
export function typableCount(steps) {
  return steps.filter((s) => s.type !== 'auto').length
}

// standard wpm: (correct chars / 5) / minutes elapsed.
export function computeWpm(correctChars, elapsedMs) {
  if (elapsedMs <= 0) return 0
  const minutes = elapsedMs / 60000
  return Math.round(correctChars / 5 / minutes)
}

// accuracy over every keystroke the user made.
export function computeAccuracy(correct, total) {
  if (total <= 0) return 100
  return Math.round((correct / total) * 100)
}
