import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { UpdateMeDto } from './dto/update-me.dto.js';
import { User } from './entities/user.entity.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Get the signed-in user' })
  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<User> {
    return this.usersService.findById(user.id);
  }

  @ApiOperation({ summary: 'Update the signed-in user' })
  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMeDto,
  ): Promise<User> {
    return this.usersService.updateName(user.id, dto.name);
  }
}
