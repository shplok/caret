// a mixed pack of code snippets across languages.
// keep indentation with spaces, no trailing whitespace, no tabs.
// escape sequences must be double-escaped (\\n, \\0) so they render literally.
// each snippet: { id, language, title, code }

export const LANGUAGES = [
  'python',
  'javascript',
  'typescript',
  'c',
  'cpp',
  'java',
  'rust',
  'assembly',
]

// short labels for the config bar and badges.
export const LANG_LABELS = {
  python: 'python',
  javascript: 'js',
  typescript: 'ts',
  c: 'c',
  cpp: 'c++',
  java: 'java',
  rust: 'rust',
  assembly: 'asm',
}

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
  {
    id: 'c-swap',
    language: 'c',
    title: 'swap pointers',
    code: `void swap(int *a, int *b) {
    int tmp = *a;
    *a = *b;
    *b = tmp;
}`,
  },
  {
    id: 'c-factorial',
    language: 'c',
    title: 'factorial',
    code: `long factorial(int n) {
    long result = 1;
    for (int i = 2; i <= n; i++) {
        result *= i;
    }
    return result;
}`,
  },
  {
    id: 'c-strlen',
    language: 'c',
    title: 'string length',
    code: `size_t str_len(const char *s) {
    const char *p = s;
    while (*p) {
        p++;
    }
    return p - s;
}`,
  },
  {
    id: 'cpp-sum',
    language: 'cpp',
    title: 'sum a vector',
    code: `int sum(const std::vector<int>& v) {
    int total = 0;
    for (int x : v) {
        total += x;
    }
    return total;
}`,
  },
  {
    id: 'cpp-max',
    language: 'cpp',
    title: 'template max',
    code: `template <typename T>
T max_of(T a, T b) {
    return a > b ? a : b;
}`,
  },
  {
    id: 'cpp-point',
    language: 'cpp',
    title: 'point class',
    code: `class Point {
public:
    Point(int x, int y) : x_(x), y_(y) {}
    int x() const { return x_; }
    int y() const { return y_; }
private:
    int x_, y_;
};`,
  },
  {
    id: 'java-main',
    language: 'java',
    title: 'hello world',
    code: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, world!");
    }
}`,
  },
  {
    id: 'java-gcd',
    language: 'java',
    title: 'greatest common divisor',
    code: `static int gcd(int a, int b) {
    while (b != 0) {
        int t = b;
        b = a % b;
        a = t;
    }
    return a;
}`,
  },
  {
    id: 'java-stream',
    language: 'java',
    title: 'filter with streams',
    code: `List<Integer> evens = numbers.stream()
    .filter(n -> n % 2 == 0)
    .collect(Collectors.toList());`,
  },
  {
    id: 'rust-factorial',
    language: 'rust',
    title: 'factorial',
    code: `fn factorial(n: u64) -> u64 {
    (1..=n).product()
}`,
  },
  {
    id: 'rust-point',
    language: 'rust',
    title: 'struct and impl',
    code: `struct Point {
    x: f64,
    y: f64,
}

impl Point {
    fn dist(&self) -> f64 {
        (self.x * self.x + self.y * self.y).sqrt()
    }
}`,
  },
  {
    id: 'rust-iter',
    language: 'rust',
    title: 'sum of squares',
    code: `fn sum_squares(nums: &[i32]) -> i32 {
    nums.iter().map(|n| n * n).sum()
}`,
  },
  {
    id: 'asm-add',
    language: 'assembly',
    title: 'add two (x86-64)',
    code: `add_two:
    mov eax, edi
    add eax, esi
    ret`,
  },
  {
    id: 'asm-sum',
    language: 'assembly',
    title: 'sum to n (x86-64)',
    code: `sum_to_n:
    xor eax, eax
    mov ecx, edi
.loop:
    add eax, ecx
    dec ecx
    jnz .loop
    ret`,
  },
]
