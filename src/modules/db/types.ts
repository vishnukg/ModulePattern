export type Reservation = { quantity: number; date: string };

export type DB = {
  saveReservation: (reservation: Reservation) => Reservation[];
};
