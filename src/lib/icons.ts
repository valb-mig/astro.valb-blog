export function iconName(slug: string): string {
  return `simple-icons:${slug}`;
}

export function faviconUrl(siteUrl: string): string {
  return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(siteUrl)}`;
}

const languages: { [name: string]: string } = {
  JavaScript: 'js-official',
  TypeScript: 'typescript-official',
  CSS: 'css',
  SCSS: 'scss',
  HTML: 'html',
  Shell: 'shell',
  PHP: 'php3',
  Dockerfile: 'docker2',
  Python: 'python',
  Kotlin: 'kotlin',
  Java: 'java',
  Blade: 'blade',
  C: 'c',
  'C++': 'cpp',
  'C#': 'csharp2',
  Ruby: 'ruby',
  Swift: 'swift',
  'Objective-C': 'objectivec',
  'Objective-C++': 'objectivecpp',
  Just: 'just',
  Lua: 'lua',
  Astro: 'astro',
  Makefile: 'makefile',
  Go: 'go-gopher',
  Rust: 'rust',
  Vue: 'vue',
  Svelte: 'svelte',
  Markdown: 'markdown',
  Dart: 'dartlang',
  'Vim Script': 'vim',
  Nix: 'nix',
  Elixir: 'elixir',
  Haskell: 'haskell',
  Zig: 'zig',
  SQL: 'sql',
  PowerShell: 'powershell',
  'Jupyter Notebook': 'jupyter',
  MDX: 'mdx',
};

export function languageIcon(name: string): string | null {
  return languages[name] ? `vscode-icons:file-type-${languages[name]}` : null;
}
