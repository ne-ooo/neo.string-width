/**
 * File path truncation example
 *
 * Demonstrates using truncateToWidth to shorten file paths for display.
 */

import { truncateToWidth } from '@lpm.dev/neo.string-width'

console.log('=== File Path Truncation Examples ===\n')

// Sample file paths
const paths = [
  '/Users/john/Documents/Projects/my-awesome-project/src/components/Button.tsx',
  '/var/www/html/wordpress/wp-content/themes/twentytwentyfour/index.php',
  'C:\\Users\\Admin\\AppData\\Local\\Programs\\Python\\Python311\\python.exe',
  '/home/user/很长的中文路径/非常长的文件夹名称/文件.txt',
  '~/Documents/项目/代码/组件/按钮组件.tsx',
]

// Truncate at end (default)
console.log('Truncate at END (default):')
for (const path of paths) {
  console.log(`Original: ${path}`)
  console.log(`Truncated (50): ${truncateToWidth(path, 50)}`)
  console.log(`Truncated (30): ${truncateToWidth(path, 30)}`)
  console.log()
}

// Truncate at start
console.log('\nTruncate at START:')
for (const path of paths) {
  console.log(`Original: ${path}`)
  console.log(`Truncated (50): ${truncateToWidth(path, 50, { position: 'start' })}`)
  console.log(`Truncated (30): ${truncateToWidth(path, 30, { position: 'start' })}`)
  console.log()
}

// Truncate at middle
console.log('\nTruncate at MIDDLE:')
for (const path of paths) {
  console.log(`Original: ${path}`)
  console.log(`Truncated (50): ${truncateToWidth(path, 50, { position: 'middle' })}`)
  console.log(`Truncated (30): ${truncateToWidth(path, 30, { position: 'middle' })}`)
  console.log()
}

// Custom ellipsis
console.log('\nWith custom ellipsis:')
const customPath = '/very/long/path/to/some/file/that/exceeds/the/limit.txt'
console.log(`Original: ${customPath}`)
console.log(`Ellipsis "...": ${truncateToWidth(customPath, 40, { ellipsis: '...' })}`)
console.log(`Ellipsis ".": ${truncateToWidth(customPath, 40, { ellipsis: '.' })}`)
console.log(`Ellipsis " ": ${truncateToWidth(customPath, 40, { ellipsis: ' ' })}`)
console.log()

// File list display
console.log('\n=== File List Display ===\n')

interface FileInfo {
  path: string
  size: string
  modified: string
}

const files: FileInfo[] = [
  {
    path: '/Users/john/Documents/Projects/very-long-project-name/src/components/Button.tsx',
    size: '2.3 KB',
    modified: '2024-02-19',
  },
  {
    path: '/Users/john/Documents/简短路径/文件.txt',
    size: '1.1 MB',
    modified: '2024-02-18',
  },
  {
    path: '/var/www/html/wordpress-site/wp-content/uploads/images/photo.jpg',
    size: '450 KB',
    modified: '2024-02-17',
  },
]

const maxPathWidth = 60

console.log('┌' + '─'.repeat(maxPathWidth + 2) + '┬' + '─'.repeat(12) + '┬' + '─'.repeat(14) + '┐')
console.log('│ ' + 'Path'.padEnd(maxPathWidth) + ' │ ' + 'Size'.padEnd(10) + ' │ ' + 'Modified'.padEnd(12) + ' │')
console.log('├' + '─'.repeat(maxPathWidth + 2) + '┼' + '─'.repeat(12) + '┼' + '─'.repeat(14) + '┤')

for (const file of files) {
  const path = truncateToWidth(file.path, maxPathWidth, { position: 'middle' }).padEnd(maxPathWidth)
  const size = file.size.padEnd(10)
  const modified = file.modified.padEnd(12)
  console.log(`│ ${path} │ ${size} │ ${modified} │`)
}

console.log('└' + '─'.repeat(maxPathWidth + 2) + '┴' + '─'.repeat(12) + '┴' + '─'.repeat(14) + '┘')

// Breadcrumb navigation
console.log('\n=== Breadcrumb Navigation ===\n')

function createBreadcrumb(path: string, maxWidth: number): string {
  const parts = path.split('/')
  let breadcrumb = parts.join(' › ')

  if (breadcrumb.length > maxWidth) {
    // Try removing middle parts
    if (parts.length > 3) {
      breadcrumb = `${parts[0]} › … › ${parts[parts.length - 2]} › ${parts[parts.length - 1]}`
    }

    // If still too long, truncate
    if (breadcrumb.length > maxWidth) {
      breadcrumb = truncateToWidth(breadcrumb, maxWidth, { position: 'middle' })
    }
  }

  return breadcrumb
}

const longPath = '/Users/john/Documents/Projects/my-awesome-project/src/components/ui/Button'
console.log('Full path:', longPath)
console.log('Breadcrumb (80 cols):', createBreadcrumb(longPath, 80))
console.log('Breadcrumb (60 cols):', createBreadcrumb(longPath, 60))
console.log('Breadcrumb (40 cols):', createBreadcrumb(longPath, 40))
console.log('Breadcrumb (30 cols):', createBreadcrumb(longPath, 30))

// Git status display
console.log('\n=== Git Status Display ===\n')

interface GitFile {
  status: string
  path: string
}

const gitFiles: GitFile[] = [
  { status: 'M', path: 'src/components/Button.tsx' },
  { status: 'A', path: 'src/components/new-feature/VeryLongComponentNameHere.tsx' },
  { status: 'D', path: 'old/deprecated/legacy-code-to-remove.ts' },
  { status: 'M', path: '中文路径/组件/按钮.tsx' },
]

const maxGitPathWidth = 50

console.log('Changes not staged for commit:')
for (const file of gitFiles) {
  const statusColor = {
    M: '\x1b[33m', // Yellow
    A: '\x1b[32m', // Green
    D: '\x1b[31m', // Red
  }[file.status] || '\x1b[0m'

  const path = truncateToWidth(file.path, maxGitPathWidth, { position: 'middle' })
  console.log(`  ${statusColor}${file.status}\x1b[0m  ${path}`)
}

// Command output truncation
console.log('\n=== Command Output Truncation ===\n')

const commands = [
  'npm install @very-long-organization-name/super-long-package-name-here',
  'git clone https://github.com/organization/very-long-repository-name.git',
  'docker run --name my-container -p 8080:80 -v /very/long/path/to/volume:/app image:latest',
]

console.log('Terminal width: 60 columns\n')
for (const cmd of commands) {
  console.log(`$ ${truncateToWidth(cmd, 55)}`)
}
