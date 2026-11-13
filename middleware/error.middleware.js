import { HttpError } from "../utils/httpError.js";

// Postgres error codes that are the client's fault, not a server bug.
const PG_ERRORS = {
  23503: [409, "This record is referenced by other data"], // foreign_key_violation
  23505: [409, "This record already exists"], // unique_violation
  22003: [400, "A numeric value is out of range"], // numeric_value_out_of_range
};

export const errorMiddleware = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message });
  }

  // Errors raised by express.json()
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Malformed JSON body" });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body too large" });
  }

  if (PG_ERRORS[error.code]) {
    const [status, message] = PG_ERRORS[error.code];
    return res.status(status).json({ message });
  }

  // Only unanticipated errors reach here, so log the whole thing (stack included).
  console.error(error);
  return res.status(500).json({ message: "Internal server error" });
};
