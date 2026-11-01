import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { toLowerCaseTrimmed } from '../../../common/utils/transforms.js';

export class LoginDto {
  /** @example "khoa@example.com" */
  @Transform(toLowerCaseTrimmed)
  @IsEmail()
  email: string;

  /** @example "correct-horse-battery" */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password: string;
}
