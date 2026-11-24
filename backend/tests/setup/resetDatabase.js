const resetDatabase = async (pool) => {
  await pool.query(
    `TRUNCATE TABLE users,events,holds,event_seats,orders,order_items,tickets,payments,webhook_events `,
  );
};
export default resetDatabase;
