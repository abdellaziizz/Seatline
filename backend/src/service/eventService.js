import { countEvents, findEvents } from "../repositories/eventRepository.js";
const getEvents = async (page, limit) => {
  const offset = (page - 1) * limit;
  // await the Promise.all (not each item), so both queries run in parallel.
  // The order of the results matches the order of the array.
  const [total, events] = await Promise.all([
    countEvents(),
    findEvents(limit, offset),
  ]);
  //For example, 45 events and a limit of 20 produce 3 pages.
  const totalPages = Math.ceil(total / limit);
  return {
    events,
    pagination: {
      page,
      limit,
      totalPages,
      total,
      //helpers for frontend
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
};
export default getEvents;
