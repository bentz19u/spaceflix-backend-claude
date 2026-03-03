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
import { UserPlanEnum } from '../src/users/user-plan.enum'

describe('UsersController (e2e)', () => {
  let app: INestApplication<App>
  let dataSource: DataSource

  const testUsers = {
    active: { email: 'active-test@spaceflix.local', password: 'password123' },
    deleted: { email: 'deleted-test@spaceflix.local', password: 'password123' },
    newUser: { email: 'new-user@spaceflix.local', password: 'password123', plan: UserPlanEnum.STANDARD },
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

    // Insert test data
    const userRepository = dataSource.getRepository(User)

    const activeUser = userRepository.create({
      email: testUsers.active.email,
      password: await bcrypt.hash(testUsers.active.password, 10),
    })
    await userRepository.save(activeUser)

    const deletedUser = userRepository.create({
      email: testUsers.deleted.email,
      password: await bcrypt.hash(testUsers.deleted.password, 10),
    })
    await userRepository.save(deletedUser)
    await userRepository.softDelete({ email: testUsers.deleted.email })
  })

  afterAll(async () => {
    // Clean up test data
    const userRepository = dataSource.getRepository(User)

    await userRepository
      .createQueryBuilder()
      .delete()
      .where('email IN (:...emails)', {
        emails: [testUsers.active.email, testUsers.deleted.email, testUsers.newUser.email],
      })
      .execute()

    await app.close()
  })

  describe('GET /users/is-registrable', () => {
    it('should return isAvailable: true when email does not exist', () => {
      return request(app.getHttpServer())
        .get('/users/is-registrable')
        .query({ email: 'nonexistent@spaceflix.local' })
        .expect(200)
        .expect({ isAvailable: true, canActivate: false })
    })

    it('should return isAvailable: false when email exists and is active', () => {
      return request(app.getHttpServer())
        .get('/users/is-registrable')
        .query({ email: testUsers.active.email })
        .expect(200)
        .expect({ isAvailable: false, canActivate: false })
    })

    it('should return canActivate: true when email exists but is soft-deleted', () => {
      return request(app.getHttpServer())
        .get('/users/is-registrable')
        .query({ email: testUsers.deleted.email })
        .expect(200)
        .expect({ isAvailable: false, canActivate: true })
    })

    it('should return 400 when email is invalid', () => {
      return request(app.getHttpServer()).get('/users/is-registrable').query({ email: 'invalid-email' }).expect(400)
    })

    it('should return 400 when email is missing', () => {
      return request(app.getHttpServer()).get('/users/is-registrable').expect(400)
    })
  })

  describe('POST /users', () => {
    it('should create a new user and return the id', async () => {
      const response = await request(app.getHttpServer()).post('/users').send(testUsers.newUser).expect(201)

      const body = response.body as { id: number }
      expect(body).toHaveProperty('id')
      expect(typeof body.id).toBe('number')

      // Verify user was created in database with hashed password
      const userRepository = dataSource.getRepository(User)
      const user = await userRepository.findOne({ where: { email: testUsers.newUser.email } })
      expect(user).toBeDefined()
      expect(user!.plan).toBe(testUsers.newUser.plan)
      expect(user!.password).not.toBe(testUsers.newUser.password)
      expect(await bcrypt.compare(testUsers.newUser.password, user!.password)).toBe(true)
    })

    it('should return 409 when email already exists', () => {
      return request(app.getHttpServer())
        .post('/users')
        .send({
          email: testUsers.active.email,
          password: 'password123',
          plan: UserPlanEnum.STANDARD,
        })
        .expect(409)
        .expect((res) => {
          expect((res.body as { code: string }).code).toBe('users-register-0001')
        })
    })

    it('should return 400 when email is invalid', () => {
      return request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'invalid-email',
          password: 'password123',
          plan: UserPlanEnum.STANDARD,
        })
        .expect(400)
    })

    it('should return 400 when password is too short', () => {
      return request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'short-password@spaceflix.local',
          password: 'short',
          plan: UserPlanEnum.STANDARD,
        })
        .expect(400)
    })

    it('should return 400 when plan is invalid', () => {
      return request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'invalid-plan@spaceflix.local',
          password: 'password123',
          plan: 'invalid_plan',
        })
        .expect(400)
    })

    it('should return 400 when required fields are missing', () => {
      return request(app.getHttpServer()).post('/users').send({}).expect(400)
    })
  })
})
