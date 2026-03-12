/**
 * Progress bar example
 *
 * Demonstrates creating terminal progress bars with Unicode support.
 */

import { padToWidth, stringWidth } from '@lpm.dev/neo.string-width'

console.log('=== Progress Bar Examples ===\n')

// Simple progress bar
function progressBar(percent: number, width: number = 40): string {
  const filled = Math.floor((width * percent) / 100)
  const empty = width - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  return `[${bar}] ${percent}%`
}

console.log('Simple progress bars:')
console.log(progressBar(0, 30))
console.log(progressBar(25, 30))
console.log(progressBar(50, 30))
console.log(progressBar(75, 30))
console.log(progressBar(100, 30))

// Progress bar with label
function progressBarWithLabel(label: string, percent: number, width: number = 40): string {
  const labelWidth = 20
  const labelPadded = padToWidth(label, labelWidth)
  const filled = Math.floor((width * percent) / 100)
  const empty = width - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  const percentText = padToWidth(`${percent}%`, 5, { align: 'right' })
  return `${labelPadded} [${bar}] ${percentText}`
}

console.log('\nProgress bars with labels:')
console.log(progressBarWithLabel('Download', 0, 30))
console.log(progressBarWithLabel('Extract', 45, 30))
console.log(progressBarWithLabel('Install', 80, 30))
console.log(progressBarWithLabel('Complete', 100, 30))

// Unicode/CJK labels
console.log('\nWith CJK labels:')
console.log(progressBarWithLabel('下载', 30, 30))
console.log(progressBarWithLabel('安装', 60, 30))
console.log(progressBarWithLabel('完成', 100, 30))

// Animated progress bar simulation
console.log('\nAnimated simulation (100 frames):')

function simulateProgress() {
  // Clear screen
  process.stdout.write('\x1b[2J\x1b[0f')

  const tasks = [
    { name: 'Downloading packages', speed: 2 },
    { name: '正在编译源码', speed: 1.5 },
    { name: 'Running tests', speed: 2.5 },
  ]

  let frame = 0
  const totalFrames = 100

  const interval = setInterval(() => {
    // Clear and reposition cursor
    process.stdout.write('\x1b[2J\x1b[0f')

    console.log('=== Building Project ===\n')

    for (const task of tasks) {
      const progress = Math.min(100, (frame * task.speed) % 100)
      console.log(progressBarWithLabel(task.name, Math.floor(progress), 40))
    }

    console.log(`\nFrame: ${frame}/${totalFrames}`)

    frame++
    if (frame > totalFrames) {
      clearInterval(interval)
      console.log('\n✅ All tasks completed!')
    }
  }, 50)
}

// Uncomment to run animation
// simulateProgress()

// Spinner with label
function spinner(label: string, frame: number): string {
  const spinners = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  const spinner = spinners[frame % spinners.length]!
  const labelPadded = padToWidth(label, 30)
  return `${spinner} ${labelPadded}`
}

console.log('\nSpinner animation frames:')
for (let i = 0; i < 10; i++) {
  console.log(spinner('Loading...', i))
}

// Multi-step progress indicator
interface Step {
  name: string
  status: 'pending' | 'active' | 'completed' | 'error'
}

function stepIndicator(steps: Step[]): string[] {
  const result: string[] = []

  for (const [index, step] of steps.entries()) {
    const icons = {
      pending: '○',
      active: '●',
      completed: '✓',
      error: '✗',
    }

    const colors = {
      pending: '\x1b[90m', // Gray
      active: '\x1b[36m', // Cyan
      completed: '\x1b[32m', // Green
      error: '\x1b[31m', // Red
    }

    const reset = '\x1b[0m'
    const icon = icons[step.status]
    const color = colors[step.status]
    const name = padToWidth(step.name, 25)

    result.push(`${color}${icon} ${name}${reset}`)
  }

  return result
}

console.log('\nMulti-step progress:')
const steps: Step[] = [
  { name: 'Initialize', status: 'completed' },
  { name: 'Install dependencies', status: 'completed' },
  { name: 'Build project 构建项目', status: 'active' },
  { name: 'Run tests', status: 'pending' },
  { name: 'Deploy', status: 'pending' },
]

for (const line of stepIndicator(steps)) {
  console.log(line)
}
