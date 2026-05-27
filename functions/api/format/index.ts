import { handleFormat } from './handler';
import { registerStyle, registerLocale } from '../../lib/format/citeproc';
import { decode as decodeStyle, NAMES as STYLE_NAMES } from '../../lib/format/styles';
import { decode as decodeLocale } from '../../lib/format/locales';

let registered = false;
function ensureRegistered() {
  if (registered) return;
  registerLocale('en-US', decodeLocale('locales-en-US'));
  for (const name of STYLE_NAMES) {
    registerStyle(name as any, decodeStyle(name));
  }
  registered = true;
}

export const onRequest: PagesFunction = async (context) => {
  ensureRegistered();
  return handleFormat(context.request);
};
