import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { ProjectRole } from '../project-role.enum.js';
import { Project } from './project.entity.js';

/**
 * Join table between users and projects, with the member's role.
 * The composite primary key (project_id, user_id) prevents duplicates.
 */
@Entity('project_members')
export class ProjectMember {
  @PrimaryColumn({ type: 'uuid' })
  projectId: string;

  @Index()
  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: ProjectRole,
    enumName: 'project_role',
    default: ProjectRole.MEMBER,
  })
  role: ProjectRole;

  @ManyToOne(() => Project, (project) => project.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  project?: Relation<Project>;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user?: Relation<User>;

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt: Date;
}
