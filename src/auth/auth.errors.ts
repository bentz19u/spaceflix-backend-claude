export const AUTH_ERRORS = {
  LOGIN: {
    USER_BLOCKED: {
      code: 'auth-login-0001',
      description: 'Too many failed attempts. Please wait before trying again.',
    },
    INVALID_CREDENTIALS: {
      code: 'auth-login-0002',
      description: 'Invalid credentials. Please check your email and password.',
    },
    MISSING_REMOTE_ADDR: {
      code: 'auth-login-0003',
      description: 'Missing remote_addr header. Please contact support.',
    },
  },
  LOGOUT: {
    MISSING_REMOTE_ADDR: {
      code: 'auth-logout-0001',
      description: 'Missing remote_addr header. Please contact support.',
    },
  },
}
