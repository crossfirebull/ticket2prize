export type DomainErrorCode =
  | 'not_found'
  | 'already_claimed'
  | 'insufficient_tickets'
  | 'out_of_stock'
  | 'email_taken'
  | 'invalid_state'
  | 'invalid_input'

/** An expected failure with a message that's safe to show the user. */
export class DomainError extends Error {
  constructor(
    public code: DomainErrorCode,
    message: string,
  ) {
    super(message)
  }
}
