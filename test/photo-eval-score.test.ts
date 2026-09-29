import { describe, expect, it } from "vitest";
import renaiJson from "../fixtures/route-renai-001.json";
import labelsJson from "../eval/photo-labels.json";
import { judge, type PhotoLabel, type Places } from "../eval/score.js";
import type { Observation, Route } from "../src/types.js";

const route = renaiJson as Route;
const places = labelsJson.places as unknown as Places;
const saw = (...signage: string[]): Observation => ({ landmarks: [], signage, confidence: "high", source: "photo" });
const at = (place: string, expect: string[] = [], optional: string[] = []): PhotoLabel => ({ file: "x", place, expect, optional });

describe("photo eval scoring", () => {
  it("every labelled place exists, and every checkpoint sits at its own position", () => {
    for (const p of labelsJson.photos) expect(p.place === "noise" || p.place in places, p.file).toBe(true);
    expect(route.checkpoints.map((c) => c.id)).toEqual(["cp1", "cp2", "cp2x", "cp3", "cp3x", "cp4", "cp5"]);
    expect(places.lane?.zone).toBe("lane");
  });

  it("lobby-only evidence at the lobby arrives when the phone agrees, and asks first when it cannot tell", () => {
    const sign = at("lobby", ["復康巴士"]);
    expect(judge(route, places, sign, "cp5", saw("復康巴士"), "place")).toMatchObject({ action: "CONFIRM_ARRIVAL", outcome: "correct" });
    expect(judge(route, places, sign, "cp5", saw("復康巴士"), "none")).toMatchObject({ action: "ASK", outcome: "miss" });
  });

  it("the hospital name before the lobby only asks, it never arrives", () => {
    const pylon = at("fuxing_west", [], ["臺北市立聯合醫院"]);
    expect(judge(route, places, pylon, "cp5", saw("臺北市立聯合醫院")).action).not.toBe("CONFIRM_ARRIVAL");
  });

  it("the emergency pylon recovering at cp5 is right; the same word inside the building is false", () => {
    expect(judge(route, places, at("er", ["急診"]), "cp5", saw("急診")).outcome).toBe("correct");
    expect(judge(route, places, at("inside", [], ["急診"]), "cp5", saw("急診")).outcome).toBe("false_conflict");
  });

  it("location vetoes confirming a corner the walker has not reached", () => {
    const exit = at("exit2");
    expect(judge(route, places, exit, "cp2", saw("大安路一段116巷"), "none")).toMatchObject({ outcome: "false_confirm", reachable: true });
    expect(judge(route, places, exit, "cp2", saw("大安路一段116巷"), "place")).toMatchObject({ action: "REANCHOR", outcome: "ok", vetoed: true });
  });

  it("an exit board underground never confirms exit 2: only the walker does", () => {
    expect(judge(route, places, at("station", [], ["SOGO復興館", "出口2"]), "cp1", saw("出口2", "SOGO復興館")).outcome).toBe("ok");
  });

  it("inside the lobby, a floor directory's 急診 is held back once the phone knows it is at the lobby", () => {
    const floor = at("inside", [], ["急診"]);
    expect(judge(route, places, floor, "cp5", saw("急診"), "none").outcome).toBe("false_conflict");
    expect(judge(route, places, floor, "cp5", saw("急診"), "place")).toMatchObject({ action: "ASK", vetoed: true });
  });

  it("a photo never confirms a crossing, and never counts against it", () => {
    expect(judge(route, places, at("fuxing_east"), "cp2x", saw("仁愛路")).outcome).toBe("ok");
  });

  it("a photo of nothing in particular must never confirm anywhere", () => {
    expect(judge(route, places, at("noise"), "cp3", saw("仁愛路"))).toMatchObject({ outcome: "false_confirm", reachable: true });
  });

  it("the walked-too-far canopy recovers at the lobby checkpoint", () => {
    const canopy = at("past", ["綠色頂棚走廊"]);
    expect(judge(route, places, canopy, "cp5", { ...saw(), landmarks: ["綠色頂棚走廊"] }).outcome).toBe("correct");
    expect(judge(route, places, canopy, "cp5", saw()).outcome).toBe("miss");
  });
});
