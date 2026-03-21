export function timeToMinutes(time: string): number {
  const parts = time.split(":");
  if (parts.length !== 2) {
    throw new Error(`Invalid time format: "${time}"`);
  }
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Invalid time format: "${time}"`);
  }
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
