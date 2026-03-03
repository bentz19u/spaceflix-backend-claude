import { ConflictException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import * as bcrypt from 'bcrypt'
import { Repository } from 'typeorm'
import { CreateUserRequestDto } from './dto/create-user.dto'
import { IsRegistrableResponseDto } from './dto/is-registrable.dto'
import { RegisterStep1RequestDto, RegisterStep1ResponseDto } from './dto/register-step1.dto'
import { User } from './users.entity'
import { USERS_ERRORS } from './users.errors'

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

  async registerStep1(dto: RegisterStep1RequestDto): Promise<RegisterStep1ResponseDto> {
    const registrable = await this.checkRegistrable(dto.email)

    if (!registrable.isAvailable && !registrable.canActivate) {
      throw new ConflictException(USERS_ERRORS.REGISTER.EMAIL_NOT_AVAILABLE)
    }

    return { canActivate: registrable.canActivate }
  }

  async create(dto: CreateUserRequestDto): Promise<number> {
    const registrable = await this.checkRegistrable(dto.email)

    if (!registrable.isAvailable && !registrable.canActivate) {
      throw new ConflictException(USERS_ERRORS.REGISTER.EMAIL_NOT_AVAILABLE)
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10)

    const user = this.userRepository.create({
      email: dto.email,
      password: hashedPassword,
      plan: dto.plan,
    })

    const savedUser = await this.userRepository.save(user)
    return savedUser.id
  }
}
