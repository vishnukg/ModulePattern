export type Reservation = { quantity: number; date: string };
export type DB = {
  saveReservation: (reservation: Reservation) => Reservation[];
};
export type RestaurantCfg = { tableSize: number };

export type ReserveCfg = { db: DB; restaurantCfg: RestaurantCfg };
export type ComposeCfg = { restaurantCfg: RestaurantCfg };
