import type { Icon } from '@phosphor-icons/react'
import {
  FileArchive as FileArchiveIcon,
  FileAudio as FileAudioIcon,
  FileC as FileCIcon,
  FileCode as FileCodeIcon,
  FileCpp as FileCppIcon,
  FileCSharp as FileCSharpIcon,
  FileCss as FileCssIcon,
  FileCsv as FileCsvIcon,
  FileDoc as FileDocIcon,
  File as FileIcon,
  FileHtml as FileHtmlIcon,
  FileImage as FileImageIcon,
  FileIni as FileIniIcon,
  FileJpg as FileJpgIcon,
  FileJs as FileJsIcon,
  FileJsx as FileJsxIcon,
  FileLock as FileLockIcon,
  FileMd as FileMdIcon,
  FilePdf as FilePdfIcon,
  FilePng as FilePngIcon,
  FilePpt as FilePptIcon,
  FilePy as FilePyIcon,
  FileRs as FileRsIcon,
  FileSql as FileSqlIcon,
  FileSvg as FileSvgIcon,
  FileText as FileTextIcon,
  FileTs as FileTsIcon,
  FileTsx as FileTsxIcon,
  FileTxt as FileTxtIcon,
  FileVideo as FileVideoIcon,
  FileVue as FileVueIcon,
  FileXls as FileXlsIcon,
  FileZip as FileZipIcon,
  Folder as FolderIconBase,
  FolderOpen as FolderOpenIconBase,
} from '@phosphor-icons/react'

interface FileIconConfig {
  icon: Icon
  color: string
}

const ICON_SIZE = 16

