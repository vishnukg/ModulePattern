export default () => {
  // in memory db for now
  // maybe add more methods here later
  const reservations = [];
  return (reservation) => {
    reservations.push(reservation);
    return reservations;
  };
};
