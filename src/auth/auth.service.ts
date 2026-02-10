import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService, JwtSignOptions } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import * as bcrypt from 'bcrypt'
import { Repository } from 'typeorm'
import { User } from '../users/users.entity'
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
    const user = await this.userRepository.findOne({
      where: { email: dto.login },
    })

    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    // Check if user is blocked for this IP
    const blockStatus = await this.loginAttemptsService.checkBlocked(user.id, ipAddress)
    if (blockStatus.blocked) {
      throw new ForbiddenException({
        message: 'Too many failed attempts',
        retryAfter: blockStatus.retryAfter,
      })
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password)

    if (!isPasswordValid) {
      await this.loginAttemptsService.recordFailedAttempt(user.id, ipAddress)
      throw new UnauthorizedException('Invalid credentials')
    }

    // Archive previous failed attempts on successful login
    await this.loginAttemptsService.archiveAttempts(user.id, ipAddress)

    const payload: JwtPayload = { sub: user.id, email: user.email, rememberMe: dto.rememberMe ?? false }

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('BACKEND_JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    } as JwtSignOptions)

    const refreshExpiresIn = dto.rememberMe
      ? this.configService.get<string>('JWT_REFRESH_REMEMBER_EXPIRES_IN', '30d')
      : this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '1d')

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('BACKEND_JWT_REFRESH_SECRET'),
      expiresIn: refreshExpiresIn,
    } as JwtSignOptions)

    // Upsert token: update existing token for same user+IP or create new
    await this.upsertUserToken(user.id, ipAddress, refreshToken)

    return { accessToken, refreshToken }
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
