import { describe, it, expect, vi } from "vitest";
import { container } from "../src/container.ts";

describe("container — registration and retrieval", () => {
  it("builds an empty object when nothing is registered", () => {
    expect(container().build()).toEqual({});
  });

  it("registered service is available on the built object", () => {
    const result = container()
      .add("greet", () => "hello")
      .build();

    expect(result.greet).toBe("hello");
  });

  it("later factory receives earlier services", () => {
    const result = container()
      .add("base", () => 10)
      .add("derived", ({ base }) => base * 2)
      .build();

    expect(result.derived).toBe(20);
  });

  it("multiple services are all present on the built object", () => {
    const result = container()
      .add("a", () => 1)
      .add("b", () => 2)
      .add("c", () => 3)
      .build();

    expect(result).toMatchObject({ a: 1, b: 2, c: 3 });
  });
});

describe("container — singleton behaviour", () => {
  it("factory is called exactly once", () => {
    const factory = vi.fn(() => "value");

    container().add("x", factory).build();

    expect(factory).toHaveBeenCalledOnce();
  });

  it("all consumers share the same service instance", () => {
    const result = container()
      .add("shared", () => ({ id: 1 }))
      .add("a",      ({ shared }) => shared)
      .add("b",      ({ shared }) => shared)
      .build();

    expect(result.a).toBe(result.b);
    expect(result.a).toBe(result.shared);
  });
});

describe("container — isolation", () => {
  it("two container() calls produce independent instances", () => {
    const c1 = container().add("x", () => ({ value: 1 })).build();
    const c2 = container().add("x", () => ({ value: 2 })).build();

    expect(c1.x.value).toBe(1);
    expect(c2.x.value).toBe(2);
  });
});
