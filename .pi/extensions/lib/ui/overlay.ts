export const STANDARD_OVERLAY_OPTIONS = { anchor: "center", width: "95%", maxHeight: "90%", minWidth: 80, margin: 1 } as const;

export const CALENDAR_OVERLAY_OPTIONS = {
  anchor: "center",
  width: "72%",
  maxHeight: "92%",
  minWidth: 72,
  margin: 1,
  visible: (termWidth: number) => termWidth >= 110,
} as const;
