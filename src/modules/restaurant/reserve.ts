export default ({ db, config }) =>
  ({ quantity, date }) => {
    // buisness logic
    if (quantity <= config.tableSize) {
      db.saveReservation({ quantity, date });
      return "Accepted";
    } else {
      return "Rejected";
    }
  };
