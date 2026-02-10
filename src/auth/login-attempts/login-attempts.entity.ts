import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { User } from '../../users/users.entity'

@Entity('login_attempts')
@Index(['userId', 'ipAddress', 'archivedAt'])
export class LoginAttempt {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number

  @Column({ type: 'int', unsigned: true, name: 'user_id' })
  userId: number

  @Column({ type: 'varchar', length: 45, name: 'ip_address' })
  ipAddress: string

  @Column({ type: 'int', unsigned: true, default: 0, name: 'failed_count' })
  failedCount: number

  @Column({ type: 'timestamp', precision: 6, nullable: true, name: 'blocked_until' })
  blockedUntil: Date | null

  @Column({ type: 'timestamp', precision: 6, nullable: true, name: 'archived_at' })
  archivedAt: Date | null

  @CreateDateColumn({ type: 'timestamp', precision: 6, name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ type: 'timestamp', precision: 6, name: 'updated_at' })
  updatedAt: Date

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User
}
