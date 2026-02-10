import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { I18nValidationExceptionFilter, I18nValidationPipe } from 'nestjs-i18n'
import * as bcrypt from 'bcrypt'
import { AppModule } from '../src/app.module'
import { User } from '../src/users/users.entity'
import { UserToken } from '../src/auth/user-tokens.entity'

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource

  const testUser = {
    email: 'auth-test@spaceflix.local',
    password: 'password123',
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new I18nValidationPipe({ transform: true }))
    app.useGlobalFilters(new I18nValidationExceptionFilter())
    await app.init()

    dataSource = moduleFixture.get(DataSource)

    // Insert test user with hashed password
    const userRepository = dataSource.getRepository(User)
    const hashedPassword = await bcrypt.hash(testUser.password, 10)
    const user = userRepository.create({
      email: testUser.email,
      password: hashedPassword,
    })
    await userRepository.save(user)
  })

  afterAll(async () => {
    const userRepository = dataSource.getRepository(User)
    const userTokenRepository = dataSource.getRepository(UserToken)

    // Clean up tokens first (foreign key constraint)
    const user = await userRepository.findOne({ where: { email: testUser.email } })
    if (user) {
      await userTokenRepository.delete({ userId: user.id })
    }

    // Clean up test user
    await userRepository
      .createQueryBuilder()
      .delete()
      .where('email = :email', { email: testUser.email })
      .execute()

    await app.close()
  })

  describe('POST /auth/login', () => {
    it('should return access and refresh tokens on successful login', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ login: testUser.email, password: testUser.password })
        .expect(200)

      expect(response.body).toHaveProperty('accessToken')
      expect(response.body).toHaveProperty('refreshToken')
      expect(typeof response.body.accessToken).toBe('string')
      expect(typeof response.body.refreshToken).toBe('string')
    })

    it('should save refresh token to database on login', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ login: testUser.email, password: testUser.password })
        .expect(200)

      const userRepository = dataSource.getRepository(User)
      const userTokenRepository = dataSource.getRepository(UserToken)

      const user = await userRepository.findOne({ where: { email: testUser.email } })
      const savedToken = await userTokenRepository.findOne({
        where: { userId: user!.id, refreshToken: response.body.refreshToken },
      })

      expect(savedToken).not.toBeNull()
      expect(savedToken!.refreshToken).toBe(response.body.refreshToken)
    })

    it('should return 401 when email does not exist', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ login: 'nonexistent@spaceflix.local', password: 'password123' })
        .expect(401)
    })

    it('should return 401 when password is incorrect', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ login: testUser.email, password: 'wrongpassword' })
        .expect(401)
    })

    it('should return 400 when login is missing', () => {
      return request(app.getHttpServer()).post('/auth/login').send({ password: 'password123' }).expect(400)
    })

    it('should return 400 when password is missing', () => {
      return request(app.getHttpServer()).post('/auth/login').send({ login: testUser.email }).expect(400)
    })

    it('should return 400 when login is not a valid email', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ login: 'invalid-email', password: 'password123' })
        .expect(400)
    })

    it('should accept rememberMe parameter', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ login: testUser.email, password: testUser.password, rememberMe: true })
        .expect(200)

      expect(response.body).toHaveProperty('accessToken')
      expect(response.body).toHaveProperty('refreshToken')
    })
  })
})
