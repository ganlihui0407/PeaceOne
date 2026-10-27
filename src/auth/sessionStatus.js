export const ACCOUNT_UNAVAILABLE_ERROR = 'Account is unavailable'
export const ACCOUNT_UNAVAILABLE_MESSAGE = 'This account is unavailable.'

export function interpretCurrentUserError(err) {
  if (err?.status === 401) {
    return 'unauthenticated'
  }

  if (err?.status === 403 && err.message === ACCOUNT_UNAVAILABLE_ERROR) {
    return 'unavailable'
  }

  return 'error'
}
