import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trim } from '../../../common/utils/transforms.js';

export class CreateCommentDto {
  /** @example "I'll take this one after lunch." */
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}
