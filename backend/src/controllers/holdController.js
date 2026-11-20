import { createHold, releaseHold } from "../service/holdService.js";

const postHold = async (req, res, next) => {
  // req.user comes from protect; seatIds were validated (unique, 1..10).
  const result = await createHold(
    req.params.id,
    req.user.id,
    req.validated.body.seatIds,
  );
  return res.status(201).json({ status: "success", data: result });
};

const deleteHold = async (req, res, next) => {
  const result = await releaseHold(req.params.id, req.user.id);
  return res.status(200).json({ status: "success", data: result });
};

export { postHold, deleteHold };
