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
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { QsTemplatesService } from './qs-templates.service';
import {
  CreateQsTemplateDto,
  UpdateQsTemplateDto,
  createQsTemplateSchema,
  listQsTemplatesQuerySchema,
  updateQsTemplateSchema,
} from './qs-templates.validation';

@ApiTags('QS Templates')
@Controller('qs-templates')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class QsTemplatesController {
  constructor(private readonly templatesService: QsTemplatesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('qs-template', 'read')
  @ApiOperation({
    summary:
      'List QS templates (filter by templateDomain, clubId, coverType), without content',
  })
  list(@Query() query: Record<string, string>) {
    return this.templatesService.list(listQsTemplatesQuerySchema.parse(query));
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('qs-template', 'read')
  @ApiOperation({ summary: 'Get a QS template with its content' })
  @ApiParam({ name: 'id', type: String })
  get(@Param('id') id: string) {
    return this.templatesService.get(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('qs-template', 'create')
  @ApiOperation({
    summary:
      'Create a QS template. P&I templates need a club and may target FULL or LIMITED cover.',
  })
  create(
    @Body(new ZodValidationPipe(createQsTemplateSchema))
    body: CreateQsTemplateDto,
    @Req() req: Request,
  ) {
    return this.templatesService.create(body, this.actor(req));
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('qs-template', 'update')
  @ApiOperation({ summary: 'Update a QS template' })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateQsTemplateSchema))
    body: UpdateQsTemplateDto,
    @Req() req: Request,
  ) {
    return this.templatesService.update(id, body, this.actor(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('qs-template', 'delete')
  @ApiOperation({ summary: 'Soft delete a QS template' })
  @ApiParam({ name: 'id', type: String })
  delete(@Param('id') id: string, @Req() req: Request) {
    return this.templatesService.delete(id, this.actor(req));
  }

  private actor(req: Request) {
    return { id: req.credentials.sub, fullname: req.credentials.fullname };
  }
}
