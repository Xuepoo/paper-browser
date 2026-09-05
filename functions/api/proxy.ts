import { handleProxyCore } from "../../src/proxy/core.ts";

interface Env {}

export const onRequest: PagesFunction<Env> = async (context) => {
  return handleProxyCore({
    request: context.request,
  });
};
