import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * La landing es un sitio estático que no habla con ninguna API: la política de seguridad de
 * Vercel (vercel.json) tiene que reflejarlo. Si alguien le suma un dominio externo, hay que
 * hacerlo a propósito y cambiar este test, no por descuido.
 */
describe("política de seguridad de Vercel", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const csp = config.headers.flatMap((rule) => rule.headers).find((header) => header.key === "Content-Security-Policy");
  const directive = (name: string) =>
    csp?.value
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name} `));

  it("existe", () => {
    expect(csp).toBeDefined();
  });

  it("no deja conectarse a ningún dominio externo", () => {
    expect(directive("connect-src")).toBe("connect-src 'self'");
  });

  it("sólo ejecuta scripts del propio sitio", () => {
    expect(directive("script-src")).toBe("script-src 'self'");
  });

  it("no puede ser embebida en otra página ni enviar formularios", () => {
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive("form-action")).toBe("form-action 'none'");
  });
});
