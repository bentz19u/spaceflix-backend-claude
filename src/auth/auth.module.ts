import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from '../users/users.entity'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { UserToken } from './user-tokens.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserToken]),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
