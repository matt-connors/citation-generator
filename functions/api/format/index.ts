import { handleFormat } from './handler';
import { registerStyle, registerLocale } from '../../lib/format/citeproc';
import { decode as decodeStyle, NAMES as STYLE_NAMES } from '../../lib/format/styles';
import { decode as decodeLocale } from '../../lib/format/locales';
import type { AnalyticsBinding } from '../../lib/analytics';
import { isTestRequest } from '../../lib/test-context';

interface Env { ANALYTICS?: AnalyticsBinding }

let registered = false;
function ensureRegistered() {
  if (registered) return;
  registerLocale('en-US', decodeLocale('locales-en-US'));
  for (const name of STYLE_NAMES) {
    registerStyle(name as any, decodeStyle(name));
  }
  registered = true;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  ensureRegistered();
  const analytics = isTestRequest(context.request) ? undefined : context.env.ANALYTICS;
  return handleFormat(context.request, analytics);
};
