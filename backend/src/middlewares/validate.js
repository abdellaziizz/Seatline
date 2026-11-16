import AppError from "../utils/appError.js";
const validate = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.slice(1).join(".")}: ${i.message}`)
        .join("; ");
      return next(new AppError(message, 400, "VALIDATION_ERROR"));
    }
    if (result.data.body !== undefined) req.body = result.data.body;
    // cleaned values (lowercased email, uppercased currency)

    req.validated = req.body;
    next();
  };
};
export default validate;
