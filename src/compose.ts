import modules from "./modules/index.ts";

export default ({ config }) => {
  // the pattern is you first call the outerfunction with dependencies
  // so it returns the inner function which can be used
  // we then wrap the innner function in a object which is then added to the compose object
  // compose object is returned
  const saveReservation = modules.db.saveReservation();
  const db = { saveReservation };
  // Even though db is an object of its own,
  // we still wrap db in an object and pass it to reserve,
  // because reserve can have multiple dependencies and db is
  // just one of them
  const reserve = modules.restaurant.reserve({ db, config });
  const restaurant = { reserve };
  return { restaurant };
};
