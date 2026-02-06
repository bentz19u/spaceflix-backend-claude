import { Module } from '@nestjs/common'
import { UsersModule } from '../users/users.module'
import { SeedersService } from './seeders.service'

@Module({
  imports: [UsersModule],
  providers: [SeedersService],
})
export class DatabaseModule {}
