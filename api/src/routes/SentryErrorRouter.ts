import { Router } from 'express';
import * as Sentry from '@sentry/node';

/**
 * @constant {express.Router}
 */
const router: Router = Router();

router.get('/', function mainHandler(req, res) {
  Sentry.captureException(new Error('My first issue'));
  res.end('Issue captured');
});

/**
 * @export {express.Router}
 */
export default router;