const ICON_MAP: Record<string, FileIconConfig> = {
  // TypeScript
  ts: { icon: FileTsIcon, color: '#60A5FA' },
  cts: { icon: FileTsIcon, color: '#60A5FA' },
  mts: { icon: FileTsIcon, color: '#60A5FA' },
  tsx: { icon: FileTsxIcon, color: '#60A5FA' },

  // JavaScript
  js: { icon: FileJsIcon, color: '#EAB308' },
  cjs: { icon: FileJsIcon, color: '#EAB308' },
  mjs: { icon: FileJsIcon, color: '#EAB308' },
  jsx: { icon: FileJsxIcon, color: '#EAB308' },

  // Python
  py: { icon: FilePyIcon, color: '#34D399' },

  // Rust
  rs: { icon: FileRsIcon, color: '#FB923C' },

  // C / C++
  c: { icon: FileCIcon, color: '#60A5FA' },
  h: { icon: FileCIcon, color: '#60A5FA' },
  cpp: { icon: FileCppIcon, color: '#60A5FA' },
  hpp: { icon: FileCppIcon, color: '#60A5FA' },
  cc: { icon: FileCppIcon, color: '#60A5FA' },
  cxx: { icon: FileCppIcon, color: '#60A5FA' },
  hxx: { icon: FileCppIcon, color: '#60A5FA' },

  // C#
  cs: { icon: FileCSharpIcon, color: '#A78BFA' },

  // Web
  html: { icon: FileHtmlIcon, color: '#FB923C' },
  htm: { icon: FileHtmlIcon, color: '#FB923C' },
  css: { icon: FileCssIcon, color: '#00C8FF' },
  scss: { icon: FileCssIcon, color: '#00C8FF' },
  sass: { icon: FileCssIcon, color: '#00C8FF' },
  less: { icon: FileCssIcon, color: '#00C8FF' },
  vue: { icon: FileVueIcon, color: '#34D399' },
  svelte: { icon: FileCodeIcon, color: '#FF3E00' },
  astro: { icon: FileCodeIcon, color: '#FF5D01' },

  // Data / Config
  json: { icon: FileCodeIcon, color: '#EAB308' },
  jsonc: { icon: FileCodeIcon, color: '#EAB308' },
  json5: { icon: FileCodeIcon, color: '#EAB308' },
  yaml: { icon: FileIniIcon, color: '#8E8E93' },
  yml: { icon: FileIniIcon, color: '#8E8E93' },
  toml: { icon: FileIniIcon, color: '#8E8E93' },
  ini: { icon: FileIniIcon, color: '#8E8E93' },
  conf: { icon: FileIniIcon, color: '#8E8E93' },
  xml: { icon: FileCodeIcon, color: '#FB923C' },
  csv: { icon: FileCsvIcon, color: '#34D399' },
  tsv: { icon: FileCsvIcon, color: '#34D399' },

  // Markdown / Docs
  md: { icon: FileMdIcon, color: '#8E8E93' },
  mdx: { icon: FileMdIcon, color: '#8E8E93' },
  txt: { icon: FileTxtIcon, color: '#8E8E93' },
  rtf: { icon: FileTextIcon, color: '#8E8E93' },
  tex: { icon: FileTextIcon, color: '#8E8E93' },
  rst: { icon: FileTextIcon, color: '#8E8E93' },
  adoc: { icon: FileTextIcon, color: '#8E8E93' },
  org: { icon: FileTextIcon, color: '#8E8E93' },

  // SQL
  sql: { icon: FileSqlIcon, color: '#EAB308' },
  sqlite: { icon: FileSqlIcon, color: '#EAB308' },
  db: { icon: FileSqlIcon, color: '#EAB308' },

  // Shell
  sh: { icon: FileCodeIcon, color: '#34D399' },
  bash: { icon: FileCodeIcon, color: '#34D399' },
  zsh: { icon: FileCodeIcon, color: '#34D399' },
  fish: { icon: FileCodeIcon, color: '#34D399' },
  ps1: { icon: FileCodeIcon, color: '#34D399' },
  bat: { icon: FileCodeIcon, color: '#34D399' },
  cmd: { icon: FileCodeIcon, color: '#34D399' },

  // Backend / Systems languages
  go: { icon: FileCodeIcon, color: '#00ADD8' },
  java: { icon: FileCodeIcon, color: '#F89820' },
  kt: { icon: FileCodeIcon, color: '#A97BFF' },
  kts: { icon: FileCodeIcon, color: '#A97BFF' },
  scala: { icon: FileCodeIcon, color: '#DC322F' },
  swift: { icon: FileCodeIcon, color: '#F05138' },
  rb: { icon: FileCodeIcon, color: '#CC342D' },
  php: { icon: FileCodeIcon, color: '#777BB4' },
  lua: { icon: FileCodeIcon, color: '#000080' },
  r: { icon: FileCodeIcon, color: '#276DC3' },
  jl: { icon: FileCodeIcon, color: '#9558B2' },
  dart: { icon: FileCodeIcon, color: '#0175C2' },
  zig: { icon: FileCodeIcon, color: '#F7A41D' },
  nim: { icon: FileCodeIcon, color: '#FFE953' },
  ex: { icon: FileCodeIcon, color: '#6E4A7E' },
  exs: { icon: FileCodeIcon, color: '#6E4A7E' },
  erl: { icon: FileCodeIcon, color: '#B83998' },
  hs: { icon: FileCodeIcon, color: '#5D4F85' },
  clj: { icon: FileCodeIcon, color: '#5881D8' },
  cljs: { icon: FileCodeIcon, color: '#5881D8' },
  m: { icon: FileCodeIcon, color: '#60A5FA' },
  mm: { icon: FileCodeIcon, color: '#60A5FA' },
  asm: { icon: FileCodeIcon, color: '#8E8E93' },
  s: { icon: FileCodeIcon, color: '#8E8E93' },
  proto: { icon: FileCodeIcon, color: '#8E8E93' },
  graphql: { icon: FileCodeIcon, color: '#E10098' },
  gql: { icon: FileCodeIcon, color: '#E10098' },

  // Documents
  pdf: { icon: FilePdfIcon, color: '#F87171' },
  doc: { icon: FileDocIcon, color: '#60A5FA' },
  docx: { icon: FileDocIcon, color: '#60A5FA' },
  ppt: { icon: FilePptIcon, color: '#FB923C' },
  pptx: { icon: FilePptIcon, color: '#FB923C' },
  xls: { icon: FileXlsIcon, color: '#34D399' },
  xlsx: { icon: FileXlsIcon, color: '#34D399' },

  // Images
  png: { icon: FilePngIcon, color: '#34D399' },
  jpg: { icon: FileJpgIcon, color: '#34D399' },
  jpeg: { icon: FileJpgIcon, color: '#34D399' },
  gif: { icon: FileImageIcon, color: '#34D399' },
  webp: { icon: FileImageIcon, color: '#34D399' },
  avif: { icon: FileImageIcon, color: '#34D399' },
  svg: { icon: FileSvgIcon, color: '#EAB308' },
  ico: { icon: FileImageIcon, color: '#34D399' },
  bmp: { icon: FileImageIcon, color: '#34D399' },
  tiff: { icon: FileImageIcon, color: '#34D399' },
  tif: { icon: FileImageIcon, color: '#34D399' },

  // Audio
  mp3: { icon: FileAudioIcon, color: '#FB923C' },
  wav: { icon: FileAudioIcon, color: '#FB923C' },
  ogg: { icon: FileAudioIcon, color: '#FB923C' },
  flac: { icon: FileAudioIcon, color: '#FB923C' },
  aac: { icon: FileAudioIcon, color: '#FB923C' },
  m4a: { icon: FileAudioIcon, color: '#FB923C' },

  // Video
  mp4: { icon: FileVideoIcon, color: '#F87171' },
  webm: { icon: FileVideoIcon, color: '#F87171' },
  mov: { icon: FileVideoIcon, color: '#F87171' },
  avi: { icon: FileVideoIcon, color: '#F87171' },
  mkv: { icon: FileVideoIcon, color: '#F87171' },

  // Archives
  zip: { icon: FileZipIcon, color: '#8E8E93' },
  gz: { icon: FileArchiveIcon, color: '#8E8E93' },
  tar: { icon: FileArchiveIcon, color: '#8E8E93' },
  bz2: { icon: FileArchiveIcon, color: '#8E8E93' },
  xz: { icon: FileArchiveIcon, color: '#8E8E93' },
  '7z': { icon: FileArchiveIcon, color: '#8E8E93' },
  rar: { icon: FileArchiveIcon, color: '#8E8E93' },
  tgz: { icon: FileArchiveIcon, color: '#8E8E93' },

  // Lock
  lock: { icon: FileLockIcon, color: '#8E8E93' },

  // Binary / Compiled
  exe: { icon: FileCodeIcon, color: '#8E8E93' },
  dll: { icon: FileCodeIcon, color: '#8E8E93' },
  so: { icon: FileCodeIcon, color: '#8E8E93' },
  dylib: { icon: FileCodeIcon, color: '#8E8E93' },
  o: { icon: FileCodeIcon, color: '#8E8E93' },
  a: { icon: FileCodeIcon, color: '#8E8E93' },
  class: { icon: FileCodeIcon, color: '#8E8E93' },
  pyc: { icon: FileCodeIcon, color: '#8E8E93' },
  wasm: { icon: FileCodeIcon, color: '#654FF0' },

  // Fonts
  ttf: { icon: FileTextIcon, color: '#A77BCA' },
  otf: { icon: FileTextIcon, color: '#A77BCA' },
  woff: { icon: FileTextIcon, color: '#A77BCA' },
  woff2: { icon: FileTextIcon, color: '#A77BCA' },
  eot: { icon: FileTextIcon, color: '#A77BCA' },
}

