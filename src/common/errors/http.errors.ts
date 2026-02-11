import { HttpStatus } from '@nestjs/common'

export const HTTP_ERRORS: Record<number, { code: string; description: string }> = {
  [HttpStatus.UNAUTHORIZED]: {
    code: 'http-0401',
    description: 'Unauthorized. Please provide valid credentials.',
  },
  [HttpStatus.FORBIDDEN]: {
    code: 'http-0403',
    description: 'Forbidden. You do not have permission to access this resource.',
  },
  [HttpStatus.NOT_FOUND]: {
    code: 'http-0404',
    description: 'Resource not found.',
  },
  [HttpStatus.INTERNAL_SERVER_ERROR]: {
    code: 'http-0500',
    description: 'Internal server error. Please try again later.',
  },
}
