import {
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { QuotationAttachmentsService } from './quotation-attachments.service';

@ApiTags('Quotation Attachments')
@Controller('quotations/:quotationId/attachments')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class QuotationAttachmentsController {
  constructor(
    private readonly quotationAttachmentsService: QuotationAttachmentsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'List attachments for a quotation' })
  list(@Param('quotationId') quotationId: string) {
    return this.quotationAttachmentsService.list(quotationId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'read')
  @ApiOperation({ summary: 'Get a quotation attachment' })
  get(@Param('quotationId') quotationId: string, @Param('id') id: string) {
    return this.quotationAttachmentsService.get(quotationId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('quotation', 'update')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload a quotation attachment' })
  create(
    @Param('quotationId') quotationId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 52_428_800 }),
          new FileTypeValidator({
            fileType:
              /^(application\/pdf|image\/.+|application\/vnd\.openxmlformats-officedocument\..+|application\/vnd\.ms-.+)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Req() req: Request,
  ) {
    return this.quotationAttachmentsService.create(
      quotationId,
      file,
      req.credentials.sub,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotation', 'update')
  @ApiOperation({ summary: 'Soft delete a quotation attachment' })
  delete(
    @Param('quotationId') quotationId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.quotationAttachmentsService.delete(
      quotationId,
      id,
      req.credentials.sub,
    );
  }
}
