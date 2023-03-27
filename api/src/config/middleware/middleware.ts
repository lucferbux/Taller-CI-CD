import HttpStatus from 'http-status-codes';
import bodyParser from 'body-parser';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { HttpError } from '@/config/error';
import { sendHttpErrorModule } from '@/config/error/sendHttpError';
import Logger from '@/utils/Logger';
import * as Sentry from '@sentry/node';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false // Disable the `X-RateLimit-*` headers
});

/**
 * @export
 * @param {express.Application} app
 */
export function configure(app: express.Application): void {
  // express middleware
  app.use(
    bodyParser.urlencoded({
      extended: false
    })
  );
  app.use(bodyParser.json());
  // parse Cookie header and populate req.cookies with an object keyed by the cookie names.
  app.use(cookieParser());
  // returns the compression middleware
  app.use(compression());
  // helps you secure your Express apps by setting various HTTP headers
  app.use(helmet());
  // providing a Connect/Express middleware that can be used to enable CORS with various options
  app.use(
    cors({
      exposedHeaders: ['Authorization'],
      optionsSuccessStatus: HttpStatus.OK
    })
  );

  // Apply the rate limiting middleware to all requests
  app.use(limiter);

  // custom errors
  app.use(sendHttpErrorModule);

  // RequestHandler creates a separate execution context using domains, so that every
  // transaction/span/breadcrumb is attached to its own Hub instance
  app.use(Sentry.Handlers.requestHandler());
  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());

  // The error handler must be before any other error middleware and after all controllers
  app.use(Sentry.Handlers.errorHandler());

  app.use(
    Sentry.Handlers.errorHandler({
      shouldHandleError(error) {
        // Capture all 404 and 500 errors
        if (error.status === 404 || error.status === 500) {
          return true;
        }
        return false;
      }
    })
  );
}

interface CustomResponse extends express.Response {
  sendHttpError: (error: HttpError | Error, message?: string) => void;
}

/**
 * @export
 * @param {express.Application} app
 */
export function initErrorHandler(app: express.Application): void {
  app.use((error: Error, req: express.Request, res: CustomResponse) => {
    if (typeof error === 'number') {
      error = new HttpError(error); // next(404)
    }

    if (error instanceof HttpError) {
      res.sendHttpError(error);
    } else {
      if (app.get('env') === 'development') {
        error = new HttpError(HttpStatus.INTERNAL_SERVER_ERROR, error.message);
        res.sendHttpError(error);
      } else {
        error = new HttpError(HttpStatus.INTERNAL_SERVER_ERROR);
        res.sendHttpError(error, error.message);
      }
    }
    Sentry.captureException(new Error(`${error}`));
    Logger.error(error);
  });
}
