import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) { }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  /** Returns the current principal derived from the bearer token. */
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  /**
   * Convenience endpoint for the demo login screen so reviewers can see the
   * seeded accounts and their roles. Exposes no secrets.
   */
  @Public()
  @Get('demo-users')
  demoUsers() {
    return this.usersService.listPublic();
  }
}
