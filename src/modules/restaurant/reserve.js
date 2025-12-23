export default ({ db }) =>
  ({ quantity, date }) => {
    // buisness logic
    return db.saveReservation({ quantity, date });
  };
