import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { throwError } from 'rxjs';

@Catch(HttpException)
export class RpcHttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    if (host.getType() !== 'rpc') {
      throw exception;
    }

    const statusCode = exception.getStatus();
    const response = exception.getResponse();
    const payload =
      typeof response === 'string'
        ? { statusCode, message: response }
        : { statusCode, ...(response as Record<string, unknown>) };

    return throwError(() => new RpcException(payload));
  }
}
