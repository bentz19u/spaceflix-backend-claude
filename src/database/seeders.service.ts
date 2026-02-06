import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { UserSeeder } from '../users/users.seeder'

@Injectable()
export class SeedersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedersService.name)

  constructor(
    private readonly configService: ConfigService,
    private readonly userSeeder: UserSeeder,
  ) {}

  private get seeders() {
    return [
      this.userSeeder,
      // Add more seeders here in order
    ]
  }

  async onApplicationBootstrap(): Promise<void> {
    const environment = this.configService.get<string>('NODE_ENV')

    if (environment !== 'local') {
      return
    }

    this.logger.log('Running seeders...')

    for (const seeder of this.seeders) {
      await seeder.seed()
    }

    this.logger.log('Seeding complete')
  }
}
