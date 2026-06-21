import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiProperty,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser } from './auth.types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) { }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User login',
    description: 'Authenticate user with email and password. Returns JWT access token and user information.'
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User successfully authenticated',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          userId: '550e8400-e29b-41d4-a716-446655440000',
          email: 'sales@flowdesk.dev',
          name: 'Sales User',
          role: 'SALES'
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials',
    schema: {
      example: {
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid credentials',
        path: '/api/v1/auth/login',
        timestamp: '2026-06-19T10:00:00.000Z'
      }
    }
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  /** Returns the current principal derived from the bearer token. */
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get current user',
    description: 'Returns information about the currently authenticated user based on the JWT token.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current user information retrieved successfully',
    schema: {
      example: {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        email: 'sales@flowdesk.dev',
        name: 'Sales User',
        role: 'SALES'
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - Invalid or missing JWT token' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  /**
   * Convenience endpoint for the demo login screen so reviewers can see the
   * seeded accounts and their roles. Exposes no secrets.
   */
  @Public()
  @Get('demo-users')
  @ApiOperation({
    summary: 'Get demo user accounts',
    description: 'Returns a list of demo user accounts with their roles for the login screen. Exposes no sensitive information.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Demo users retrieved successfully',
    schema: {
      example: [
        {
          email: 'sales@flowdesk.dev',
          name: 'Sales User',
          role: 'SALES'
        },
        {
          email: 'accounts@flowdesk.dev',
          name: 'Accounts User',
          role: 'ACCOUNTS'
        },
        {
          email: 'manager@flowdesk.dev',
          name: 'Manager User',
          role: 'MANAGER'
        }
      ]
    }
  })
  demoUsers() {
    return this.usersService.listPublic();
  }
}
