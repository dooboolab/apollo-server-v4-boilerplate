import type {Request, Response} from 'express';
import {Router} from 'express';

import {prisma} from '../context.js';
import {getToken} from '../utils/auth.js';
import {version} from '../utils/const.js';
import {verifyWithRefresh} from '../utils/jwt.js';

const onVersion = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    version: `${version}`,
  });
};

const onHome = async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV !== 'production') {
    res.send(`${req.t('IT_WORKS')} - ${version}`);

    return;
  }

  res.redirect('https://<your-domain>.com');
};

const getIdToken = async (req: Request, res: Response): Promise<void> => {
  const token = getToken(req);

  if (!token) {
    res.status(401).json({message: req.t('ERR_NOT_AUTHORIZED')});

    return;
  }

  try {
    const result = await verifyWithRefresh(token, prisma);
    res.status(200).json({token: result.accessToken, userId: result.userId});
  } catch (err) {
    res.status(200).json({message: err});
  }
};

const router = Router();
router
  .get('/', onHome)
  .post('/get-id-token', getIdToken)
  .get('/version', onVersion);

export default router;
