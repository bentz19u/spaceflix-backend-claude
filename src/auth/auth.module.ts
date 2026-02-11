import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '../users/users.entity'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { LoginAttempt } from './login-attempts/login-attempts.entity'
import { LoginAttemptsService } from './login-attempts/login-attempts.service'
import { UserToken } from './user-tokens.entity'

@Module({
  imports: [TypeOrmModule.forFeature([User, UserToken, LoginAttempt]), JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, LoginAttemptsService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
