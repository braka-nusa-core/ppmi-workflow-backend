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
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { ClientsService } from './clients.service';
import {
  CreateClientDto,
  UpdateClientDto,
  createClientSchema,
  updateClientSchema,
} from './clients.validation';

@ApiTags('Clients')
@Controller('clients')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('client', 'read')
  @ApiOperation({ summary: 'List all clients' })
  list() {
    return this.clientsService.list();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('client', 'read')
  @ApiOperation({ summary: 'Get client by ID' })
  @ApiParam({ name: 'id', type: String })
  get(@Param('id') id: string) {
    return this.clientsService.get(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('client', 'create')
  @UsePipes(new ZodValidationPipe(createClientSchema))
  @ApiOperation({ summary: 'Create a new client' })
  create(@Body() body: CreateClientDto, @Req() req: Request) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.clientsService.create(body, actor);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('client', 'update')
  @UsePipes(new ZodValidationPipe(updateClientSchema))
  @ApiOperation({ summary: 'Update a client' })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id') id: string,
    @Body() body: UpdateClientDto,
    @Req() req: Request,
  ) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.clientsService.update(id, body, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('client', 'delete')
  @ApiOperation({ summary: 'Soft delete a client' })
  @ApiParam({ name: 'id', type: String })
  delete(@Param('id') id: string, @Req() req: Request) {
    const actor = {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
    return this.clientsService.delete(id, actor);
  }
}
