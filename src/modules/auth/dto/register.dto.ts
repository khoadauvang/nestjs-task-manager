import { Transform } from 'class-transformer';
import {
  IsByteLength,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { toLowerCaseTrimmed, trim } from '../../../common/utils/transforms.js';

export class RegisterDto {
  /** @example "khoa@example.com" */
  @Transform(toLowerCaseTrimmed)
  @IsEmail()
  @MaxLength(255)
  email: string;

  /** @example "Tran Anh Khoa" */
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  /**
   * At least 8 characters. bcrypt only uses the first 72 bytes of a
   * password, so longer ones are rejected instead of silently truncated.
   * @example "correct-horse-battery"
   */
  @IsString()
  @MinLength(8)
  @IsByteLength(0, 72, { message: 'password must be at most 72 bytes long' })
  password: string;
}
