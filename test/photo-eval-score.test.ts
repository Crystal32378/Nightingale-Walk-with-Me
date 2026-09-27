import { describe, expect, it } from "vitest";
import renaiJson from "../fixtures/route-renai-001.json";
import { judge, type PhotoLabel } from "../eval/score.js";
import type { Observation, Route } from "../src/types.js";

const route = renaiJson as Route;
const saw = (...signage: string[]): Observation => ({ landmarks: [], signage, confidence: "high", source: "photo" });

describe("photo eval scoring", () => {
  const pylon: PhotoLabel = { file: "p", zone: "cp4", expect: ["臺北市立聯合醫院"] };

  it("arriving on a sign that stands before the lobby is a false arrival, and reachable", () => {
    const cell = judge(route, pylon, "cp5", saw("臺北市立聯合醫院"));
    expect(cell).toMatchObject({ action: "CONFIRM_ARRIVAL", outcome: "false_arrival", reachable: true });
  });

  it("the emergency pylon recovering at cp5 is the right answer", () => {
    const er: PhotoLabel = { file: "e", zone: "cp4", expect: ["急診"] };
    expect(judge(route, er, "cp5", saw("急診")).outcome).toBe("correct");
  });

  it("a conflict raised on text the photo does not show, or inside the building, is false", () => {
    const inside: PhotoLabel = { file: "i", zone: "inside", expect: [], optional: ["急診"] };
    expect(judge(route, inside, "cp5", saw("急診")).outcome).toBe("false_conflict");
    const lobby: PhotoLabel = { file: "l", zone: "cp5", expect: ["臺北市立聯合醫院"] };
    expect(judge(route, lobby, "cp5", saw("臺北市立聯合醫院", "急診")).outcome).toBe("false_conflict");
  });

  it("an underground board that confirms the exit is a reachable false confirm", () => {
    const board: PhotoLabel = { file: "b", zone: "station", expect: [] };
    expect(judge(route, board, "cp1", saw("SOGO復興館"))).toMatchObject({ outcome: "false_confirm", reachable: true });
  });

  it("confirming a checkpoint the person has already passed is only an advance", () => {
    const lobby: PhotoLabel = { file: "l", zone: "cp5", expect: [] };
    expect(judge(route, lobby, "cp4", saw("聯合醫院")).outcome).toBe("advance");
  });

  it("a photo of nothing in particular must never confirm anywhere", () => {
    const noise: PhotoLabel = { file: "n", zone: "noise", expect: [] };
    expect(judge(route, noise, "cp3", saw("仁愛路"))).toMatchObject({ outcome: "false_confirm", reachable: true });
    expect(judge(route, noise, "cp3", saw()).outcome).toBe("ok");
  });

  it("the walked-too-far canopy should recover at the lobby checkpoint", () => {
    const canopy: PhotoLabel = { file: "c", zone: "past", expect: ["綠色頂棚走廊"] };
    expect(judge(route, canopy, "cp5", { ...saw(), landmarks: ["綠色頂棚走廊"] }).outcome).toBe("correct");
    expect(judge(route, canopy, "cp5", saw()).outcome).toBe("miss");
  });
});
