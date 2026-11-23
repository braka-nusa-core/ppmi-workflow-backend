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
import { AssignmentsService } from './assignments.service';
import {
  CreateAssignmentDto,
  UpdateAssignmentDto,
  createAssignmentSchema,
  listAssignmentsQuerySchema,
  updateAssignmentSchema,
} from './assignments.validation';

@ApiTags('Assignments (PIC)')
@Controller('assignments')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('assignment', 'read')
  @ApiOperation({
    summary:
      'List PIC assignments (filter by entity, user, category; includeEnded=true for history)',
  })
  list(@Query() query: Record<string, string>) {
    return this.assignmentsService.list(
      listAssignmentsQuerySchema.parse(query),
    );
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('assignment', 'read')
  @ApiOperation({ summary: 'Get an assignment' })
  @ApiParam({ name: 'id', type: String })
  get(@Param('id') id: string) {
    return this.assignmentsService.get(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('assignment', 'create')
  @ApiOperation({
    summary: 'Assign a PIC to a vessel, quotation, policy or client',
  })
  create(
    @Body(new ZodValidationPipe(createAssignmentSchema))
    body: CreateAssignmentDto,
    @Req() req: Request,
  ) {
    return this.assignmentsService.create(body, this.actor(req));
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('assignment', 'update')
  @ApiOperation({ summary: 'Update contact details, role or note' })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAssignmentSchema))
    body: UpdateAssignmentDto,
    @Req() req: Request,
  ) {
    return this.assignmentsService.update(id, body, this.actor(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('assignment', 'delete')
  @ApiOperation({
    summary: 'End an assignment (kept in the history, not removed)',
  })
  @ApiParam({ name: 'id', type: String })
  end(@Param('id') id: string, @Req() req: Request) {
    return this.assignmentsService.end(id, this.actor(req));
  }

  private actor(req: Request) {
    return { id: req.credentials.sub, fullname: req.credentials.fullname };
  }
}
