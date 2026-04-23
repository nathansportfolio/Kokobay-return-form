const LEVELS = ["A", "B", "C", "D", "E", "F"] as const;

export type BinLocation = {
  code: string;
  rack: string;
  bay: string;
  level: string;
  position: number;
  isOccupied: boolean;
};

/**
 * [RACK]-[BAY]-[LEVEL]-[POSITION], e.g. A-02-D-2
 * Row A: 13 bays; B–I: 4 bays; J–U: 5 bays. 6 levels (A–F), 2 positions per level.
 */
export function generateBins(): BinLocation[] {
  const bins: BinLocation[] = [];
  const rows = "ABCDEFGHIJKLMNOPQRSTU".split("");

  for (const row of rows) {
    let binCount = 5;
    if (row === "A") {
      binCount = 13;
    } else if (row >= "B" && row <= "I") {
      binCount = 4;
    }

    for (let bay = 1; bay <= binCount; bay += 1) {
      const bayStr = String(bay).padStart(2, "0");

      for (const level of LEVELS) {
        for (let position = 1; position <= 2; position += 1) {
          bins.push({
            code: `${row}-${bayStr}-${level}-${position}`,
            rack: row,
            bay: bayStr,
            level,
            position,
            isOccupied: false,
          });
        }
      }
    }
  }

  return bins;
}
