import 'i18next';

// https://stackoverflow.com/a/70106896/8841562
// @ts-ignore
import type en from '../locales/en.json' assert {type: 'json'};
// @ts-ignore
import type ko from '../locales/ko.json' assert {type: 'json'};

declare module 'i18next ' {
  interface CustomTypeOptions {
    returnNull: false;
    defaultNS: 'en';
    resources: {
      en: typeof en;
      ko: typeof ko;
    };
  }
}
