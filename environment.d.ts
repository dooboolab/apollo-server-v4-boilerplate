import 'express-serve-static-core';

import type {i18n} from 'i18next';

declare module 'express-serve-static-core' {
  interface Request extends i18n {
    appSecret: string;
    appSecretEtc: string;
  }
}
