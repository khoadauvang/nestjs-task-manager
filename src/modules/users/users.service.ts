import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email: email.toLowerCase() });
  }

  /** Includes the password hash, which is excluded from normal queries. */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: email.toLowerCase() })
      .getOne();
  }

  async findById(id: string): Promise<User> {
    const user = await this.users.findOneBy({ id });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  existsByEmail(email: string): Promise<boolean> {
    return this.users.existsBy({ email: email.toLowerCase() });
  }

  create(data: Pick<User, 'email' | 'name' | 'passwordHash'>): Promise<User> {
    return this.users.save(this.users.create(data));
  }

  async updateName(id: string, name: string): Promise<User> {
    const user = await this.findById(id);
    user.name = name;
    return this.users.save(user);
  }
}
