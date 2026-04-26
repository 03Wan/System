import handler from "../../../[...route].js";

export default async function routeHandler(req, res) {
  const id = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
  const queryIndex = String(req.url || "").indexOf("?");
  const query = queryIndex >= 0 ? String(req.url).slice(queryIndex) : "";
  req.url = `/api/admin/templates/${id || ""}${query}`;
  return handler(req, res);
}
