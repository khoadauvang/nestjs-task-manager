import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { trim } from '../../../common/utils/transforms.js';

export class CreateProjectDto {
  /** @example "Website redesign" */
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  /** @example "New landing page and pricing section" */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}
