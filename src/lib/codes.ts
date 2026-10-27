import { randomBytes, randomInt } from 'node:crypto'

// No 0/O/1/I/L so codes can be read aloud at the counter without confusion.
const PICKUP_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

/** 96 random bits: stubs can't be guessed or enumerated. */
export const newStubCode = () => randomBytes(12).toString('base64url')

export const newPickupCode = (length = 6) =>
  Array.from({ length }, () => PICKUP_ALPHABET[randomInt(PICKUP_ALPHABET.length)]).join('')
