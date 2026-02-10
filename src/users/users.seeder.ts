import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import * as bcrypt from 'bcrypt'
import { Repository } from 'typeorm'
import { User } from './users.entity'

@Injectable()
export class UserSeeder {
  private readonly logger = new Logger(UserSeeder.name)

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async seed(): Promise<void> {
    const count = await this.userRepository.count()

    if (count > 0) {
      return
    }

    this.logger.log('Seeding users...')

    const users = [
      { email: 'admin@spaceflix.local', password: await bcrypt.hash('password123', 10) },
      { email: 'user@spaceflix.local', password: await bcrypt.hash('password123', 10) },
    ]

    await this.userRepository.save(users)

    this.logger.log(`Seeded ${users.length} users`)
  }
}
