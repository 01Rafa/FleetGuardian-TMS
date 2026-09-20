import { randomInt } from 'node:crypto'

// No 0/O, 1/l/I so the password can be read out or typed without mistakes.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnpqrstuvwxyz'
const DIGITS = '23456789'
const ALL = UPPER + LOWER + DIGITS

const pick = set => set[randomInt(set.length)]

// Random one-time password for invited users. Always has an upper, a lower and a digit.
export function generateTempPassword(length = 12) {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS)]
  while (chars.length < length) chars.push(pick(ALL))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
