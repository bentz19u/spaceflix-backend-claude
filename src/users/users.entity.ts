import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'
import { UserPlanEnum } from './user-plan.enum'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number

  @Column({ type: 'varchar', length: 191, unique: true })
  email: string

  @Column({ type: 'varchar', length: 255 })
  password: string

  @Column({ type: 'varchar', length: 50, nullable: true })
  plan: UserPlanEnum | null

  @CreateDateColumn({ type: 'timestamp', precision: 6, name: 'created_at' })
  createdAt: Date

  @DeleteDateColumn({ type: 'timestamp', precision: 6, name: 'deleted_at' })
  deletedAt: Date | null
}
