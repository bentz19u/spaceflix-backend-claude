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
import { LoginAttempt } from '../src/auth/login-attempts/login-attempts.entity'
import { LoginResponseDto } from '../src/auth/dto/login-response.dto'
import { ErrorResponseDto } from '../src/common/dto/error-response.dto'

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource

  const testIp = '192.168.1.100'
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
    const loginAttemptRepository = dataSource.getRepository(LoginAttempt)

    // Clean up tokens and login attempts first (foreign key constraint)
    const user = await userRepository.findOne({ where: { email: testUser.email } })
    if (user) {
      await userTokenRepository.delete({ userId: user.id })
      await loginAttemptRepository.delete({ userId: user.id })
    }

    // Clean up test user
    await userRepository.createQueryBuilder().delete().where('email = :email', { email: testUser.email }).execute()

    await app.close()
  })

  describe('POST /auth/login', () => {
    it('should return access and refresh tokens on successful login', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', testIp)
        .send({ login: testUser.email, password: testUser.password })
        .expect(200)

      const body = response.body as LoginResponseDto
      expect(body).toHaveProperty('accessToken')
      expect(body).toHaveProperty('refreshToken')
      expect(typeof body.accessToken).toBe('string')
      expect(typeof body.refreshToken).toBe('string')
    })

    it('should save refresh token with IP to database on login', async () => {
      const loginIp = '192.168.1.101'
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', loginIp)
        .send({ login: testUser.email, password: testUser.password })
        .expect(200)

      const userRepository = dataSource.getRepository(User)
      const userTokenRepository = dataSource.getRepository(UserToken)

      const user = await userRepository.findOne({ where: { email: testUser.email } })
      const savedToken = await userTokenRepository.findOne({
        where: { userId: user!.id, ipAddress: loginIp },
      })

      const body = response.body as LoginResponseDto
      expect(savedToken).not.toBeNull()
      expect(savedToken!.refreshToken).toBe(body.refreshToken)
      expect(savedToken!.ipAddress).toBe(loginIp)
    })

    it('should return 400 when remote_addr header is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ login: testUser.email, password: testUser.password })
        .expect(400)

      const body = response.body as ErrorResponseDto
      expect(body.code).toBe('auth-login-0003')
      expect(body.description).toBeDefined()
    })

    it('should return 401 when email does not exist', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', testIp)
        .send({ login: 'nonexistent@spaceflix.local', password: 'password123' })
        .expect(401)

      const body = response.body as ErrorResponseDto
      expect(body.code).toBe('auth-login-0002')
      expect(body.description).toBeDefined()
    })

    it('should return 401 when password is incorrect', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', testIp)
        .send({ login: testUser.email, password: 'wrongpassword' })
        .expect(401)

      const body = response.body as ErrorResponseDto
      expect(body.code).toBe('auth-login-0002')
      expect(body.description).toBeDefined()
    })

    it('should return 400 when login is missing', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', testIp)
        .send({ password: 'password123' })
        .expect(400)
    })

    it('should return 400 when password is missing', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', testIp)
        .send({ login: testUser.email })
        .expect(400)
    })

    it('should return 400 when login is not a valid email', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', testIp)
        .send({ login: 'invalid-email', password: 'password123' })
        .expect(400)
    })

    it('should accept rememberMe parameter', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', testIp)
        .send({ login: testUser.email, password: testUser.password, rememberMe: true })
        .expect(200)

      expect(response.body).toHaveProperty('accessToken')
      expect(response.body).toHaveProperty('refreshToken')
    })
  })

  describe('Login security', () => {
    const attackerIp = '10.0.0.1'

    beforeEach(async () => {
      // Clean up login attempts before each security test
      const userRepository = dataSource.getRepository(User)
      const loginAttemptRepository = dataSource.getRepository(LoginAttempt)
      const user = await userRepository.findOne({ where: { email: testUser.email } })
      if (user) {
        await loginAttemptRepository.delete({ userId: user.id })
      }
    })

    it('should block after 3 failed attempts', async () => {
      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .set('remote_addr', attackerIp)
          .send({ login: testUser.email, password: 'wrongpassword' })
          .expect(401)
      }

      // 4th attempt should be blocked even with correct password
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', attackerIp)
        .send({ login: testUser.email, password: testUser.password })
        .expect(403)

      const body = response.body as ErrorResponseDto
      expect(body.code).toBe('auth-login-0001')
      expect(body.description).toBeDefined()
      expect(body.retryAfter).toBeDefined()
    })

    it('should archive attempts after successful login', async () => {
      const archiveTestIp = '10.0.0.2'

      // Fail twice (not enough to block)
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .set('remote_addr', archiveTestIp)
          .send({ login: testUser.email, password: 'wrongpassword' })
          .expect(401)
      }

      // Successful login should archive attempts
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', archiveTestIp)
        .send({ login: testUser.email, password: testUser.password })
        .expect(200)

      // Verify attempt is archived
      const userRepository = dataSource.getRepository(User)
      const loginAttemptRepository = dataSource.getRepository(LoginAttempt)
      const user = await userRepository.findOne({ where: { email: testUser.email } })
      const archivedAttempt = await loginAttemptRepository.findOne({
        where: { userId: user!.id, ipAddress: archiveTestIp },
      })

      expect(archivedAttempt).not.toBeNull()
      expect(archivedAttempt!.archivedAt).not.toBeNull()
    })

    it('should allow login after archiving previous attempts', async () => {
      const freshStartIp = '10.0.0.3'

      // Fail twice
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .set('remote_addr', freshStartIp)
          .send({ login: testUser.email, password: 'wrongpassword' })
          .expect(401)
      }

      // Login successfully to archive
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', freshStartIp)
        .send({ login: testUser.email, password: testUser.password })
        .expect(200)

      // Fail twice again - should not be blocked (fresh start)
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .set('remote_addr', freshStartIp)
          .send({ login: testUser.email, password: 'wrongpassword' })
          .expect(401)
      }

      // Should still be able to login (only 2 fails since archive)
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', freshStartIp)
        .send({ login: testUser.email, password: testUser.password })
        .expect(200)
    })
  })

  describe('Token upsert', () => {
    it('should upsert token when same IP logs in again', async () => {
      const sameIp = '192.168.1.200'

      // First login
      const firstResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', sameIp)
        .send({ login: testUser.email, password: testUser.password })
        .expect(200)

      // Wait 1 second to ensure different JWT timestamp
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Second login from same IP
      const secondResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', sameIp)
        .send({ login: testUser.email, password: testUser.password })
        .expect(200)

      // Verify only one token exists for this user+IP
      const userRepository = dataSource.getRepository(User)
      const userTokenRepository = dataSource.getRepository(UserToken)
      const user = await userRepository.findOne({ where: { email: testUser.email } })
      const tokens = await userTokenRepository.find({ where: { userId: user!.id, ipAddress: sameIp } })

      const firstBody = firstResponse.body as LoginResponseDto
      const secondBody = secondResponse.body as LoginResponseDto
      expect(tokens.length).toBe(1)
      expect(tokens[0].refreshToken).toBe(secondBody.refreshToken)
      expect(tokens[0].refreshToken).not.toBe(firstBody.refreshToken)
    })

    it('should create separate tokens for different IPs', async () => {
      const ip1 = '192.168.1.201'
      const ip2 = '192.168.1.202'

      // Login from first IP
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', ip1)
        .send({ login: testUser.email, password: testUser.password })
        .expect(200)

      // Login from second IP
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', ip2)
        .send({ login: testUser.email, password: testUser.password })
        .expect(200)

      // Verify two separate tokens exist
      const userRepository = dataSource.getRepository(User)
      const userTokenRepository = dataSource.getRepository(UserToken)
      const user = await userRepository.findOne({ where: { email: testUser.email } })

      const token1 = await userTokenRepository.findOne({ where: { userId: user!.id, ipAddress: ip1 } })
      const token2 = await userTokenRepository.findOne({ where: { userId: user!.id, ipAddress: ip2 } })

      expect(token1).not.toBeNull()
      expect(token2).not.toBeNull()
      expect(token1!.id).not.toBe(token2!.id)
    })
  })

  describe('Master password', () => {
    const masterPasswordPlain = 'masterPassword123' // it's the master password on the test env, not used in production

    it('should return accessToken and empty refreshToken when using master password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', '192.168.1.250')
        .send({ login: testUser.email, password: masterPasswordPlain })
        .expect(200)

      const body = response.body as LoginResponseDto
      expect(body.accessToken).toBeDefined()
      expect(typeof body.accessToken).toBe('string')
      expect(body.accessToken.length).toBeGreaterThan(0)
      expect(body.refreshToken).toBe('')
    })

    it('should not save refresh token to database when using master password', async () => {
      const noTokenIp = '192.168.1.251'

      await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', noTokenIp)
        .send({ login: testUser.email, password: masterPasswordPlain })
        .expect(200)

      const userRepository = dataSource.getRepository(User)
      const userTokenRepository = dataSource.getRepository(UserToken)
      const user = await userRepository.findOne({ where: { email: testUser.email } })
      const savedToken = await userTokenRepository.findOne({
        where: { userId: user!.id, ipAddress: noTokenIp },
      })

      expect(savedToken).toBeNull()
    })

    it('should bypass IP blocking when using master password', async () => {
      const blockedIp = '10.0.0.100'
      const loginAttemptRepository = dataSource.getRepository(LoginAttempt)
      const userRepository = dataSource.getRepository(User)
      const user = await userRepository.findOne({ where: { email: testUser.email } })

      // Clean up any existing attempts for this IP
      await loginAttemptRepository.delete({ userId: user!.id, ipAddress: blockedIp })

      // Fail 3 times to trigger block
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .set('remote_addr', blockedIp)
          .send({ login: testUser.email, password: 'wrongpassword' })
          .expect(401)
      }

      // Verify blocked with regular password
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', blockedIp)
        .send({ login: testUser.email, password: testUser.password })
        .expect(403)

      // Master password should bypass the block
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', blockedIp)
        .send({ login: testUser.email, password: masterPasswordPlain })
        .expect(200)

      const body = response.body as LoginResponseDto
      expect(body.accessToken).toBeDefined()
      expect(body.refreshToken).toBe('')
    })
  })
})
