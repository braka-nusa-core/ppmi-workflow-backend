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
import { BanksService } from './banks.service';
import {
  CreateBankDto,
  UpdateBankDto,
  createBankSchema,
  listBanksQuerySchema,
  updateBankSchema,
} from './banks.validation';

@ApiTags('Banks')
@Controller('banks')
@UseGuards(AuthGuard, PermissionGuard)
@ApiBearerAuth()
export class BanksController {
  constructor(private readonly banksService: BanksService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermission('bank', 'read')
  @ApiOperation({ summary: 'List banks (filter by currency and q)' })
  list(@Query() query: Record<string, string>) {
    return this.banksService.list(listBanksQuerySchema.parse(query));
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('bank', 'read')
  @ApiOperation({ summary: 'Get a bank' })
  @ApiParam({ name: 'id', type: String })
  get(@Param('id') id: string) {
    return this.banksService.get(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('bank', 'create')
  @ApiOperation({ summary: 'Create a bank account for invoices' })
  create(
    @Body(new ZodValidationPipe(createBankSchema)) body: CreateBankDto,
    @Req() req: Request,
  ) {
    return this.banksService.create(body, this.actor(req));
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('bank', 'update')
  @ApiOperation({ summary: 'Update a bank' })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBankSchema)) body: UpdateBankDto,
    @Req() req: Request,
  ) {
    return this.banksService.update(id, body, this.actor(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('bank', 'delete')
  @ApiOperation({
    summary: 'Soft delete a bank (refused while an invoice uses it)',
  })
  @ApiParam({ name: 'id', type: String })
  delete(@Param('id') id: string, @Req() req: Request) {
    return this.banksService.delete(id, this.actor(req));
  }

  private actor(req: Request) {
    return {
      id: req.credentials.sub,
      fullname: req.credentials.fullname,
    };
  }
}
