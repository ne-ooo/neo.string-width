/**
 * Terminal table formatting example
 *
 * Demonstrates using truncateToWidth and padToWidth to create
 * perfectly aligned terminal tables with Unicode support.
 */

import { padToWidth, truncateToWidth } from '@lpm.dev/neo.string-width'

// Sample data with mixed ASCII, CJK, and emoji
const users = [
  { name: 'John Doe', age: 28, status: '✅ Active', location: 'New York' },
  { name: '李明', age: 32, status: '⏸️  Paused', location: '北京' },
  { name: 'María García', age: 24, status: '✅ Active', location: 'Madrid' },
  { name: '山田太郎', age: 45, status: '❌ Inactive', location: '東京' },
  { name: 'Very Long Name That Needs Truncation', age: 19, status: '✅ Active', location: 'London' },
]

console.log('=== Terminal Table Formatting ===\n')

// Column widths
const COL_NAME = 20
const COL_AGE = 5
const COL_STATUS = 12
const COL_LOCATION = 15

// Table header
const header = [
  '│',
  padToWidth('Name', COL_NAME),
  '│',
  padToWidth('Age', COL_AGE, { align: 'center' }),
  '│',
  padToWidth('Status', COL_STATUS),
  '│',
  padToWidth('Location', COL_LOCATION),
  '│',
].join(' ')

// Top border
const totalWidth = header.length - 2
const topBorder = '┌' + '─'.repeat(totalWidth) + '┐'
const separator = '├' + '─'.repeat(totalWidth) + '┤'
const bottomBorder = '└' + '─'.repeat(totalWidth) + '┘'

console.log(topBorder)
console.log(header)
console.log(separator)

// Table rows
for (const user of users) {
  const nameCell = padToWidth(truncateToWidth(user.name, COL_NAME), COL_NAME)
  const ageCell = padToWidth(user.age.toString(), COL_AGE, { align: 'center' })
  const statusCell = padToWidth(user.status, COL_STATUS)
  const locationCell = padToWidth(truncateToWidth(user.location, COL_LOCATION), COL_LOCATION)

  const row = [
    '│',
    nameCell,
    '│',
    ageCell,
    '│',
    statusCell,
    '│',
    locationCell,
    '│',
  ].join(' ')

  console.log(row)
}

console.log(bottomBorder)

// Another example: Simple aligned output
console.log('\n=== Simple Aligned Output ===\n')

const items = [
  { label: 'CPU Usage', value: '45%' },
  { label: 'Memory', value: '2.3 GB / 8 GB' },
  { label: 'Disk', value: '234 GB / 500 GB' },
  { label: 'Network 网络', value: '↓ 1.2 MB/s ↑ 0.3 MB/s' },
]

for (const item of items) {
  const label = padToWidth(item.label, 20)
  const value = padToWidth(item.value, 30, { align: 'right' })
  console.log(`${label} : ${value}`)
}

// Key-value pairs with dots
console.log('\n=== Key-Value with Dots ===\n')

const config = [
  { key: 'Package Name', value: '@lpm.dev/neo.string-width' },
  { key: 'Version 版本', value: '1.0.0' },
  { key: 'License', value: 'MIT' },
  { key: 'Author', value: 'Your Name' },
]

const maxKeyWidth = 25
const maxTotalWidth = 60

for (const { key, value } of config) {
  const keyPadded = padToWidth(key, maxKeyWidth)
  const dotsNeeded = maxTotalWidth - maxKeyWidth - value.length
  const dots = '.'.repeat(Math.max(0, dotsNeeded))
  console.log(`${keyPadded}${dots}${value}`)
}
