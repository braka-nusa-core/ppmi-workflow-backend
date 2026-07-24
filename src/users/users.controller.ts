import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthMetaData } from '../common/decorators/auth.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  createUserSchema,
  updateUserSchema,
} from './users.validation';

@ApiTags('Users')
@Controller('users')
@UseGuards(AuthGuard)
@AuthMetaData('AdminOnly')
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Users retrieved successfully')
  @ApiOperation({ summary: 'List all users' })
  @ApiQuery({ name: 'organization_unit_id', required: false, type: String })
  list(@Query('organization_unit_id') organization_unit_id?: string) {
    return this.usersService.list(organization_unit_id);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('User retrieved successfully')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', type: String })
  get(@Param('id') id: string) {
    return this.usersService.get(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('User created successfully')
  @UsePipes(new ZodValidationPipe(createUserSchema))
  @ApiOperation({ summary: 'Create a new user' })
  create(@Body() body: CreateUserDto, @Req() req: Request) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.usersService.create(body, actor);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('User updated successfully')
  @UsePipes(new ZodValidationPipe(updateUserSchema))
  @ApiOperation({ summary: 'Update a user' })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @Req() req: Request,
  ) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.usersService.update(id, body, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('User deleted successfully')
  @ApiOperation({ summary: 'Soft delete a user' })
  @ApiParam({ name: 'id', type: String })
  delete(@Param('id') id: string, @Req() req: Request) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.usersService.delete(id, actor);
  }
}
