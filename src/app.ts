import type {CorsOptions, CorsOptionsDelegate} from 'cors';
import cors from 'cors';
import ejs from 'ejs';
import express from 'express';
import rateLimit from 'express-rate-limit';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.mjs';
// @ts-ignore => Need this to prevent throwing when testing.
import i18next from 'i18next';
import type {FsBackendOptions} from 'i18next-fs-backend';
import FsBackend from 'i18next-fs-backend';
import * as i18Middleware from 'i18next-http-middleware';
import path from 'path';

import RouteAddon from './apis/addon.js';
import RouteApi from './apis/root.js';

const apiLimiter = rateLimit({
  windowMs: 5000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
});

i18next
  //@ts-ignore
  .use(i18Middleware.LanguageDetector)
  .use(FsBackend)
  .init<FsBackendOptions>({
    returnNull: false,
    lng: 'en',
    preload: ['en', 'ko'],
    load: 'languageOnly',
    backend: {
      loadPath: path.join(path.resolve(), './locales/{{lng}}.json'),
      addPath: path.join(path.resolve(), './locales/{{lng}}.missing.json'),
    },
    fallbackLng: ['en', 'ko'],
    saveMissing: true,
    debug: false,
    // debug: !isProduction,
  });

export const i18n = i18next;

export const createExpressApp = (): express.Application => {
  const app = express();
  const filePath = path.join(path.resolve(), './files');

  app.use(express.static(filePath));
  // @ts-ignore
  app.use(i18Middleware.handle(i18next));
  app.use(express.urlencoded({extended: true}));
  app.use(express.json());

  const allowlist = ['your production url'];

  if (process.env.NODE_ENV !== 'production') {
    allowlist.push('http://localhost:19000');
  }

  const corsOptionsDelegate: CorsOptionsDelegate<any> = (
    req,
    callback,
  ): void => {
    let corsOptions: CorsOptions;
    if (allowlist.indexOf(req.header('Origin')) !== -1) {
      corsOptions = {origin: true};
    } else {
      corsOptions = {origin: false};
    }

    callback(null, corsOptions);
  };

  app.use(cors(corsOptionsDelegate));

  app.use(
    '/graphql',
    graphqlUploadExpress({maxFileSize: 100000000, maxFiles: 10}), // 100mb
  );

  app.set('views', path.join(path.resolve(), './html'));
  app.engine('html', ejs.renderFile);
  app.set('view engine', 'html');
  app.use('/addon', apiLimiter, RouteAddon);
  app.use('', RouteApi);

  return app;
};
