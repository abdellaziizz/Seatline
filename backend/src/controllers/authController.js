import jwt from "jsonwebtoken";
import AppError from "../utils/appError.js";
import bcrypt from "bcryptjs";
import config from "../config/config.js";
import { pool } from "../config/db.js";
import { promisify } from "util";

import { createUser, findUserByEmail } from "../repo.js";
import { bytes } from "stream/consumers";
import { user } from "pg/lib/defaults";
const signToken = (user) => {
  jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
};
const verifyJwt = promisify(jwt.verify);
const DUMMY_HASH = bcrypt.hashSync("Seatline-timing-equaliser", 12);
const protect = (req, res, next) => {};
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role))
      next(
        new AppError(
          "You do not have permission to perform this action",
          403,
          "FORBIDDEN",
        ),
      );
    next();
  };
};
const register = async (req, res, next) => {
  //check if email is exist or not first
  const { email, password } = req.body;
  //hash the password
  const hashedPass = bcrypt.hash(password, 12);
  const user = await createUser(email, hashedPass);
  res
    .status(201)
    .json({ status: "success", data: user, token: signToken(user) });
  //innsert the user into postgres and return successful response
};
const login = async (req, res, next) => {
  const { email, password } = req.body;
  const user = await findUserByEmail(email);
  const ok = bcrypt.compare(password, user?.hash_password ?? DUMMY_HASH);
  if (!user || !ok) {
    return next(
      new AppError("Incorrect email or password", 401, "INVALID_CREDENTIALS"),
    );
  }
  res.status(200).json({
    status: "success",
    token: signToken(user),
    data: user,
  });
};
export { register, requireRole, login, protect };
