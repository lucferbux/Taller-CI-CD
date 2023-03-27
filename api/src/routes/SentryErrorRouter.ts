import { Router } from 'express';
import * as Sentry from '@sentry/node';

/**
 * @constant {express.Router}
 */
const router: Router = Router();

router.get('/', function mainHandler(req, res) {
  Sentry.captureException(new Error('My first issue'));
  res.status(500).json({ message: 'Critical error' });
});

/**
 * @export {express.Router}
 */
export default router;
