import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { App } from 'supertest/types'
import { DataSource } from 'typeorm'
import { I18nValidationExceptionFilter, I18nValidationPipe } from 'nestjs-i18n'
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter'
import * as bcrypt from 'bcrypt'
import { AppModule } from '../src/app.module'
import { User } from '../src/users/users.entity'
import { UserToken } from '../src/auth/user-tokens.entity'
import { LoginAttempt } from '../src/auth/login-attempts/login-attempts.entity'
import { LoginResponseDto } from '../src/auth/dto/login-response.dto'
import { RefreshResponseDto } from '../src/auth/dto/refresh-response.dto'
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
    app.useGlobalFilters(new HttpExceptionFilter(), new I18nValidationExceptionFilter())
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

  describe('POST /auth/logout', () => {
    it('should successfully logout and remove token from database', async () => {
      const logoutIp = '192.168.1.180'

      // First login to get a token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', logoutIp)
        .send({ login: testUser.email, password: testUser.password })
        .expect(200)

      const loginBody = loginResponse.body as LoginResponseDto

      // Verify token exists in database
      const userRepository = dataSource.getRepository(User)
      const userTokenRepository = dataSource.getRepository(UserToken)
      const user = await userRepository.findOne({ where: { email: testUser.email } })
      let savedToken = await userTokenRepository.findOne({
        where: { userId: user!.id, ipAddress: logoutIp },
      })
      expect(savedToken).not.toBeNull()

      // Logout
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('remote_addr', logoutIp)
        .set('Authorization', `Bearer ${loginBody.accessToken}`)
        .expect(200)

      // Verify token is removed from database
      savedToken = await userTokenRepository.findOne({
        where: { userId: user!.id, ipAddress: logoutIp },
      })
      expect(savedToken).toBeNull()
    })

    it('should return 401 when no auth token provided', async () => {
      await request(app.getHttpServer()).post('/auth/logout').set('remote_addr', testIp).expect(401)
    })

    it('should return 401 when invalid token provided', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('remote_addr', testIp)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)
    })

    it('should return 400 when remote_addr header is missing', async () => {
      // First login to get a valid token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', testIp)
        .send({ login: testUser.email, password: testUser.password })
        .expect(200)

      const loginBody = loginResponse.body as LoginResponseDto

      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${loginBody.accessToken}`)
        .expect(400)

      const body = response.body as ErrorResponseDto
      expect(body.code).toBe('auth-logout-0001')
      expect(body.description).toBeDefined()
    })
  })

  describe('POST /auth/refresh', () => {
    it('should successfully refresh tokens with valid refresh token', async () => {
      const refreshIp = '192.168.2.1'

      // Login to get tokens
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', refreshIp)
        .send({ login: testUser.email, password: testUser.password })
        .expect(200)

      const loginBody = loginResponse.body as LoginResponseDto

      // Wait to ensure different JWT timestamp
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Refresh tokens
      const refreshResponse = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('remote_addr', refreshIp)
        .set('Authorization', `Bearer ${loginBody.refreshToken}`)
        .expect(200)

      const refreshBody = refreshResponse.body as RefreshResponseDto
      expect(refreshBody).toHaveProperty('accessToken')
      expect(refreshBody).toHaveProperty('refreshToken')
      expect(typeof refreshBody.accessToken).toBe('string')
      expect(typeof refreshBody.refreshToken).toBe('string')
      expect(refreshBody.accessToken).not.toBe(loginBody.accessToken)
      expect(refreshBody.refreshToken).not.toBe(loginBody.refreshToken)
    })

    it('should return new access token that works for authenticated requests', async () => {
      const refreshIp = '192.168.2.2'

      // Login to get tokens
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', refreshIp)
        .send({ login: testUser.email, password: testUser.password })
        .expect(200)

      const loginBody = loginResponse.body as LoginResponseDto

      // Refresh tokens
      const refreshResponse = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('remote_addr', refreshIp)
        .set('Authorization', `Bearer ${loginBody.refreshToken}`)
        .expect(200)

      const refreshBody = refreshResponse.body as RefreshResponseDto

      // Use new access token for authenticated request (logout)
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('remote_addr', refreshIp)
        .set('Authorization', `Bearer ${refreshBody.accessToken}`)
        .expect(200)
    })

    it('should rotate refresh token (old token invalidated)', async () => {
      const refreshIp = '192.168.2.3'

      // Login to get tokens
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', refreshIp)
        .send({ login: testUser.email, password: testUser.password })
        .expect(200)

      const loginBody = loginResponse.body as LoginResponseDto

      // Wait to ensure different JWT timestamp
      await new Promise((resolve) => setTimeout(resolve, 1100))

      // First refresh - should succeed and rotate the token
      const firstRefreshResponse = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('remote_addr', refreshIp)
        .set('Authorization', `Bearer ${loginBody.refreshToken}`)
        .expect(200)

      const firstRefreshBody = firstRefreshResponse.body as RefreshResponseDto
      expect(firstRefreshBody.refreshToken).not.toBe(loginBody.refreshToken)

      // Second refresh with old token - should fail because token was rotated
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('remote_addr', refreshIp)
        .set('Authorization', `Bearer ${loginBody.refreshToken}`)
        .expect(401)

      const body = response.body as ErrorResponseDto
      expect(body.code).toBe('auth-refresh-0003')
    })

    it('should return 400 when remote_addr header is missing', async () => {
      // Login to get a valid refresh token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', testIp)
        .send({ login: testUser.email, password: testUser.password })
        .expect(200)

      const loginBody = loginResponse.body as LoginResponseDto

      // Call refresh without remote_addr header
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${loginBody.refreshToken}`)
        .expect(400)

      const body = response.body as ErrorResponseDto
      expect(body.code).toBe('auth-refresh-0001')
      expect(body.description).toBeDefined()
    })

    it('should return 401 for invalid/malformed refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('remote_addr', testIp)
        .set('Authorization', 'Bearer invalid-malformed-token')
        .expect(401)

      const body = response.body as ErrorResponseDto
      expect(body.code).toBe('http-0401')
    })

    it('should return 401 when no authorization header provided', async () => {
      const response = await request(app.getHttpServer()).post('/auth/refresh').set('remote_addr', testIp).expect(401)

      const body = response.body as ErrorResponseDto
      expect(body.code).toBe('http-0401')
    })

    it('should return 401 when token not found in database (after logout)', async () => {
      const refreshIp = '192.168.2.4'

      // Login to get tokens
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', refreshIp)
        .send({ login: testUser.email, password: testUser.password })
        .expect(200)

      const loginBody = loginResponse.body as LoginResponseDto

      // Logout to remove token from database
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('remote_addr', refreshIp)
        .set('Authorization', `Bearer ${loginBody.accessToken}`)
        .expect(200)

      // Try to refresh with the old token
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('remote_addr', refreshIp)
        .set('Authorization', `Bearer ${loginBody.refreshToken}`)
        .expect(401)

      const body = response.body as ErrorResponseDto
      expect(body.code).toBe('auth-refresh-0003')
    })

    it('should return 401 when IP address does not match stored token', async () => {
      const loginIp = '192.168.2.5'
      const differentIp = '192.168.2.6'

      // Login from first IP
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', loginIp)
        .send({ login: testUser.email, password: testUser.password })
        .expect(200)

      const loginBody = loginResponse.body as LoginResponseDto

      // Try to refresh from different IP
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('remote_addr', differentIp)
        .set('Authorization', `Bearer ${loginBody.refreshToken}`)
        .expect(401)

      const body = response.body as ErrorResponseDto
      expect(body.code).toBe('auth-refresh-0003')
    })

    it('should work correctly with rememberMe tokens', async () => {
      const refreshIp = '192.168.2.7'

      // Login with rememberMe
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', refreshIp)
        .send({ login: testUser.email, password: testUser.password, rememberMe: true })
        .expect(200)

      const loginBody = loginResponse.body as LoginResponseDto

      // Refresh tokens
      const refreshResponse = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('remote_addr', refreshIp)
        .set('Authorization', `Bearer ${loginBody.refreshToken}`)
        .expect(200)

      const refreshBody = refreshResponse.body as RefreshResponseDto
      expect(refreshBody.accessToken).toBeDefined()
      expect(refreshBody.refreshToken).toBeDefined()
    })

    it('should allow multiple IPs to refresh independently', async () => {
      const ip1 = '192.168.2.8'
      const ip2 = '192.168.2.9'

      // Login from first IP
      const loginResponse1 = await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', ip1)
        .send({ login: testUser.email, password: testUser.password })
        .expect(200)

      // Wait to get different JWT timestamp
      await new Promise((resolve) => setTimeout(resolve, 1100))

      // Login from second IP
      const loginResponse2 = await request(app.getHttpServer())
        .post('/auth/login')
        .set('remote_addr', ip2)
        .send({ login: testUser.email, password: testUser.password })
        .expect(200)

      const loginBody1 = loginResponse1.body as LoginResponseDto
      const loginBody2 = loginResponse2.body as LoginResponseDto

      // Refresh from first IP
      const refreshResponse1 = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('remote_addr', ip1)
        .set('Authorization', `Bearer ${loginBody1.refreshToken}`)
        .expect(200)

      // Refresh from second IP (should still work independently)
      const refreshResponse2 = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('remote_addr', ip2)
        .set('Authorization', `Bearer ${loginBody2.refreshToken}`)
        .expect(200)

      const refreshBody1 = refreshResponse1.body as RefreshResponseDto
      const refreshBody2 = refreshResponse2.body as RefreshResponseDto

      // Both IPs can refresh independently and get valid tokens
      expect(refreshBody1.accessToken).toBeDefined()
      expect(refreshBody1.refreshToken).toBeDefined()
      expect(refreshBody2.accessToken).toBeDefined()
      expect(refreshBody2.refreshToken).toBeDefined()
    })
  })
})
