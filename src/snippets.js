// a mixed pack of code snippets across languages.
// keep indentation with spaces, no trailing whitespace, no tabs.
// each snippet: { id, language, title, code }

export const LANGUAGES = ['python', 'javascript', 'typescript']

export const snippets = [
  {
    id: 'py-fib',
    language: 'python',
    title: 'fibonacci',
    code: `def fib(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a`,
  },
  {
    id: 'py-comprehension',
    language: 'python',
    title: 'squares of evens',
    code: `def even_squares(nums):
    return [n * n for n in nums if n % 2 == 0]`,
  },
  {
    id: 'py-class',
    language: 'python',
    title: 'counter class',
    code: `class Counter:
    def __init__(self):
        self.count = 0

    def increment(self, by=1):
        self.count += by
        return self.count`,
  },
  {
    id: 'py-dedupe',
    language: 'python',
    title: 'preserve order dedupe',
    code: `def dedupe(items):
    seen = set()
    result = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result`,
  },
  {
    id: 'js-debounce',
    language: 'javascript',
    title: 'debounce',
    code: `function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}`,
  },
  {
    id: 'js-groupby',
    language: 'javascript',
    title: 'group by key',
    code: `const groupBy = (arr, key) =>
  arr.reduce((acc, item) => {
    const k = item[key];
    (acc[k] ||= []).push(item);
    return acc;
  }, {});`,
  },
  {
    id: 'js-fetch',
    language: 'javascript',
    title: 'fetch json',
    code: `async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(\`request failed: \${res.status}\`);
  }
  return res.json();
}`,
  },
  {
    id: 'ts-result',
    language: 'typescript',
    title: 'result type',
    code: `type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}`,
  },
  {
    id: 'ts-clamp',
    language: 'typescript',
    title: 'clamp',
    code: `function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}`,
  },
  {
    id: 'ts-interface',
    language: 'typescript',
    title: 'user store',
    code: `interface User {
  id: number;
  name: string;
  active: boolean;
}

const byId = (users: User[]): Map<number, User> =>
  new Map(users.map((u) => [u.id, u]));`,
  },
]
