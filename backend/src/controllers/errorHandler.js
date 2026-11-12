import AppError from "../utils/appError.js";
const fromPostgres = (err) => {
  switch (err) {
    case "22P02": // invalid_text_representation, e.g. 'abc' for a bigint or a bad enum value
    case "22003": // numeric_value_out_of_range
      return new AppError("Invalid input value", 400, "INVALID_INPUT");
    case "23502": // not_null_violation
      return new AppError("A required field is missing", 400, "MISSING_FIELD");
    case "23000": // integrity_constraint_violation, raised by the entries_immutable trigger
      return new AppError(
        "Ledger entries cannot be changed",
        409,
        "IMMUTABLE_ROW",
      );
    case "23505":
      return new AppError("Resource already exists", 409, "CONFLICT");
    case "23514":
      return new AppError(
        "Request violates a rule",
        422,
        "CONSTRAINT_VIOLATION",
      );
    case "23503":
      return new AppError("Related resource not found", 422, "BAD_REFERENCE");
    case "40P01":
    case "40001":
      return new AppError("Please retry the request", 503, "RETRY");
  }
  return err;
};
const fromRedis = (err) => {
  let code = err.code;
  switch (code) {
    case "ECONNREFUSED":
    case "ETIMEDOUT":
    case "ENOTFOUND":
      return new AppError("Redis service is currently unavailable", 503);
    case "NOAUTH":
    case "WRONGPASS":
      return new AppError("Redis authentication failed", 500);
  }
  return err;
};
const fromJWT = (err) => {
  switch (err.name) {
    case "TokenExpiredError":
      return new AppError(
        "Your token has expired. Please log in again.",
        401,
        "TOKEN_EXPIRED",
      );
    case "JsonWebTokenError":
    case "NotBeforeError":
      return new AppError(
        "Invalid token. Please log in again.",
        401,
        "TOKEN_INVALID",
      );
  }
  return err;
};

// express.json() errors (malformed or oversized bodies).
const fromBodyParserError = (err) => {
  if (err.type === "entity.parse.failed")
    return new AppError("Request body is not valid JSON", 400, "INVALID_JSON");
  if (err.type === "entity.too.large")
    return new AppError("Request body is too large", 413, "PAYLOAD_TOO_LARGE");
  return err;
};
const errorHandler = (err, req, res, next) => {
  let error = err;
  let statusCode = error.statusCode || 500;
  if (!error.isOperational && error.code) error = fromPostgres(error);
  if (!error.isOperational && error.code) error = fromPostgres(error);
  if (!error.isOperational && error.code) error = fromRedis(error);

  if (config.env === "development")
    res.status(statusCode).json({
      status: error.status || "error",
      code: error.code,
      message: error.message,
      stack: error.stack,
    });
  else {
    res.status(statusCode).json({
      status: error.status || "error",
      code: error.isOperational ? error.code : "INTERNAL_ERROR",
      message: error.isOperational ? error.message : "Something went wrong!",
    });
  }
};
export default errorHandler;
