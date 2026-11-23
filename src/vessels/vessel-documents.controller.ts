import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
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
import { VesselDocumentsService } from './vessel-documents.service';
import { VesselRequirementsService } from './vessel-requirements.service';
import {
  CreateVesselDocumentDto,
  UpdateVesselDocumentDto,
  createVesselDocumentSchema,
  listVesselDocumentsQuerySchema,
  updateVesselDocumentSchema,
} from './vessel-documents.validation';

const MAX_FILE_SIZE = 52_428_800;
const ALLOWED_FILE_TYPES =
  /^(application\/pdf|image\/.+|application\/vnd\.openxmlformats-officedocument\..+|application\/vnd\.ms-.+)$/;

@ApiTags('Vessel Documents')
@Controller('vessels/:vesselId/documents')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
@ApiParam({ name: 'vesselId', type: String })
export class VesselDocumentsController {
  constructor(
    private readonly documentsService: VesselDocumentsService,
    private readonly requirementsService: VesselRequirementsService,
  ) {}

  @Get('checklist')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vessel', 'read')
  @ApiOperation({
    summary:
      'Which required document categories the vessel has, expiring, expired, or still lacks',
  })
  checklist(@Param('vesselId') vesselId: string) {
    return this.requirementsService.checklist(vesselId);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vessel', 'read')
  @ApiOperation({
    summary: 'List vessel documents and photos (filter by category)',
  })
  list(
    @Param('vesselId') vesselId: string,
    @Query() query: Record<string, string>,
  ) {
    return this.documentsService.list(
      vesselId,
      listVesselDocumentsQuerySchema.parse(query),
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('vessel', 'update')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        category: {
          type: 'string',
          description: 'Free text, e.g. PHOTO, SURAT_LAUT. Default OTHER.',
        },
        title: { type: 'string' },
        documentDate: { type: 'string', format: 'date' },
        validFrom: { type: 'string', format: 'date' },
        validUntil: { type: 'string', format: 'date' },
        status: { type: 'string', description: 'Default AVAILABLE.' },
        note: { type: 'string' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload a vessel document or photo' })
  create(
    @Param('vesselId') vesselId: string,
    @Body(new ZodValidationPipe(createVesselDocumentSchema))
    body: CreateVesselDocumentDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({ fileType: ALLOWED_FILE_TYPES }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Req() req: Request,
  ) {
    return this.documentsService.create(vesselId, body, file, this.actor(req));
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vessel', 'update')
  @ApiOperation({ summary: 'Update vessel document metadata' })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('vesselId') vesselId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateVesselDocumentSchema))
    body: UpdateVesselDocumentDto,
    @Req() req: Request,
  ) {
    return this.documentsService.update(vesselId, id, body, this.actor(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('vessel', 'update')
  @ApiOperation({ summary: 'Soft delete a vessel document' })
  @ApiParam({ name: 'id', type: String })
  delete(
    @Param('vesselId') vesselId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.documentsService.delete(vesselId, id, this.actor(req));
  }

  private actor(req: Request) {
    return {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
  }
}
