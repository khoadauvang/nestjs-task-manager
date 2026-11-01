import { PickType } from '@nestjs/swagger';
import { RegisterDto } from '../../auth/dto/register.dto.js';

/** Reuses the `name` rules from RegisterDto instead of repeating them. */
export class UpdateMeDto extends PickType(RegisterDto, ['name'] as const) {}
