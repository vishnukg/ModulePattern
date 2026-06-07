import type { Restaurant, ReservationInput } from "../../index.ts";

type RestaurantCliCfg = { restaurant: Restaurant };

// Driving adapter — translates a parsed command-line request into a call on the
// Restaurant port and renders the outcome as a line of text. This is the terminal
// counterpart of makeRestaurantRouter (the HTTP driving adapter): same job, different
// transport. The entry point (cli/index.ts) reads argv and prints; this owns the
// translation between CLI-land and the domain.
const makeRestaurantCli = ({ restaurant }: RestaurantCliCfg) => {
    const reserve = async (input: ReservationInput, tableSize: number): Promise<string> => {
        const result = await restaurant.reserve(input);
        return `Reservation ${result} — ${input.quantity} seat(s) on ${input.date} (table size: ${tableSize})`;
    };

    return { reserve };
};

export default makeRestaurantCli;
