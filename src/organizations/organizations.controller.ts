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
import { AuthMetaData } from '../common/decorators/auth.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { OrganizationsService } from './organizations.service';
import {
  AssignPermissionsDto,
  assignPermissionsSchema,
  CreateOrgDto,
  CreatePermissionDto,
  createOrganizationSchema,
  createPermissionSchema,
  UpdateOrgDto,
  UpdatePermissionDto,
  updateOrganizationSchema,
  updatePermissionSchema,
} from './organizations.validation';

@ApiTags('Organizations')
@Controller('organizations')
@UseGuards(AuthGuard)
@AuthMetaData('AdminOnly')
@ApiBearerAuth()
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all organizations (tree structure)' })
  list() {
    return this.organizationsService.list();
  }

  @Get('permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all permissions' })
  getPermissions() {
    return this.organizationsService.getPermissions();
  }

  @Post('permissions')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createPermissionSchema))
  @ApiOperation({ summary: 'Create a permission' })
  createPermission(@Body() body: CreatePermissionDto, @Req() req: Request) {
    const actor = { id: req.credentials.sub, fullname: req.credentials.fullname };
    return this.organizationsService.createPermission(body, actor);
  }

  @Patch('permissions/:id')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(updatePermissionSchema))
  @ApiOperation({ summary: 'Update a permission description' })
  @ApiParam({ name: 'id', type: String })
  updatePermission(@Param('id') id: string, @Body() body: UpdatePermissionDto, @Req() req: Request) {
    const actor = { id: req.credentials.sub, fullname: req.credentials.fullname };
    return this.organizationsService.updatePermission(id, body, actor);
  }

  @Delete('permissions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete a permission' })
  @ApiParam({ name: 'id', type: String })
  deletePermission(@Param('id') id: string, @Req() req: Request) {
    const actor = { id: req.credentials.sub, fullname: req.credentials.fullname };
    return this.organizationsService.deletePermission(id, actor);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiParam({ name: 'id', type: String })
  get(@Param('id') id: string) {
    return this.organizationsService.get(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createOrganizationSchema))
  @ApiOperation({ summary: 'Create an organization' })
  create(@Body() body: CreateOrgDto, @Req() req: Request) {
    const actor = { id: req.credentials.sub, fullname: req.credentials.fullname };
    return this.organizationsService.create(body, actor);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(updateOrganizationSchema))
  @ApiOperation({ summary: 'Update an organization' })
  @ApiParam({ name: 'id', type: String })
  update(@Param('id') id: string, @Body() body: UpdateOrgDto, @Req() req: Request) {
    const actor = { id: req.credentials.sub, fullname: req.credentials.fullname };
    return this.organizationsService.update(id, body, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete an organization' })
  @ApiParam({ name: 'id', type: String })
  delete(@Param('id') id: string, @Req() req: Request) {
    const actor = { id: req.credentials.sub, fullname: req.credentials.fullname };
    return this.organizationsService.delete(id, actor);
  }

  @Get(':id/permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List permissions assigned to an organization' })
  @ApiParam({ name: 'id', type: String })
  getOrgPermissions(@Param('id') id: string) {
    return this.organizationsService.getOrgPermissions(id);
  }

  @Post(':id/permissions')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(assignPermissionsSchema))
  @ApiOperation({ summary: 'Assign permissions to an organization' })
  @ApiParam({ name: 'id', type: String })
  assignPermissions(@Param('id') id: string, @Body() body: AssignPermissionsDto, @Req() req: Request) {
    const actor = { id: req.credentials.sub, fullname: req.credentials.fullname };
    return this.organizationsService.assignPermissions(id, body, actor);
  }

  @Delete(':id/permissions/:permissionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a permission from an organization' })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'permissionId', type: String })
  removePermission(@Param('id') id: string, @Param('permissionId') permissionId: string, @Req() req: Request) {
    const actor = { id: req.credentials.sub, fullname: req.credentials.fullname };
    return this.organizationsService.removePermission(id, permissionId, actor);
  }
}
