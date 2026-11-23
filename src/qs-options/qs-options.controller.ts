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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { QsOptionsService } from './qs-options.service';
import {
  CreateQsOptionDto,
  UpdateQsOptionDto,
  createQsOptionSchema,
  listQsOptionsQuerySchema,
  updateQsOptionSchema,
} from './qs-options.validation';

@ApiTags('QSheet Options')
@Controller('qs-options')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class QsOptionsController {
  constructor(private readonly qsOptionsService: QsOptionsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('qs-option', 'read')
  @ApiOperation({ summary: 'List active options of a group (for dropdowns)' })
  @ApiQuery({ name: 'group', required: true, example: 'SECURITY' })
  list(@Query() query: Record<string, string>) {
    return this.qsOptionsService.list(listQsOptionsQuerySchema.parse(query));
  }

  @Get('all')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('qs-option', 'read')
  @ApiOperation({ summary: 'List all options including inactive (management)' })
  @ApiQuery({ name: 'group', required: false, example: 'SECURITY' })
  listAll(@Query() query: Record<string, string>) {
    return this.qsOptionsService.listAll(
      listQsOptionsQuerySchema.partial().parse(query),
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('qs-option', 'create')
  @ApiOperation({ summary: 'Create a QSheet option' })
  create(
    @Body(new ZodValidationPipe(createQsOptionSchema)) body: CreateQsOptionDto,
    @Req() req: Request,
  ) {
    return this.qsOptionsService.create(body, this.actor(req));
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('qs-option', 'update')
  @ApiOperation({ summary: 'Update a QSheet option' })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateQsOptionSchema)) body: UpdateQsOptionDto,
    @Req() req: Request,
  ) {
    return this.qsOptionsService.update(id, body, this.actor(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('qs-option', 'delete')
  @ApiOperation({ summary: 'Delete a QSheet option (soft delete)' })
  @ApiParam({ name: 'id', type: String })
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.qsOptionsService.remove(id, this.actor(req));
  }

  private actor(req: Request) {
    return { id: req.credentials.sub, fullname: req.credentials.fullname };
  }
}