const FILENAME_MAP: Record<string, FileIconConfig> = {
  dockerfile: { icon: FileCodeIcon, color: '#2496ED' },
  makefile: { icon: FileCodeIcon, color: '#8E8E93' },
  cmakelists: { icon: FileCodeIcon, color: '#8E8E93' },
  rakefile: { icon: FileCodeIcon, color: '#CC342D' },
  gemfile: { icon: FileCodeIcon, color: '#CC342D' },
  procfile: { icon: FileCodeIcon, color: '#6E4A7E' },
  justfile: { icon: FileCodeIcon, color: '#8E8E93' },
  '.gitignore': { icon: FileIniIcon, color: '#F05033' },
  '.gitattributes': { icon: FileIniIcon, color: '#F05033' },
  '.gitmodules': { icon: FileIniIcon, color: '#F05033' },
  '.dockerignore': { icon: FileIniIcon, color: '#2496ED' },
  '.eslintignore': { icon: FileIniIcon, color: '#4B32C3' },
  '.prettierignore': { icon: FileIniIcon, color: '#F7B93E' },
  '.env': { icon: FileLockIcon, color: '#EAB308' },
  '.env.local': { icon: FileLockIcon, color: '#EAB308' },
  '.env.example': { icon: FileIniIcon, color: '#EAB308' },
  '.editorconfig': { icon: FileIniIcon, color: '#8E8E93' },
  '.npmrc': { icon: FileIniIcon, color: '#CB3837' },
  '.nvmrc': { icon: FileIniIcon, color: '#34D399' },
  license: { icon: FileTextIcon, color: '#EAB308' },
  'license.md': { icon: FileTextIcon, color: '#EAB308' },
  'license.txt': { icon: FileTextIcon, color: '#EAB308' },
  changelog: { icon: FileMdIcon, color: '#8E8E93' },
  'changelog.md': { icon: FileMdIcon, color: '#8E8E93' },
  readme: { icon: FileMdIcon, color: '#60A5FA' },
  'readme.md': { icon: FileMdIcon, color: '#60A5FA' },
}

const TEST_CONFIG: FileIconConfig = { icon: FileCodeIcon, color: '#34D399' }
const DEFAULT_CONFIG: FileIconConfig = { icon: FileIcon, color: 'var(--text-muted)' }

function isTestFile(filename: string): boolean {
  const lower = filename.toLowerCase()
  return (
    lower.includes('.test.') ||
    lower.includes('.spec.') ||
    lower.includes('.e2e.') ||
    lower.startsWith('test_') ||
    lower.endsWith('_test.py') ||
    lower.endsWith('_test.go')
  )
}

function getExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex <= 0) return ''
  return filename.slice(dotIndex + 1).toLowerCase()
}

export function getFileIconConfig(filename: string): FileIconConfig {
  const lower = filename.toLowerCase()

  if (isTestFile(lower)) {
    return TEST_CONFIG
  }

  const filenameConfig = FILENAME_MAP[lower]
  if (filenameConfig) {
    return filenameConfig
  }

  const ext = getExtension(filename)
  return ICON_MAP[ext] ?? DEFAULT_CONFIG
}

export function getFileIcon(filename: string, size: number = ICON_SIZE): React.ReactElement {
  const { icon: IconComponent, color } = getFileIconConfig(filename)
  return <IconComponent size={size} weight="fill" style={{ color, flexShrink: 0 }} />
}

export function FolderIcon({ size = ICON_SIZE, isOpen = false }: { size?: number; isOpen?: boolean }) {
  const IconComp = isOpen ? FolderOpenIconBase : FolderIconBase
  return <IconComp size={size} weight="fill" style={{ color: 'var(--accent)', flexShrink: 0, opacity: 0.85 }} />
}
