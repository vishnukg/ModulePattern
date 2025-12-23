import modules from "./modules/index.js";

export default () => {
  const saveReservation = modules.db.saveReservation();
  const db = { saveReservation };
  // Even though db is an object of its own,
  // we still wrap db in an object and pass it to reserve,
  // because reserve can have multiple dependencies and db is
  // just one of them
  const reserve = modules.restaurant.reserve({ db });
  const restaurant = { reserve };
  return { restaurant };
};
