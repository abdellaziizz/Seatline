import AppError from "../utils/appError.js";
const validate = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
      headers: req.headers,
    });
    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.slice(1).join(".")}: ${i.message}`)
        .join("; ");
      return next(new AppError(message, 400, "VALIDATION_ERROR"));
    }
    // cleaned values (lowercased email, coerced numbers, defaults)
    if (result.data.body !== undefined) req.body = result.data.body;
    // Express 5: req.query is a read-only getter -> assigning it throws.
    // Read parsed query values from req.validated.query instead.
    req.validated = result.data;
    next();
  };
};
export default validate;
