import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'
import { LoginAttempt } from './login-attempts.entity'

export interface BlockStatus {
  blocked: boolean
  retryAfter?: Date
}

@Injectable()
export class LoginAttemptsService {
  constructor(
    @InjectRepository(LoginAttempt)
    private readonly loginAttemptRepository: Repository<LoginAttempt>,
  ) {}

  async checkBlocked(userId: number, ipAddress: string): Promise<BlockStatus> {
    const attempt = await this.loginAttemptRepository.findOne({
      where: { userId, ipAddress, archivedAt: IsNull() },
    })

    if (!attempt || !attempt.blockedUntil) {
      return { blocked: false }
    }

    if (attempt.blockedUntil > new Date()) {
      return { blocked: true, retryAfter: attempt.blockedUntil }
    }

    return { blocked: false }
  }

  async recordFailedAttempt(userId: number, ipAddress: string): Promise<void> {
    let attempt = await this.loginAttemptRepository.findOne({
      where: { userId, ipAddress, archivedAt: IsNull() },
    })

    if (attempt) {
      attempt.failedCount += 1
    } else {
      attempt = this.loginAttemptRepository.create({
        userId,
        ipAddress,
        failedCount: 1,
      })
    }

    attempt.blockedUntil = this.calculateBlockedUntil(attempt.failedCount)
    await this.loginAttemptRepository.save(attempt)
  }

  async archiveAttempts(userId: number, ipAddress: string): Promise<void> {
    await this.loginAttemptRepository.update(
      { userId, ipAddress, archivedAt: IsNull() },
      { archivedAt: new Date() },
    )
  }

  private calculateBlockedUntil(failedCount: number): Date | null {
    if (failedCount < 3) {
      return null
    }

    // 3 fails = 5min, 4 fails = 10min, 5 fails = 20min (doubling pattern)
    const minutes = 5 * Math.pow(2, failedCount - 3)
    const blockedUntil = new Date()
    blockedUntil.setMinutes(blockedUntil.getMinutes() + minutes)
    return blockedUntil
  }
}
