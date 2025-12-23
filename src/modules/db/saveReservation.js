export default () => {
  // in memory db for now
  const reservations = [];
  return (reservation) => {
    reservations.push(reservation);
    return reservations;
  };
};
