import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
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
      { email: 'admin@spaceflix.local', password: 'password123' },
      { email: 'user@spaceflix.local', password: 'password123' },
    ]

    await this.userRepository.save(users)

    this.logger.log(`Seeded ${users.length} users`)
  }
}
