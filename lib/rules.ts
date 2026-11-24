import { config } from "../config/booking.config.ts";
import type { SlotRules } from "./slots.ts";

export const rules: SlotRules = {
  timeZone: config.timeZone,
  weeklyHours: config.weeklyHours,
  blockedDates: config.blockedDates,
};
