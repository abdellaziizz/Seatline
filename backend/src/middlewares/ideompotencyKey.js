import AppError from "../utils/appError";

const requireIdempotencyKey = (req, res, next) => {
  const key = req.get("Idempotency-Key").trim();

  //1.check if it exist or not
  if (!key) {
    return next(
      new AppError(
        "Idempotency-Key header is required",
        400,
        "IDEMPOTENCY_KEY_MISSING",
      ),
    );
  }
  //2.check if it's too long
  if (key.length > 255) {
    return next(
      new AppError(
        "Idempotency-Key must be at most 255 characters",
        400,
        "IDEMPOTENCY_KEY_INVALID",
      ),
    );
  }
  //now my controller can access the idempotencyKey
  req.idempotencyKey = key;
  return next();
};
export default requireIdempotencyKey;
