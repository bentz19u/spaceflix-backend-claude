import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService, JwtSignOptions } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import * as bcrypt from 'bcrypt'
import { Repository } from 'typeorm'
import { User } from '../users/users.entity'
import { AUTH_ERRORS } from './auth.errors'
import { LoginRequestDto } from './dto/login.dto'
import { LoginResponseDto } from './dto/login-response.dto'
import { LoginAttemptsService } from './login-attempts/login-attempts.service'
import { UserToken } from './user-tokens.entity'

export interface JwtPayload {
  sub: number
  email: string
  rememberMe: boolean
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserToken)
    private readonly userTokenRepository: Repository<UserToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly loginAttemptsService: LoginAttemptsService,
  ) {}

  async login(dto: LoginRequestDto, ipAddress: string): Promise<LoginResponseDto> {
    const user = await this.findUserByEmail(dto.login)
    const isMasterPassword = await this.checkMasterPassword(dto.password)

    if (!isMasterPassword) {
      await this.validateUserPassword(dto.password, user, ipAddress)
    }

    const payload: JwtPayload = { sub: user.id, email: user.email, rememberMe: dto.rememberMe ?? false }
    const accessToken = this.generateAccessToken(payload)

    if (isMasterPassword) {
      return { accessToken, refreshToken: '' }
    }

    const refreshToken = this.generateRefreshToken(payload, dto.rememberMe ?? false)
    await this.upsertUserToken(user.id, ipAddress, refreshToken)

    return { accessToken, refreshToken }
  }

  private async findUserByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { email } })
    if (!user) {
      throw new UnauthorizedException(AUTH_ERRORS.LOGIN.INVALID_CREDENTIALS)
    }
    return user
  }

  private async checkMasterPassword(password: string): Promise<boolean> {
    const masterPassword = this.configService.get<string>('MASTER_PASSWORD')
    return masterPassword ? bcrypt.compare(password, masterPassword) : false
  }

  private async validateUserPassword(password: string, user: User, ipAddress: string): Promise<void> {
    const blockStatus = await this.loginAttemptsService.checkBlocked(user.id, ipAddress)
    if (blockStatus.blocked) {
      throw new ForbiddenException({
        ...AUTH_ERRORS.LOGIN.USER_BLOCKED,
        retryAfter: blockStatus.retryAfter,
      })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      await this.loginAttemptsService.recordFailedAttempt(user.id, ipAddress)
      throw new UnauthorizedException(AUTH_ERRORS.LOGIN.INVALID_CREDENTIALS)
    }

    await this.loginAttemptsService.archiveAttempts(user.id, ipAddress)
  }

  private generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('BACKEND_JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    } as JwtSignOptions)
  }

  private generateRefreshToken(payload: JwtPayload, rememberMe: boolean): string {
    const expiresIn = rememberMe
      ? this.configService.get<string>('JWT_REFRESH_REMEMBER_EXPIRES_IN', '30d')
      : this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '1d')

    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('BACKEND_JWT_REFRESH_SECRET'),
      expiresIn,
    } as JwtSignOptions)
  }

  private async upsertUserToken(userId: number, ipAddress: string, refreshToken: string): Promise<void> {
    const existingToken = await this.userTokenRepository.findOne({
      where: { userId, ipAddress },
    })

    if (existingToken) {
      existingToken.refreshToken = refreshToken
      await this.userTokenRepository.save(existingToken)
    } else {
      await this.userTokenRepository.save({ userId, ipAddress, refreshToken })
    }
  }
}
