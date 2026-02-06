import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { IsRegistrableResponseDto } from './dto/is-registrable.dto'
import { User } from './users.entity'

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async checkRegistrable(email: string): Promise<IsRegistrableResponseDto> {
    const user = await this.userRepository.findOne({
      where: { email },
      withDeleted: true,
    })

    if (!user) {
      return { isAvailable: true, canActivate: false }
    }

    if (user.deletedAt) {
      return { isAvailable: false, canActivate: true }
    }

    return { isAvailable: false, canActivate: false }
  }
}
