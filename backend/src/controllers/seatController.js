import getEventSeatsService from "../service/seatService.js";
const getEventSeats = async (req, res, next) => {
  const { id } = req.params;
  const seats = await getEventSeatsService(id);
  return res.status(200).json({ status: "success", data: seats });
};
export default getEventSeats;
