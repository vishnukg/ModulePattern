import type { Restaurant, ReservationInput } from "../../index.ts";

type RestaurantCliCfg = { restaurant: Restaurant };

// The terminal-facing surface, mirroring the four operations the HTTP router exposes.
// Each method returns a single line of text rather than writing to stdout — the entry
// point (cli/index.ts) owns argv and printing; this owns the CLI↔domain translation.
export type RestaurantCli = {
    reserve: (input: ReservationInput, tableSize: number) => Promise<string>;
    cancel: (id: string) => Promise<string>;
    update: (id: string, input: ReservationInput) => Promise<string>;
    getReservations: () => Promise<string>;
};

// Driving adapter — translates a parsed command-line request into a call on the
// Restaurant port and renders the outcome as a line of text. This is the terminal
// counterpart of makeRestaurantRouter (the HTTP driving adapter): same job, different
// transport. The entry point (cli/index.ts) reads argv and prints; this owns the
// translation between CLI-land and the domain.
const makeRestaurantCli = ({ restaurant }: RestaurantCliCfg): RestaurantCli => {
    const reserve = async (input: ReservationInput, tableSize: number): Promise<string> => {
        const result = await restaurant.reserve(input);
        return `Reservation ${result} — ${input.quantity} seat(s) on ${input.date} (table size: ${tableSize})`;
    };

    const cancel = async (id: string): Promise<string> => {
        const result = await restaurant.cancel(id);
        return `Reservation ${id} — ${result}`;
    };

    const update = async (id: string, input: ReservationInput): Promise<string> => {
        const result = await restaurant.update(id, input);
        return `Reservation ${id} ${result} — ${input.quantity} seat(s) on ${input.date}`;
    };

    const getReservations = async (): Promise<string> => {
        const reservations = await restaurant.getReservations();
        if (reservations.length === 0) return "No reservations";
        const lines = reservations.map(
            (r) => `- ${r.id}: ${r.quantity} seat(s) on ${r.date}`,
        );
        return `${reservations.length} reservation(s):\n${lines.join("\n")}`;
    };

    return { reserve, cancel, update, getReservations };
};

export default makeRestaurantCli;
