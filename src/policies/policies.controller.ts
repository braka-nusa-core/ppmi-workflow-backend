import {
  Body,
  Controller,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { ZodValidationPipe } from '../common/pipes/zod.pipe';
import { PlacementService } from './placement.service';
import { PoliciesService } from './policies.service';
import {
  IssuePolicyDto,
  ReplacePlacementDto,
  UpdatePolicyDto,
  issuePolicySchema,
  listPoliciesQuerySchema,
  replacePlacementSchema,
  updatePolicySchema,
} from './policies.validation';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from './policy.shared';

const fileValidators = () =>
  new ParseFilePipe({
    validators: [
      new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
      new FileTypeValidator({ fileType: ALLOWED_FILE_TYPES }),
    ],
  });

const optionalFileValidators = () =>
  new ParseFilePipe({
    fileIsRequired: false,
    validators: [
      new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
      new FileTypeValidator({ fileType: ALLOWED_FILE_TYPES }),
    ],
  });

const actorOf = (req: Request) => ({
  id: req.credentials.sub,
  fullname: req.credentials.fullname,
});

@ApiTags('Policy Placement')
@Controller('quotations/:quotationId/placement')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
@ApiParam({ name: 'quotationId', type: String })
export class PlacementController {
  constructor(private readonly placementService: PlacementService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('policy', 'read')
  @ApiOperation({
    summary: 'Placement of a quotation with total share and completeness',
  })
  get(@Param('quotationId') quotationId: string) {
    return this.placementService.get(quotationId);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('policy', 'create')
  @ApiOperation({
    summary:
      'Replace the placement (one leader, no duplicates, total exactly 100.00)',
  })
  replace(
    @Param('quotationId') quotationId: string,
    @Body(new ZodValidationPipe(replacePlacementSchema))
    body: ReplacePlacementDto,
    @Req() req: Request,
  ) {
    return this.placementService.replace(quotationId, body, actorOf(req));
  }
}

@ApiTags('Policies')
@Controller()
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Post('quotations/:quotationId/issue-policy')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('policy', 'create')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['policyNumber'],
      properties: {
        file: { type: 'string', format: 'binary' },
        policyNumber: { type: 'string' },
        policyDate: { type: 'string', format: 'date' },
        periodStart: { type: 'string', format: 'date' },
        periodEnd: { type: 'string', format: 'date' },
      },
    },
  })
  @ApiOperation({
    summary: 'Issue the policy of an insurance-approved quotation',
  })
  @ApiParam({ name: 'quotationId', type: String })
  issue(
    @Param('quotationId') quotationId: string,
    @Body(new ZodValidationPipe(issuePolicySchema)) body: IssuePolicyDto,
    @UploadedFile(optionalFileValidators())
    file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    return this.policiesService.issue(quotationId, body, file, actorOf(req));
  }

  @Get('policies')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('policy', 'read')
  @ApiOperation({
    summary:
      'List policies (filter by status, insurance type, quotation, number)',
  })
  list(@Query() query: Record<string, string>) {
    return this.policiesService.list(listPoliciesQuerySchema.parse(query));
  }

  @Get('policies/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('policy', 'read')
  @ApiOperation({ summary: 'Policy with quotation, participants and history' })
  @ApiParam({ name: 'id', type: String })
  get(@Param('id') id: string) {
    return this.policiesService.get(id);
  }

  @Patch('policies/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('policy', 'update')
  @ApiOperation({ summary: 'Update policy data (only while POLICY_ISSUED)' })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePolicySchema)) body: UpdatePolicyDto,
    @Req() req: Request,
  ) {
    return this.policiesService.update(id, body, actorOf(req));
  }

  @Post('policies/:id/document')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('policy', 'update')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload or replace the policy document' })
  @ApiParam({ name: 'id', type: String })
  uploadDocument(
    @Param('id') id: string,
    @UploadedFile(fileValidators()) file: Express.Multer.File,
    @Req() req: Request,
  ) {
    return this.policiesService.uploadDocument(id, file, actorOf(req));
  }

  @Post('policies/:id/complete-placement')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('policy', 'update')
  @ApiOperation({
    summary:
      'Complete placement (needs one leader and a total share of 100.00)',
  })
  @ApiParam({ name: 'id', type: String })
  completePlacement(@Param('id') id: string, @Req() req: Request) {
    return this.policiesService.completePlacement(id, actorOf(req));
  }
}
