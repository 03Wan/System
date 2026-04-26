import handler from "./[...route].js";

export function dispatchTo(pathname) {
  return async function routeHandler(req, res) {
    const original = String(req.url || "");
    const queryIndex = original.indexOf("?");
    const query = queryIndex >= 0 ? original.slice(queryIndex) : "";
    req.url = `/api${pathname}${query}`;
    return handler(req, res);
  };
}
