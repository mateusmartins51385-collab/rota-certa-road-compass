import { describe, expect, it } from "vitest";
import { isDetour, parseItinerary } from "./itinerary";

const lines = [
  "LINHA 038 EMTU",
  "Sentido Mogi das Cruzes – Estação Estudantes → São",
  "Paulo – Metrô Armênia",
  "Representação esquemática pelas coordenadas geográficas; não representa ruas ou navegação.",
  "Paradas (3)",
  "Nº Local / endereço Latitude Longitude",
  "001 Rua Professor Álvaro Pavan (Terminal Estudantes) -23.516401 -46.185722",
  "002 Avenida Manoel Bezerra Lima Filho Mogi das Cruzes - São Paulo, 08780, Brasil - Socorro, -23.517395 -46.181084",
  "Mogi das Cruzes - SP, 08780, Brasil",
  "Linha 038 EMTU • Conversão de KML para PDF Página 1",
  "003 Av. Ver. Narciso Yague Guimarães, 201 -23.518452 -46.182112",
  "Sentido São Paulo – Metrô Armênia → Mogi das Cruzes –",
  "Estação Estudantes",
  "001 Rua A -23.500000 -46.600000",
  "002 Rua B -23.510000 -46.610000",
];

describe("parseItinerary", () => {
  const it1 = parseItinerary(lines);
  it("separates ida and volta into two directions", () => {
    expect(it1.directions).toHaveLength(2);
    expect(it1.directions[0]!.label).toBe("Mogi das Cruzes – Estação Estudantes → São Paulo – Metrô Armênia");
    expect(it1.directions[1]!.label).toBe("São Paulo – Metrô Armênia → Mogi das Cruzes – Estação Estudantes");
  });
  it("keeps stops in the PDF order with exact coordinates", () => {
    expect(it1.directions[0]!.stops.map((s) => s.n)).toEqual([1, 2, 3]);
    expect(it1.directions[0]!.stops[1]!.lat).toBe(-23.517395);
    expect(it1.directions[0]!.stops[1]!.lon).toBe(-46.181084);
  });
  it("joins wrapped address lines and skips page footers", () => {
    expect(it1.directions[0]!.stops[1]!.name).toContain("Mogi das Cruzes - SP, 08780, Brasil");
    expect(it1.directions[0]!.stops[1]!.name).not.toContain("Página");
  });
});

describe("isDetour", () => {
  it("rejects a road leg much longer than the direct distance", () => {
    expect(isDetour(2000, 400)).toBe(true);
    expect(isDetour(600, 400)).toBe(false);
  });
});
