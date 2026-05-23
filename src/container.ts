type Container<T> = {
  add<K extends string, V>(name: K, factory: (services: T) => V): Container<T & Record<K, V>>;
  build(): T;
};

function make<T>(services: T): Container<T> {
  return {
    add(name, factory) {
      const newService = factory(services);
      // `as any` lets TypeScript spread a generic object — Container<T> still
      // enforces correctness for anyone calling .add() from the outside.
      const next = { ...(services as any), [name]: newService };
      return make(next) as any;
    },
    build() {
      return services;
    },
  };
}

export const container = () => make({});
