import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AppService } from './app.service';
import { LoginDto, loginSchema } from './app.validation';
import { AuthMetaData } from './common/decorators/auth.decorator';
import { ResponseMessage } from './common/decorators/response-message.decorator';
import { AuthGuard } from './common/guards/auth.guard';
import { ZodValidationPipe } from './common/pipes/zod.pipe';

@Controller()
@UseGuards(AuthGuard)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @AuthMetaData('SkipAuth')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(
    `PPMI Workflow ${process.env.MODE === 'production' ? 'API' : 'Dev API'}`,
  )
  index() {
    return;
  }

  @Post('/auth/login')
  @AuthMetaData('SkipAuth')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(loginSchema))
  login(@Body() body: LoginDto) {
    return this.appService.login(body);
  }

  @Get('/profile')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  profile(@Req() req: Request) {
    return this.appService.profile(req.credentials.sub);
  }
}
