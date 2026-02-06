import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from './users.entity'
import { UserController } from './users.controller'
import { UserRepository } from './users.repository'
import { UserSeeder } from './users.seeder'
import { UserService } from './users.service'

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [UserService, UserRepository, UserSeeder],
  exports: [UserService, UserRepository, UserSeeder],
})
export class UsersModule {}
