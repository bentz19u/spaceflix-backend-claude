import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { Request } from 'express'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { JwtPayload } from '../auth.service'

export interface JwtRefreshPayload extends JwtPayload {
  refreshToken: string
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('BACKEND_JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    })
  }

  validate(req: Request, payload: JwtPayload): JwtRefreshPayload {
    const refreshToken = req.headers.authorization?.split(' ')[1] ?? ''
    return { ...payload, refreshToken }
  }
}
